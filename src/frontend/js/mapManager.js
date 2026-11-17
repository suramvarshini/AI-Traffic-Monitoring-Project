/**
 * Leaflet Interactive Map Manager
 * Manages map initialization, road polyline overlays, accident markers, real-world route markers, and path highlighting.
 */

const MapManager = {
  map: null,
  roadLayers: {},
  intersectionMarkers: {},
  accidentMarkers: [],
  routePolylineLayers: [],
  startMarker: null,
  endMarker: null,

  init(containerId = 'trafficMap') {
    if (this.map) return;

    // Centered globally / India view
    this.map = L.map(containerId, {
      center: [12.9716, 77.5946],
      zoom: 12,
      zoomControl: true
    });

    // OpenStreetMap standard tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors | AI Traffic Monitoring'
    }).addTo(this.map);
  },

  renderIntersections(intersections) {
    if (!this.map) return;

    intersections.forEach(node => {
      if (this.intersectionMarkers[node.id]) {
        this.intersectionMarkers[node.id].setLatLng([node.lat, node.lng]);
      } else {
        const marker = L.circleMarker([node.lat, node.lng], {
          radius: 8,
          fillColor: node.signalState === 'Green' ? '#10b981' : (node.signalState === 'Yellow' ? '#f59e0b' : '#f43f5e'),
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9
        }).addTo(this.map);

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px;">
            <strong>${node.name} (${node.id})</strong><br>
            Signal: <b style="color:${node.signalState.toLowerCase()}">${node.signalState}</b><br>
            Status: ${node.status}
          </div>
        `);

        this.intersectionMarkers[node.id] = marker;
      }
    });
  },

  renderRoads(roads, evaluationsMap = {}) {
    if (!this.map) return;

    roads.forEach(road => {
      const evalInfo = evaluationsMap[road.id] || {};
      const risk = evalInfo.accidentRisk || 'Low';
      const density = road.density || 30;

      let color = '#10b981'; // Green
      if (density >= 40 && density < 65) color = '#f59e0b'; // Yellow
      if (density >= 65 && density < 85) color = '#f43f5e'; // Red
      if (risk === 'High' || density >= 85) color = '#881337'; // Dark Red / High Risk

      const weight = risk === 'High' ? 6 : 4;
      const dashArray = risk === 'High' ? '6, 6' : null;

      if (this.roadLayers[road.id]) {
        this.roadLayers[road.id].setStyle({ color, weight, dashArray });
      } else {
        const polyline = L.polyline(road.coordinates, {
          color,
          weight,
          opacity: 0.85,
          dashArray
        }).addTo(this.map);

        polyline.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; min-width: 180px;">
            <strong style="color: #06b6d4;">${road.name}</strong><br>
            Speed: <b>${road.currentSpeed} km/h</b> (Limit: ${road.speedLimit})<br>
            Density: <b>${road.density}%</b><br>
            Weather: <b>${road.weather}</b> | Road: <b>${road.roadCondition}</b><br>
            <hr style="margin: 4px 0; border: 0; border-top: 1px solid #ddd;">
            AI Accident Risk: <b style="color:${risk === 'High' ? '#f43f5e' : (risk === 'Medium' ? '#f59e0b' : '#10b981')}">${risk}</b>
          </div>
        `);

        this.roadLayers[road.id] = polyline;
      }
    });
  },

  renderAccidents(accidents) {
    if (!this.map) return;

    // Clear previous markers
    this.accidentMarkers.forEach(m => this.map.removeLayer(m));
    this.accidentMarkers = [];

    accidents.forEach(acc => {
      if (acc.lat && acc.lng) {
        const iconHtml = `
          <div style="background:#f43f5e; color:#fff; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; box-shadow:0 0 10px rgba(244,63,94,0.8);">
            !
          </div>
        `;
        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'accident-marker-icon',
          iconSize: [24, 24]
        });

        const marker = L.marker([acc.lat, acc.lng], { icon: customIcon }).addTo(this.map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong style="color:#f43f5e;">ACCIDENT REPORTED</strong><br>
            Location: <b>${acc.roadName || 'Road'}</b><br>
            Severity: <b>${acc.severity}</b><br>
            Description: ${acc.description}
          </div>
        `);
        this.accidentMarkers.push(marker);
      }
    });
  },

  renderRouteMarkers(startLat, startLng, endLat, endLng, startName = 'Origin', endName = 'Destination') {
    if (!this.map) return;

    if (this.startMarker) this.map.removeLayer(this.startMarker);
    if (this.endMarker) this.map.removeLayer(this.endMarker);

    const startHtml = `
      <div style="background:#10b981; color:#fff; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px; box-shadow:0 0 12px rgba(16,185,129,0.8); border:2px solid #fff;">
        A
      </div>
    `;
    const endHtml = `
      <div style="background:#f43f5e; color:#fff; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px; box-shadow:0 0 12px rgba(244,63,94,0.8); border:2px solid #fff;">
        B
      </div>
    `;

    const startIcon = L.divIcon({ html: startHtml, className: 'start-pin', iconSize: [28, 28] });
    const endIcon = L.divIcon({ html: endHtml, className: 'end-pin', iconSize: [28, 28] });

    this.startMarker = L.marker([startLat, startLng], { icon: startIcon }).addTo(this.map);
    this.startMarker.bindPopup(`<b>Origin (A):</b> ${startName}`);

    this.endMarker = L.marker([endLat, endLng], { icon: endIcon }).addTo(this.map);
    this.endMarker.bindPopup(`<b>Destination (B):</b> ${endName}`);
  },

  drawRoute(pathCoordinates, isPrimary = true) {
    if (!this.map || !pathCoordinates || pathCoordinates.length === 0) return;

    const color = isPrimary ? '#06b6d4' : '#3b82f6';
    const polyline = L.polyline(pathCoordinates, {
      color,
      weight: isPrimary ? 7 : 5,
      opacity: 0.9,
      dashArray: isPrimary ? null : '8, 8'
    }).addTo(this.map);

    this.routePolylineLayers.push(polyline);
    this.map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  },

  clearRoutes() {
    if (!this.map) return;
    this.routePolylineLayers.forEach(l => this.map.removeLayer(l));
    this.routePolylineLayers = [];
    if (this.startMarker) { this.map.removeLayer(this.startMarker); this.startMarker = null; }
    if (this.endMarker) { this.map.removeLayer(this.endMarker); this.endMarker = null; }
  }
};
