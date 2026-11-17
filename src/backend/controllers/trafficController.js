/**
 * Traffic State & Telemetry Controller
 */

const db = require('../db');

function getTrafficOverview(req, res) {
  const roads = db.getRoads();
  const intersections = db.getIntersections();
  const accidents = db.getAccidents();
  const events = db.getEvents();

  let totalDensity = 0;
  let totalSpeed = 0;
  let highRiskCount = 0;
  let heavyCongestionCount = 0;

  roads.forEach(r => {
    totalDensity += r.density;
    totalSpeed += r.currentSpeed;
    if (r.density >= 65) heavyCongestionCount++;
  });

  const avgDensity = Math.round(totalDensity / (roads.length || 1));
  const avgSpeed = Math.round(totalSpeed / (roads.length || 1));

  return res.json({
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      totalRoads: roads.length,
      totalIntersections: intersections.length,
      avgDensity,
      avgSpeed,
      activeAccidents: accidents.length,
      heavyCongestionCount,
      systemHealth: heavyCongestionCount > 3 ? 'Warning' : 'Optimal'
    },
    roads,
    intersections,
    recentAccidents: accidents,
    recentEvents: events
  });
}

function updateRoadTelemetry(req, res) {
  const { roadId, density, speed, weather, roadCondition } = req.body;
  if (!roadId) {
    return res.status(400).json({ success: false, error: 'roadId is required' });
  }

  const updated = db.updateRoad(roadId, {
    ...(density !== undefined && { density: Number(density) }),
    ...(speed !== undefined && { currentSpeed: Number(speed) }),
    ...(weather && { weather }),
    ...(roadCondition && { roadCondition })
  });

  if (!updated) {
    return res.status(404).json({ success: false, error: 'Road not found' });
  }

  db.addEvent({
    type: 'TELEMETRY_UPDATE',
    title: 'Road Updated',
    message: `${updated.name}: Density ${updated.density}%, Speed ${updated.currentSpeed} km/h`
  });

  return res.json({ success: true, road: updated });
}

function updateGlobalWeather(req, res) {
  const { weather, roadCondition } = req.body;
  if (!weather) {
    return res.status(400).json({ success: false, error: 'weather parameter is required' });
  }

  const roads = db.updateGlobalWeather(weather, roadCondition);
  return res.json({ success: true, message: `Global weather updated to ${weather}`, roadsCount: roads.length });
}

function reportAccident(req, res) {
  const { roadId, severity, description, lat, lng } = req.body;
  const road = db.getRoadById(roadId);
  const roadName = road ? road.name : 'Unknown Road';

  const accident = db.addAccident({
    roadId,
    roadName,
    severity: severity || 'Medium',
    description: description || 'Traffic collision reported.',
    lat: lat || (road && road.coordinates ? road.coordinates[0][0] : 12.9716),
    lng: lng || (road && road.coordinates ? road.coordinates[0][1] : 77.5946)
  });

  // Increment historical accidents on road
  if (road) {
    db.updateRoad(roadId, {
      historicalAccidents: (road.historicalAccidents || 0) + 1,
      density: Math.min(98, (road.density || 50) + 25),
      currentSpeed: Math.max(10, (road.currentSpeed || 40) - 20)
    });
  }

  return res.json({ success: true, accident });
}

module.exports = {
  getTrafficOverview,
  updateRoadTelemetry,
  updateGlobalWeather,
  reportAccident
};
