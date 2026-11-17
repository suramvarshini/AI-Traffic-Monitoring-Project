/**
 * Main Frontend Application Controller & UI State Binder
 * AI-Powered Smart Traffic Monitoring & Global Route Optimizer
 */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

const App = {
  roads: [],
  intersections: [],
  evaluations: {},
  evaluationsList: [],
  weatherTypes: ['clear', 'rain', 'fog', 'storm'],
  currentWeatherIdx: 0,

  // Selected Locations State
  selectedOrigin: null,
  selectedDestination: null,
  originDebounceTimer: null,
  destDebounceTimer: null,

  async init() {
    console.log('[App] Initializing Smart Traffic Dashboard & Global Route Optimizer...');

    // Initialize Map & Charts
    MapManager.init();
    ChartsManager.initAll();

    // Bind Event Listeners
    this.bindEvents();
    this.bindLocationSearch();

    // Initial Data Fetch
    await this.refreshData();

    // Start Telemetry Simulator
    Simulator.init(() => this.refreshData());
  },

  bindEvents() {
    // Weather Simulation Button
    const btnWeather = document.getElementById('btnWeatherSim');
    if (btnWeather) {
      btnWeather.addEventListener('click', async () => {
        this.currentWeatherIdx = (this.currentWeatherIdx + 1) % this.weatherTypes.length;
        const weather = this.weatherTypes[this.currentWeatherIdx];
        const roadCond = weather === 'rain' ? 'wet' : (weather === 'fog' ? 'wet' : 'dry');
        
        document.getElementById('currentWeatherLabel').textContent = weather.toUpperCase();
        await Simulator.setWeather(weather, roadCond);
      });
    }

    // Trigger Accident Button
    const btnAccident = document.getElementById('btnTriggerAccident');
    if (btnAccident) {
      btnAccident.addEventListener('click', async () => {
        const res = await Simulator.triggerRandomAccident();
        if (res && res.success) {
          this.showAlert('ACCIDENT SIMULATED', `New collision reported on ${res.accident.roadName}`);
        }
      });
    }

    // Modal Open Buttons
    document.getElementById('btnOpenPredictorModal').addEventListener('click', () => {
      document.getElementById('predictorModal').classList.remove('hidden');
    });

    document.getElementById('btnOpenMetricsModal').addEventListener('click', async () => {
      await this.showMetricsModal();
    });

    // Route Optimization Form
    document.getElementById('routeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleRouteOptimization();
    });

    // Manual Predictor Form
    document.getElementById('manualPredictForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleManualPrediction();
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-group')) {
        document.getElementById('originSuggestions').classList.add('hidden');
        document.getElementById('destSuggestions').classList.add('hidden');
      }
    });
  },

  bindLocationSearch() {
    const originInput = document.getElementById('originInput');
    const destInput = document.getElementById('destinationInput');

    if (originInput) {
      originInput.addEventListener('input', (e) => {
        this.selectedOrigin = null; // reset selection on edit
        document.getElementById('originSelectedBadge').classList.add('hidden');
        
        clearTimeout(this.originDebounceTimer);
        const query = e.target.value.trim();
        if (query.length < 2) {
          document.getElementById('originSuggestions').classList.add('hidden');
          return;
        }
        document.getElementById('originSpinner').classList.remove('hidden');
        this.originDebounceTimer = setTimeout(() => {
          this.performGeocodeSearch(query, 'origin');
        }, 300);
      });
    }

    if (destInput) {
      destInput.addEventListener('input', (e) => {
        this.selectedDestination = null; // reset selection on edit
        document.getElementById('destSelectedBadge').classList.add('hidden');

        clearTimeout(this.destDebounceTimer);
        const query = e.target.value.trim();
        if (query.length < 2) {
          document.getElementById('destSuggestions').classList.add('hidden');
          return;
        }
        document.getElementById('destSpinner').classList.remove('hidden');
        this.destDebounceTimer = setTimeout(() => {
          this.performGeocodeSearch(query, 'destination');
        }, 300);
      });
    }
  },

  async performGeocodeSearch(query, fieldType) {
    const spinner = document.getElementById(fieldType === 'origin' ? 'originSpinner' : 'destSpinner');
    const dropdown = document.getElementById(fieldType === 'origin' ? 'originSuggestions' : 'destSuggestions');

    const res = await ApiService.searchLocations(query);
    if (spinner) spinner.classList.add('hidden');

    if (!res.success || !res.results || res.results.length === 0) {
      dropdown.innerHTML = `
        <div class="suggestion-item" style="color:#f43f5e;">
          <div class="suggestion-main">Location not found</div>
          <div class="suggestion-sub">Please try a different place name or city.</div>
        </div>
      `;
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = res.results.map(item => `
      <div class="suggestion-item" onclick="App.selectLocation('${fieldType}', '${encodeURIComponent(JSON.stringify(item))}')">
        <div class="suggestion-main">${item.name}</div>
        <div class="suggestion-sub">${item.displayName}</div>
      </div>
    `).join('');

    dropdown.classList.remove('hidden');
  },

  selectLocation(fieldType, encodedItem) {
    const item = JSON.parse(decodeURIComponent(encodedItem));
    if (fieldType === 'origin') {
      this.selectedOrigin = item;
      document.getElementById('originInput').value = item.name;
      document.getElementById('originSuggestions').classList.add('hidden');
      
      const badge = document.getElementById('originSelectedBadge');
      badge.textContent = `Selected Origin: ${item.displayName}`;
      badge.classList.remove('hidden');
    } else {
      this.selectedDestination = item;
      document.getElementById('destinationInput').value = item.name;
      document.getElementById('destSuggestions').classList.add('hidden');

      const badge = document.getElementById('destSelectedBadge');
      badge.textContent = `Selected Destination: ${item.displayName}`;
      badge.classList.remove('hidden');
    }
  },

  async applyPreset(originQuery, destQuery) {
    document.getElementById('originInput').value = originQuery;
    document.getElementById('destinationInput').value = destQuery;

    // Search and auto-pick top results
    const res1 = await ApiService.searchLocations(originQuery);
    if (res1.success && res1.results.length > 0) {
      this.selectLocation('origin', encodeURIComponent(JSON.stringify(res1.results[0])));
    }

    const res2 = await ApiService.searchLocations(destQuery);
    if (res2.success && res2.results.length > 0) {
      this.selectLocation('destination', encodeURIComponent(JSON.stringify(res2.results[0])));
    }

    if (this.selectedOrigin && this.selectedDestination) {
      this.handleRouteOptimization();
    }
  },

  async handleRouteOptimization() {
    if (!this.selectedOrigin || !this.selectedDestination) {
      // Fallback: If user typed text directly without clicking suggestion, search now
      const originText = document.getElementById('originInput').value.trim();
      const destText = document.getElementById('destinationInput').value.trim();

      if (!this.selectedOrigin && originText) {
        const res1 = await ApiService.searchLocations(originText);
        if (res1.success && res1.results.length > 0) {
          this.selectedOrigin = res1.results[0];
          document.getElementById('originSelectedBadge').textContent = `Selected Origin: ${this.selectedOrigin.displayName}`;
          document.getElementById('originSelectedBadge').classList.remove('hidden');
        }
      }

      if (!this.selectedDestination && destText) {
        const res2 = await ApiService.searchLocations(destText);
        if (res2.success && res2.results.length > 0) {
          this.selectedDestination = res2.results[0];
          document.getElementById('destSelectedBadge').textContent = `Selected Destination: ${this.selectedDestination.displayName}`;
          document.getElementById('destSelectedBadge').classList.remove('hidden');
        }
      }

      if (!this.selectedOrigin || !this.selectedDestination) {
        alert('Please enter and select valid Origin and Destination locations.');
        return;
      }
    }

    const btnSubmit = document.getElementById('btnCalculateRoute');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Calculating Driving Route...';

    const res = await ApiService.optimizeRealWorldRoute(this.selectedOrigin, this.selectedDestination);
    
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Find AI-Optimized Driving Route';

    if (!res.success) {
      alert(res.error || 'Failed to calculate driving route.');
      return;
    }

    const resultsContainer = document.getElementById('routeResults');
    resultsContainer.classList.remove('hidden');
    MapManager.clearRoutes();

    const data = res.data;
    MapManager.renderRouteMarkers(
      data.startLocation.lat,
      data.startLocation.lng,
      data.endLocation.lat,
      data.endLocation.lng,
      data.startLocation.name,
      data.endLocation.name
    );

    const routes = data.routes || [];

    const formatMins = (mins) => {
      if (mins < 60) return `${mins} min`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
    };

    resultsContainer.innerHTML = `
      <div class="route-summary-banner">
        <div class="summary-top">
          <span class="route-count-badge">${routes.length} ${routes.length === 1 ? 'Route' : 'Routes'} Found</span>
          <span class="weather-badge">${routes[0].weather.toUpperCase()} WEATHER</span>
        </div>
        <div class="route-od-display">
          <div class="od-box">
            <span class="od-label">Origin</span>
            <span class="od-name">${data.startLocation.name}</span>
          </div>
          <div class="od-arrow">➔</div>
          <div class="od-box">
            <span class="od-label">Destination</span>
            <span class="od-name">${data.endLocation.name}</span>
          </div>
        </div>
      </div>

      ${routes.map((r) => {
        MapManager.drawRoute(r.pathCoordinates, r.isPrimary);
        const displayTime = r.formattedTime || formatMins(r.estimatedTimeMinutes);
        const displayDist = r.formattedDistance || `${r.totalDistanceKm} km`;
        const delayDisplay = r.formattedTrafficDelay || (r.trafficDelayMinutes > 0 ? `+${formatMins(r.trafficDelayMinutes)}` : 'Normal Flow');

        return `
          <div class="route-card ${r.isPrimary ? 'primary' : 'alternative'}">
            <div class="route-card-header">
              <span class="route-name">${r.name}</span>
              ${r.isPrimary ? '<span class="primary-pill">AI OPTIMIZED</span>' : '<span class="alt-pill">ALT</span>'}
            </div>

            <div class="route-stats-grid">
              <div class="stat-box">
                <span class="stat-label">Total Distance</span>
                <span class="stat-val text-cyan">${displayDist}</span>
              </div>
              <div class="stat-box">
                <span class="stat-label">Estimated Travel Time</span>
                <span class="stat-val text-emerald">${displayTime}</span>
              </div>
            </div>

            <div class="route-details-list">
              <div class="detail-row">
                <span>Safety Rating:</span>
                <b style="color:${r.accidentRisk === 'High' ? '#f43f5e' : (r.accidentRisk === 'Medium' ? '#f59e0b' : '#10b981')}">${r.safetyRating}</b>
              </div>
              <div class="detail-row">
                <span>Weather / Traffic Delay:</span>
                <b style="color:${r.trafficDelayMinutes > 0 ? '#f59e0b' : '#10b981'}">${delayDisplay}</b>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    `;
  },

  async refreshData() {
    const overview = await ApiService.fetchOverview();
    const evalData = await ApiService.fetchAllEvaluations();

    if (!overview.success) return;

    this.roads = overview.roads || [];
    this.intersections = overview.intersections || [];
    this.evaluationsList = evalData.success ? evalData.evaluations : [];

    this.evaluations = {};
    this.evaluationsList.forEach(ev => {
      this.evaluations[ev.roadId] = ev;
    });

    // Render Components
    this.renderMetrics(overview.summary);
    MapManager.renderIntersections(this.intersections);
    MapManager.renderRoads(this.roads, this.evaluations);
    MapManager.renderAccidents(overview.recentAccidents);
    ChartsManager.updateCharts(this.roads, this.evaluationsList);
    this.renderEvents(overview.recentEvents);
    this.renderTable();
    this.checkGlobalAlerts();
  },

  renderMetrics(summary) {
    if (!summary) return;
    document.getElementById('valTotalRoads').textContent = summary.totalRoads;
    document.getElementById('valAvgDensity').textContent = `${summary.avgDensity}%`;
    document.getElementById('valAvgSpeed').textContent = `Avg Speed: ${summary.avgSpeed} km/h`;
    document.getElementById('valActiveAccidents').textContent = summary.activeAccidents;

    let highRiskCount = 0;
    this.evaluationsList.forEach(ev => { if (ev.accidentRisk === 'High') highRiskCount++; });
    document.getElementById('valHighRiskZones').textContent = `${highRiskCount} High Risk Zones`;
    
    document.getElementById('valSystemStatus').textContent = summary.systemHealth;
    document.getElementById('valSystemStatus').className = summary.systemHealth === 'Optimal' ? 'metric-value text-emerald' : 'metric-value text-rose';
  },

  renderEvents(events) {
    const container = document.getElementById('eventsList');
    if (!container || !events) return;

    container.innerHTML = events.map(evt => `
      <div class="event-item">
        <div class="event-item-title">
          <span>${evt.title}</span>
          <span class="event-time">${new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="event-desc">${evt.message}</div>
      </div>
    `).join('');
  },

  renderTable() {
    const tbody = document.getElementById('trafficTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.roads.map(road => {
      const ev = this.evaluations[road.id] || {};
      const risk = ev.accidentRisk || 'Low';
      const status = ev.congestionStatus || 'Smooth';

      let riskBadgeClass = 'badge-green';
      if (risk === 'Medium') riskBadgeClass = 'badge-yellow';
      if (risk === 'High') riskBadgeClass = 'badge-darkred';

      return `
        <tr>
          <td><strong>${road.name}</strong></td>
          <td>${road.currentSpeed} km/h</td>
          <td>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span>${road.density}%</span>
              <div style="flex:1; background:#334155; height:6px; border-radius:3px; overflow:hidden;">
                <div style="width:${road.density}%; background:${road.density > 75 ? '#f43f5e' : (road.density > 50 ? '#f59e0b' : '#10b981')}; height:100%;"></div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-secondary">${road.weather}</span></td>
          <td>${road.roadCondition}</td>
          <td><span class="badge ${status === 'Severe' ? 'badge-red' : (status === 'Heavy' ? 'badge-yellow' : 'badge-green')}">${status}</span></td>
          <td><span class="badge ${riskBadgeClass}">${risk}</span></td>
          <td>
            <button class="btn btn-outline" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="App.inspectRoad('${road.id}')">Inspect</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async handleManualPrediction() {
    const input = {
      density: Number(document.getElementById('predDensity').value),
      speed: Number(document.getElementById('predSpeed').value),
      speedLimit: Number(document.getElementById('predSpeedLimit').value),
      weather: document.getElementById('predWeather').value,
      roadCondition: document.getElementById('predRoad').value,
      timeOfDay: document.getElementById('predTime').value
    };

    const res = await ApiService.predictAccidentRisk(input);
    if (!res.success) return;

    const p = res.prediction;
    const box = document.getElementById('predResultBox');
    box.classList.remove('hidden');

    let badgeClass = 'text-emerald';
    if (p.accidentRisk === 'Medium') badgeClass = 'text-amber';
    if (p.accidentRisk === 'High') badgeClass = 'text-rose';

    box.innerHTML = `
      <h4 style="margin-bottom:0.5rem;">AI Prediction Outcome</h4>
      <div style="font-size:1.1rem; font-weight:700;" class="${badgeClass}">
        Accident Risk: ${p.accidentRisk} (${p.confidence}% Confidence)
      </div>
      <div style="font-size:0.85rem; color:#94a3b8; margin-top:0.5rem;">
        <b>Probabilities:</b> Low (${(p.probabilities.Low * 100).toFixed(0)}%), Med (${(p.probabilities.Medium * 100).toFixed(0)}%), High (${(p.probabilities.High * 100).toFixed(0)}%)
      </div>
      <div style="font-size:0.85rem; margin-top:0.5rem;">
        <b>Contributing Factors:</b>
        <ul style="padding-left:1.2rem; color:#cbd5e1;">
          ${p.contributingFactors.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
    `;
  },

  async showMetricsModal() {
    const res = await ApiService.fetchModelMetrics();
    if (!res.success) return;

    const m = res.metrics;
    const container = document.getElementById('metricsContainer');
    document.getElementById('metricsModal').classList.remove('hidden');

    // Update charts feature importances
    ChartsManager.updateFeatureImportances(m.featureImportances);

    container.innerHTML = `
      <div class="metrics-summary-grid" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; margin-bottom:1.5rem;">
        <div style="background:#0f172a; padding:1rem; border-radius:8px; text-align:center;">
          <div style="font-size:0.8rem; color:#94a3b8;">Validation Accuracy</div>
          <div style="font-size:1.8rem; font-weight:700; color:#10b981;">${(m.accuracy * 100).toFixed(2)}%</div>
        </div>
        <div style="background:#0f172a; padding:1rem; border-radius:8px; text-align:center;">
          <div style="font-size:0.8rem; color:#94a3b8;">Macro F1-Score</div>
          <div style="font-size:1.8rem; font-weight:700; color:#06b6d4;">${m.macroF1}</div>
        </div>
        <div style="background:#0f172a; padding:1rem; border-radius:8px; text-align:center;">
          <div style="font-size:0.8rem; color:#94a3b8;">Validation Samples</div>
          <div style="font-size:1.8rem; font-weight:700; color:#3b82f6;">${m.testSampleCount}</div>
        </div>
      </div>

      <h4 style="margin-bottom:0.75rem;">Confusion Matrix (Actual vs Predicted)</h4>
      <table class="traffic-table" style="margin-bottom:1.5rem;">
        <thead>
          <tr><th>Actual / Predicted</th><th>Low</th><th>Medium</th><th>High</th></tr>
        </thead>
        <tbody>
          <tr><td><b>Actual Low</b></td><td>${m.confusionMatrix.Low.Low}</td><td>${m.confusionMatrix.Low.Medium}</td><td>${m.confusionMatrix.Low.High}</td></tr>
          <tr><td><b>Actual Medium</b></td><td>${m.confusionMatrix.Medium.Low}</td><td>${m.confusionMatrix.Medium.Medium}</td><td>${m.confusionMatrix.Medium.High}</td></tr>
          <tr><td><b>Actual High</b></td><td>${m.confusionMatrix.High.Low}</td><td>${m.confusionMatrix.High.Medium}</td><td>${m.confusionMatrix.High.High}</td></tr>
        </tbody>
      </table>
    `;
  },

  checkGlobalAlerts() {
    const highRisk = this.evaluationsList.find(ev => ev.accidentRisk === 'High');
    const alertBanner = document.getElementById('alertBanner');
    if (highRisk && alertBanner) {
      alertBanner.classList.remove('hidden');
      document.getElementById('alertMessage').textContent = `High accident risk detected on ${highRisk.roadName} (Density: ${highRisk.currentDensity}%, Weather: ${highRisk.weather}).`;
    }
  },

  inspectRoad(roadId) {
    const road = this.roads.find(r => r.id === roadId);
    if (road) {
      document.getElementById('predDensity').value = road.density;
      document.getElementById('predSpeed').value = road.currentSpeed;
      document.getElementById('predSpeedLimit').value = road.speedLimit;
      document.getElementById('predWeather').value = road.weather;
      document.getElementById('predRoad').value = road.roadCondition;
      document.getElementById('predictorModal').classList.remove('hidden');
      this.handleManualPrediction();
    }
  },

  showAlert(badge, message) {
    const alertBanner = document.getElementById('alertBanner');
    if (!alertBanner) return;
    document.getElementById('alertBadge').textContent = badge;
    document.getElementById('alertMessage').textContent = message;
    alertBanner.classList.remove('hidden');
  }
};
