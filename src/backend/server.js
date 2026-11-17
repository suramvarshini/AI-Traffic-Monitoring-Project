/**
 * Standalone Node.js REST API & Static Web Server
 * AI-Powered Smart Traffic Monitoring and Accident Prediction System
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const trafficController = require('./controllers/trafficController');
const predictController = require('./controllers/predictController');
const routeController = require('./controllers/routeController');
const geocodeController = require('./controllers/geocodeController');
const predictor = require('../ml/predictor');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
  });
}

function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Initialize ML Engine on startup
console.log('===========================================================');
console.log('   AI-POWERED SMART TRAFFIC MONITORING & PREDICTION SYSTEM ');
console.log('===========================================================');
console.log('[Server] Initializing AI Machine Learning Model...');
predictor.init();

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // Wrap express-style res object helpers
  const customRes = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      sendJsonResponse(res, this.statusCode || 200, data);
    }
  };

  // API Routes
  if (pathname.startsWith('/api/')) {
    req.body = await parseJsonBody(req);
    req.query = parsedUrl.query;

    if (pathname === '/api/traffic/overview' && method === 'GET') {
      return trafficController.getTrafficOverview(req, customRes);
    }
    if (pathname === '/api/traffic/update' && method === 'POST') {
      return trafficController.updateRoadTelemetry(req, customRes);
    }
    if (pathname === '/api/traffic/weather' && method === 'POST') {
      return trafficController.updateGlobalWeather(req, customRes);
    }
    if (pathname === '/api/traffic/accident' && method === 'POST') {
      return trafficController.reportAccident(req, customRes);
    }
    if (pathname === '/api/predict/accident' && method === 'POST') {
      return predictController.predictAccidentRisk(req, customRes);
    }
    if (pathname === '/api/predict/congestion' && method === 'POST') {
      return predictController.predictCongestion(req, customRes);
    }
    if (pathname === '/api/predict/all-roads' && method === 'GET') {
      return predictController.evaluateAllRoads(req, customRes);
    }
    if (pathname === '/api/ml/metrics' && method === 'GET') {
      return predictController.getModelMetrics(req, customRes);
    }
    if (pathname === '/api/routes/optimize' && method === 'POST') {
      return routeController.optimizeRoute(req, customRes);
    }
    if (pathname === '/api/routes/real-world' && method === 'POST') {
      return routeController.optimizeRealWorldRoute(req, customRes);
    }
    if (pathname === '/api/geocode' && method === 'GET') {
      return geocodeController.searchLocation(req, customRes);
    }

    return sendJsonResponse(res, 404, { success: false, error: 'API endpoint not found' });
  }

  // Serve Frontend Static Files
  let filePath = path.join(FRONTEND_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(FRONTEND_DIR, 'index.html'); // SPA Fallback
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Traffic Management Platform is live at: http://localhost:${PORT}`);
  console.log(`[Server] REST API endpoints available under http://localhost:${PORT}/api/`);
});
