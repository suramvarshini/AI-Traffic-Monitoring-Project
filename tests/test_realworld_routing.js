/**
 * Automated Verification Test Suite for Real-World Global Location Search & Driving Route Optimizer
 */

const assert = require('assert');
const { searchLocation } = require('../src/backend/controllers/geocodeController');
const { optimizeRealWorldRoute, formatTravelTime, formatDistance } = require('../src/backend/controllers/routeController');

console.log('---------------------------------------------------------');
console.log(' RUNNING REAL-WORLD GLOBAL ROUTE OPTIMIZER TEST SUITE    ');
console.log('---------------------------------------------------------');

function mockRes() {
  let statusCode = 200;
  let jsonResult = null;
  return {
    status: (code) => { statusCode = code; return this; },
    json: (data) => { jsonResult = data; return data; },
    getStatusCode: () => statusCode,
    getResult: () => jsonResult
  };
}

async function runTests() {
  try {
    // Test 0: Travel Time & Distance Formatter Helpers
    console.log('\n[Test 0] Testing Time & Distance Formatting Helpers...');
    assert.strictEqual(formatTravelTime(45), '45 min');
    assert.strictEqual(formatTravelTime(125), '2 hr 5 min');
    assert.strictEqual(formatTravelTime(263), '4 hr 23 min');
    assert.strictEqual(formatDistance(2.4), '2.4 km');
    assert.strictEqual(formatDistance(273.5), '273.5 km');
    console.log(' -> PASS: Formatter helpers correctly output "4 hr 23 min" and "273.5 km".');

    // Test 1: Geocoding Location Search - Bengaluru
    console.log('\n[Test 1] Searching location "Bengaluru"...');
    const req1 = { query: { q: 'Bengaluru' } };
    const res1 = mockRes();
    
    await new Promise((resolve) => {
      const customRes = {
        status: (c) => { res1.status(c); return customRes; },
        json: (data) => { res1.json(data); resolve(); }
      };
      searchLocation(req1, customRes);
    });

    const result1 = res1.getResult();
    assert(result1.success, 'Bengaluru search should succeed');
    assert(result1.results.length > 0, 'Should return at least 1 location result');
    console.log(` -> PASS: Found ${result1.results.length} results. Top match: "${result1.results[0].displayName}" (${result1.results[0].lat}, ${result1.results[0].lng})`);

    // Test 2: Geocoding Location Search - Chennai
    console.log('\n[Test 2] Searching location "Chennai"...');
    const req2 = { query: { q: 'Chennai' } };
    const res2 = mockRes();

    await new Promise((resolve) => {
      const customRes = {
        status: (c) => { res2.status(c); return customRes; },
        json: (data) => { res2.json(data); resolve(); }
      };
      searchLocation(req2, customRes);
    });

    const result2 = res2.getResult();
    assert(result2.success, 'Chennai search should succeed');
    console.log(` -> PASS: Top match: "${result2.results[0].displayName}" (${result2.results[0].lat}, ${result2.results[0].lng})`);

    // Test 3: Real-World Driving Route Calculation - Bengaluru -> Chennai
    console.log('\n[Test 3] Calculating Driving Route: Bengaluru -> Chennai...');
    const reqRoute1 = {
      body: {
        start: { name: 'Bengaluru', lat: result1.results[0].lat, lng: result1.results[0].lng },
        end: { name: 'Chennai', lat: result2.results[0].lat, lng: result2.results[0].lng }
      }
    };
    const resRoute1 = mockRes();

    await new Promise((resolve) => {
      const customRes = {
        status: (c) => { resRoute1.status(c); return customRes; },
        json: (data) => { resRoute1.json(data); resolve(); }
      };
      optimizeRealWorldRoute(reqRoute1, customRes);
    });

    const routeData1 = resRoute1.getResult();
    assert(routeData1.success, 'Bengaluru -> Chennai route calculation should succeed');
    const primary1 = routeData1.data.routes[0];
    assert(primary1.totalDistanceKm > 300, 'Distance between Bengaluru and Chennai should be > 300 km');
    assert(primary1.formattedTime.includes('hr') || primary1.formattedTime.includes('min'), 'Formatted time present');
    assert(primary1.formattedDistance.includes('km'), 'Formatted distance present');
    console.log(` -> PASS: Route Bengaluru -> Chennai calculated!`);
    console.log(`          Distance: ${primary1.formattedDistance} (${primary1.totalDistanceKm} km)`);
    console.log(`          Estimated Travel Time: ${primary1.formattedTime}`);
    console.log(`          Safety Rating: ${primary1.safetyRating}`);
    console.log(`          Traffic Delay: ${primary1.formattedTrafficDelay}`);
    console.log(`          Routes Found: ${routeData1.data.routesCount}`);

    // Test 4: Real-World Route Calculation - Hyderabad -> Vijayawada
    console.log('\n[Test 4] Calculating Driving Route: Hyderabad -> Vijayawada...');
    const reqRoute2 = {
      body: {
        start: { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
        end: { name: 'Vijayawada', lat: 16.5062, lng: 80.6480 }
      }
    };
    const resRoute2 = mockRes();

    await new Promise((resolve) => {
      const customRes = {
        status: (c) => { resRoute2.status(c); return customRes; },
        json: (data) => { resRoute2.json(data); resolve(); }
      };
      optimizeRealWorldRoute(reqRoute2, customRes);
    });

    const routeData2 = resRoute2.getResult();
    assert(routeData2.success, 'Hyderabad -> Vijayawada route calculation should succeed');
    const primary2 = routeData2.data.routes[0];
    assert(primary2.totalDistanceKm > 200, 'Distance between Hyderabad and Vijayawada should be > 200 km');
    console.log(` -> PASS: Route Hyderabad -> Vijayawada calculated!`);
    console.log(`          Distance: ${primary2.formattedDistance} (${primary2.totalDistanceKm} km)`);
    console.log(`          Estimated Travel Time: ${primary2.formattedTime}`);
    console.log(`          Safety Rating: ${primary2.safetyRating}`);

    // Test 5: Invalid Location Error Handling
    console.log('\n[Test 5] Testing Invalid Location Query "xyz999invalidlocation"...');
    const reqInvalid = { query: { q: 'xyz999invalidlocation' } };
    const resInvalid = mockRes();

    await new Promise((resolve) => {
      const customRes = {
        status: (c) => { resInvalid.status(c); return customRes; },
        json: (data) => { resInvalid.json(data); resolve(); }
      };
      searchLocation(reqInvalid, customRes);
    });

    const resultInvalid = resInvalid.getResult();
    assert.strictEqual(resultInvalid.success, false, 'Invalid search should return success = false');
    assert(resultInvalid.error.includes('Location not found'), 'Should contain "Location not found" error message');
    console.log(` -> PASS: Invalid location query handled gracefully: "${resultInvalid.error}"`);

    console.log('\n---------------------------------------------------------');
    console.log(' ALL REAL-WORLD ROUTING TESTS PASSED SUCCESSFULLY!       ');
    console.log('---------------------------------------------------------');

  } catch (err) {
    console.error('\n[Test Failure]', err);
    process.exit(1);
  }
}

runTests();
