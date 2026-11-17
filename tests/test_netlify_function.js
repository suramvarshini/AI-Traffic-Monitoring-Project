/**
 * Test Netlify Serverless Function Handler
 */

const assert = require('assert');
const { handler } = require('../functions/api');

async function runNetlifyFunctionTests() {
  console.log('---------------------------------------------------------');
  console.log(' TESTING NETLIFY SERVERLESS FUNCTION HANDLER (api.js)   ');
  console.log('---------------------------------------------------------');

  // Test 1: GET /api/traffic/overview
  const event1 = {
    httpMethod: 'GET',
    path: '/api/traffic/overview'
  };

  const res1 = await handler(event1, {});
  assert.strictEqual(res1.statusCode, 200, 'Overview endpoint should return 200');
  const body1 = JSON.parse(res1.body);
  assert(body1.success, 'Overview response should be successful');
  assert(body1.roads.length > 0, 'Overview should contain roads');
  console.log(' -> PASS: GET /api/traffic/overview serverless handler returned 200 OK.');

  // Test 2: POST /api/predict/accident
  const event2 = {
    httpMethod: 'POST',
    path: '/api/predict/accident',
    body: JSON.stringify({
      density: 85,
      speed: 20,
      weather: 'storm',
      roadCondition: 'wet'
    })
  };

  const res2 = await handler(event2, {});
  assert.strictEqual(res2.statusCode, 200, 'Predict accident endpoint should return 200');
  const body2 = JSON.parse(res2.body);
  assert(body2.success, 'Prediction response should be successful');
  assert(['Low', 'Medium', 'High'].includes(body2.prediction.accidentRisk), 'Accident risk prediction valid');
  console.log(` -> PASS: POST /api/predict/accident serverless handler returned ${body2.prediction.accidentRisk} risk.`);

  // Test 3: POST /api/routes/optimize
  const event3 = {
    httpMethod: 'POST',
    path: '/api/routes/optimize',
    body: JSON.stringify({
      startNodeId: 'INT-1',
      endNodeId: 'INT-6'
    })
  };

  const res3 = await handler(event3, {});
  assert.strictEqual(res3.statusCode, 200, 'Route optimization endpoint should return 200');
  const body3 = JSON.parse(res3.body);
  assert(body3.success, 'Route optimization response should be successful');
  console.log(` -> PASS: POST /api/routes/optimize serverless handler calculated ${body3.data.routesCount} routes.`);

  console.log('\n---------------------------------------------------------');
  console.log(' NETLIFY SERVERLESS FUNCTION TEST PASSED SUCCESSFULLY!  ');
  console.log('---------------------------------------------------------');
}

runNetlifyFunctionTests().catch(err => {
  console.error('[Netlify Function Test Failed]', err);
  process.exit(1);
});
