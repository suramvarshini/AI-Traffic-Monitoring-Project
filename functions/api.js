/**
 * Netlify Serverless Function Entrypoint
 * Handles all REST API routes (/api/*) in production on Netlify.
 */

const trafficController = require('../src/backend/controllers/trafficController');
const predictController = require('../src/backend/controllers/predictController');
const routeController = require('../src/backend/controllers/routeController');
const geocodeController = require('../src/backend/controllers/geocodeController');
const predictor = require('../src/ml/predictor');

// Ensure ML Model is initialized in serverless warm execution context
if (!predictor.isTrained) {
  console.log('[Netlify Function] Initializing ML Predictor engine...');
  predictor.init();
}

function buildResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async (event, context) => {
  const httpMethod = event.httpMethod;

  // Handle CORS Preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  // Parse relative sub-path (e.g. /traffic/overview)
  let subPath = event.path || '';
  subPath = subPath.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '');
  if (!subPath.startsWith('/')) subPath = '/' + subPath;

  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = {};
    }
  }

  // Express-style request / response wrappers for controller compatibility
  const req = {
    method: httpMethod,
    path: subPath,
    body,
    query: event.queryStringParameters || {}
  };

  let responseData = null;
  let responseStatusCode = 200;

  const res = {
    status: function (code) {
      responseStatusCode = code;
      return this;
    },
    json: function (data) {
      responseData = data;
    }
  };

  try {
    if (subPath === '/traffic/overview' && httpMethod === 'GET') {
      trafficController.getTrafficOverview(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/traffic/update' && httpMethod === 'POST') {
      trafficController.updateRoadTelemetry(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/traffic/weather' && httpMethod === 'POST') {
      trafficController.updateGlobalWeather(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/traffic/accident' && httpMethod === 'POST') {
      trafficController.reportAccident(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/predict/accident' && httpMethod === 'POST') {
      predictController.predictAccidentRisk(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/predict/congestion' && httpMethod === 'POST') {
      predictController.predictCongestion(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/predict/all-roads' && httpMethod === 'GET') {
      predictController.evaluateAllRoads(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/ml/metrics' && httpMethod === 'GET') {
      predictController.getModelMetrics(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/routes/optimize' && httpMethod === 'POST') {
      routeController.optimizeRoute(req, res);
      return buildResponse(responseStatusCode, responseData);
    } else if (subPath === '/routes/real-world' && httpMethod === 'POST') {
      return new Promise((resolve) => {
        routeController.optimizeRealWorldRoute(req, {
          status: (code) => { responseStatusCode = code; return this; },
          json: (data) => resolve(buildResponse(responseStatusCode, data))
        });
      });
    } else if (subPath === '/geocode' && httpMethod === 'GET') {
      return new Promise((resolve) => {
        geocodeController.searchLocation(req, {
          status: (code) => { responseStatusCode = code; return this; },
          json: (data) => resolve(buildResponse(responseStatusCode, data))
        });
      });
    } else {
      return buildResponse(404, { success: false, error: `Endpoint ${subPath} not found` });
    }
  } catch (err) {
    console.error('[Netlify Function Error]', err);
    return buildResponse(500, { success: false, error: err.message });
  }
};
