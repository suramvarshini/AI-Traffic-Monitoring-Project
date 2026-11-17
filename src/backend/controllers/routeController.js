/**
 * Route Optimization Controller
 * Supports real-world driving route optimization worldwide via OSRM integrated with AI Traffic & Risk weights,
 * as well as node-based graph optimization.
 */

const https = require('https');
const db = require('../db');
const RoadGraph = require('../graph');
const predictor = require('../../ml/predictor');

function formatTravelTime(totalMinutes) {
  const mins = Math.max(1, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hrs} hr ${remainingMins} min` : `${hrs} hr`;
}

function formatDistance(distanceKm) {
  const num = Number(distanceKm);
  if (num < 10) return `${num.toFixed(1)} km`;
  return `${num.toFixed(1)} km`;
}

function optimizeRoute(req, res) {
  try {
    const { startNodeId, endNodeId } = req.body;
    if (!startNodeId || !endNodeId) {
      return res.status(400).json({ success: false, error: 'Both startNodeId and endNodeId are required.' });
    }

    const intersections = db.getIntersections();
    const roads = db.getRoads();

    const graph = new RoadGraph(intersections, roads);
    const routeResult = graph.findRoutes(startNodeId, endNodeId);

    if (routeResult.error) {
      return res.status(400).json({ success: false, error: routeResult.error });
    }

    // Format formatted times and distances
    if (routeResult.routes) {
      routeResult.routes.forEach(r => {
        r.formattedDistance = formatDistance(r.totalDistanceKm);
        r.formattedTime = formatTravelTime(r.estimatedTimeMinutes);
      });
    }

    return res.json({
      success: true,
      data: routeResult
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function optimizeRealWorldRoute(req, res) {
  try {
    const { start, end } = req.body;
    if (!start || !end || start.lat === undefined || start.lng === undefined || end.lat === undefined || end.lng === undefined) {
      return res.status(400).json({ success: false, error: 'Valid start and end location coordinates are required.' });
    }

    const startLat = parseFloat(start.lat);
    const startLng = parseFloat(start.lng);
    const endLat = parseFloat(end.lat);
    const endLng = parseFloat(end.lng);

    // OSRM Driving Route API
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;

    const options = {
      headers: {
        'User-Agent': 'AI-Traffic-Monitoring-System/1.0 (Student Project Platform)'
      }
    };

    https.get(osrmUrl, options, (apiRes) => {
      let rawData = '';
      apiRes.on('data', chunk => rawData += chunk);
      apiRes.on('end', () => {
        try {
          const osrmData = JSON.parse(rawData);
          if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
            return res.json({
              success: false,
              error: 'No driving route found between the selected locations. Please verify the locations are reachable by road.'
            });
          }

          // Get system global weather & average density to calculate AI traffic penalties
          const roads = db.getRoads();
          const sampleRoad = roads[0] || {};
          const globalWeather = sampleRoad.weather || 'clear';
          const globalRoadCond = sampleRoad.roadCondition || 'dry';

          let avgDensity = 45;
          if (roads.length > 0) {
            avgDensity = Math.round(roads.reduce((acc, r) => acc + r.density, 0) / roads.length);
          }

          // Evaluate AI Accident Risk using current environmental parameters
          const aiRiskEval = predictor.predictAccidentRisk({
            density: avgDensity,
            speed: 50,
            speedLimit: 60,
            weather: globalWeather,
            roadCondition: globalRoadCond,
            historicalAccidents: 3
          });

          // Format Primary & Alternative routes
          const routes = osrmData.routes.map((route, idx) => {
            const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
            const baseDurationMins = Math.round(route.duration / 60);

            // Compute AI Traffic Delay Penalty
            let weatherDelayFactor = 1.0;
            if (globalWeather === 'rain') weatherDelayFactor = 1.18;
            if (globalWeather === 'fog') weatherDelayFactor = 1.25;
            if (globalWeather === 'storm') weatherDelayFactor = 1.40;

            const densityDelayMins = Math.round((avgDensity / 100) * (baseDurationMins * 0.25));
            const estimatedTimeMinutes = Math.round(baseDurationMins * weatherDelayFactor + densityDelayMins);
            const trafficDelayMins = estimatedTimeMinutes - baseDurationMins;

            let safetyRating = 'High Safety (Low Risk)';
            if (aiRiskEval.accidentRisk === 'Medium') safetyRating = 'Moderate Safety (Medium Risk)';
            if (aiRiskEval.accidentRisk === 'High') safetyRating = 'Caution (High Risk Zone)';

            const isPrimary = idx === 0;

            // OSRM coordinates are [lng, lat], Leaflet polyline expects [lat, lng]
            const pathCoordinates = (route.geometry.coordinates || []).map(coord => [coord[1], coord[0]]);

            return {
              name: isPrimary ? 'Primary (AI-Optimized Route)' : `Alternative Route ${idx}`,
              isPrimary,
              totalDistanceKm: distanceKm,
              formattedDistance: formatDistance(distanceKm),
              estimatedTimeMinutes,
              formattedTime: formatTravelTime(estimatedTimeMinutes),
              baseTimeMinutes: baseDurationMins,
              formattedBaseTime: formatTravelTime(baseDurationMins),
              trafficDelayMinutes: Math.max(0, trafficDelayMins),
              formattedTrafficDelay: trafficDelayMins > 0 ? `+${formatTravelTime(trafficDelayMins)}` : 'Normal Flow',
              safetyRating,
              accidentRisk: aiRiskEval.accidentRisk,
              weather: globalWeather,
              density: avgDensity,
              startName: start.name || 'Origin',
              endName: end.name || 'Destination',
              pathCoordinates
            };
          });

          return res.json({
            success: true,
            data: {
              startLocation: { name: start.name || start.displayName, lat: startLat, lng: startLng },
              endLocation: { name: end.name || end.displayName, lat: endLat, lng: endLng },
              routesCount: routes.length,
              routes
            }
          });
        } catch (err) {
          return res.status(500).json({ success: false, error: 'Failed to process routing calculation.' });
        }
      });
    }).on('error', (err) => {
      return res.status(500).json({ success: false, error: `Routing service network error: ${err.message}` });
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  optimizeRoute,
  optimizeRealWorldRoute,
  formatTravelTime,
  formatDistance
};
