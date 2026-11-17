/**
 * Automated Test Suite for AI Traffic Monitoring & Accident Prediction System
 */

const assert = require('assert');
const path = require('path');
const db = require('../src/backend/db');
const predictor = require('../src/ml/predictor');
const RoadGraph = require('../src/backend/graph');

console.log('---------------------------------------------------------');
console.log(' RUNNING AI TRAFFIC SYSTEM AUTOMATED VERIFICATION SUITE  ');
console.log('---------------------------------------------------------');

try {
  // Test 1: Database Loading
  console.log('\n[Test 1] Testing Database Loading...');
  const roads = db.getRoads();
  const intersections = db.getIntersections();
  assert(roads.length > 0, 'Database should contain road segments');
  assert(intersections.length > 0, 'Database should contain intersections');
  console.log(` -> PASS: Database loaded ${roads.length} roads and ${intersections.length} intersections.`);

  // Test 2: AI ML Model Initialization & Accuracy Benchmark
  console.log('\n[Test 2] Testing AI ML Model Training & Accuracy Metrics...');
  const metrics = predictor.init();
  assert(metrics.accuracy > 0.70, 'AI Model validation accuracy should be at least 70%');
  assert(metrics.confusionMatrix, 'Metrics must include Confusion Matrix');
  assert(metrics.featureImportances, 'Metrics must include Feature Importances');
  console.log(` -> PASS: Model trained successfully! Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%, Macro F1: ${metrics.macroF1}`);

  // Test 3: Accident Risk & Congestion Prediction Inference
  console.log('\n[Test 3] Testing AI Inference Engine...');
  const riskEval = predictor.predictAccidentRisk({
    density: 90,
    speed: 15,
    speedLimit: 60,
    weather: 'storm',
    roadCondition: 'wet',
    historicalAccidents: 6
  });

  assert(['Low', 'Medium', 'High'].includes(riskEval.accidentRisk), 'Accident risk must be Low, Medium, or High');
  assert(riskEval.accidentRisk === 'High', 'Severe density + storm + wet road should predict High Risk');
  console.log(` -> PASS: Inference predicted High Accident Risk (${riskEval.confidence}% confidence).`);

  const congestionEval = predictor.predictCongestion({ density: 85, speed: 15, weather: 'storm' });
  assert(congestionEval.congestionIndex >= 70, 'Congestion index should reflect high density');
  console.log(` -> PASS: Congestion index predicted: ${congestionEval.congestionIndex}% (${congestionEval.status}).`);

  // Test 4: Route Optimization (Dijkstra Pathfinding)
  console.log('\n[Test 4] Testing Route Optimization Engine (Dijkstra Graph)...');
  const graph = new RoadGraph(intersections, roads);
  const routeResult = graph.findRoutes('INT-1', 'INT-6');
  assert(routeResult.routes && routeResult.routes.length > 0, 'Pathfinder must return at least one route');
  const primary = routeResult.routes[0];
  assert(primary.totalDistanceKm > 0, 'Route distance must be greater than 0');
  assert(primary.waypoints.includes('INT-1'), 'Route must start at INT-1');
  assert(primary.waypoints.includes('INT-6'), 'Route must end at INT-6');
  console.log(` -> PASS: Route found from INT-1 to INT-6. Distance: ${primary.totalDistanceKm} km, ETA: ${primary.estimatedTimeMinutes} mins.`);

  console.log('\n---------------------------------------------------------');
  console.log(' ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (4/4)       ');
  console.log('---------------------------------------------------------');

} catch (err) {
  console.error('\n[Test Failure] Error executing automated tests:', err);
  process.exit(1);
}
