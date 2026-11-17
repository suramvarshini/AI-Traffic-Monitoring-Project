/**
 * REST API Service Client
 * Handles HTTP requests between the browser dashboard and the backend API server / Netlify Functions.
 */

const API_BASE = '/api';

const ApiService = {
  async fetchOverview() {
    try {
      const res = await fetch(`${API_BASE}/traffic/overview`);
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error fetching overview:', err);
      return { success: false, error: err.message };
    }
  },

  async updateTelemetry(telemetryData) {
    try {
      const res = await fetch(`${API_BASE}/traffic/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telemetryData)
      });
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error updating telemetry:', err);
      return { success: false, error: err.message };
    }
  },

  async updateWeather(weather, roadCondition) {
    try {
      const res = await fetch(`${API_BASE}/traffic/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weather, roadCondition })
      });
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error updating weather:', err);
      return { success: false, error: err.message };
    }
  },

  async reportAccident(accidentData) {
    try {
      const res = await fetch(`${API_BASE}/traffic/accident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accidentData)
      });
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error reporting accident:', err);
      return { success: false, error: err.message };
    }
  },

  async predictAccidentRisk(inputData) {
    try {
      const res = await fetch(`${API_BASE}/predict/accident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputData)
      });
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error predicting accident risk:', err);
      return { success: false, error: err.message };
    }
  },

  async predictCongestion(inputData) {
    try {
      const res = await fetch(`${API_BASE}/predict/congestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputData)
      });
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error predicting congestion:', err);
      return { success: false, error: err.message };
    }
  },

  async fetchAllEvaluations() {
    try {
      const res = await fetch(`${API_BASE}/predict/all-roads`);
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error fetching road evaluations:', err);
      return { success: false, error: err.message };
    }
  },

  async fetchModelMetrics() {
    try {
      const res = await fetch(`${API_BASE}/ml/metrics`);
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error fetching ML metrics:', err);
      return { success: false, error: err.message };
    }
  },

  async optimizeRoute(startNodeId, endNodeId) {
    try {
      const res = await fetch(`${API_BASE}/routes/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNodeId, endNodeId })
      });
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error optimizing route:', err);
      return { success: false, error: err.message };
    }
  },

  async searchLocations(query) {
    try {
      const res = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(query)}`);
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error searching location:', err);
      return { success: false, error: 'Network error searching location.' };
    }
  },

  async optimizeRealWorldRoute(startLocation, endLocation) {
    try {
      const res = await fetch(`${API_BASE}/routes/real-world`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startLocation, end: endLocation })
      });
      return await res.json();
    } catch (err) {
      console.error('[ApiService] Error calculating real-world route:', err);
      return { success: false, error: 'Network error calculating route.' };
    }
  }
};
