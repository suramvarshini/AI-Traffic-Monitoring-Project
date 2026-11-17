/**
 * AI/ML Prediction & Model Evaluation Controller
 */

const predictor = require('../../ml/predictor');
const db = require('../db');

function predictAccidentRisk(req, res) {
  try {
    const input = req.body || {};
    const result = predictor.predictAccidentRisk(input);
    return res.json({
      success: true,
      prediction: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function predictCongestion(req, res) {
  try {
    const input = req.body || {};
    const result = predictor.predictCongestion(input);
    return res.json({
      success: true,
      prediction: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function getModelMetrics(req, res) {
  try {
    const metrics = predictor.getMetrics();
    return res.json({
      success: true,
      metrics
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function evaluateAllRoads(req, res) {
  try {
    const roads = db.getRoads();
    const evaluated = roads.map(road => {
      const accidentRisk = predictor.predictAccidentRisk({
        density: road.density,
        speed: road.currentSpeed,
        speedLimit: road.speedLimit,
        weather: road.weather,
        roadCondition: road.roadCondition,
        historicalAccidents: road.historicalAccidents
      });

      const congestion = predictor.predictCongestion({
        density: road.density,
        speed: road.currentSpeed,
        weather: road.weather
      });

      return {
        roadId: road.id,
        roadName: road.name,
        currentDensity: road.density,
        currentSpeed: road.currentSpeed,
        weather: road.weather,
        roadCondition: road.roadCondition,
        accidentRisk: accidentRisk.accidentRisk,
        riskConfidence: accidentRisk.confidence,
        riskProbabilities: accidentRisk.probabilities,
        contributingFactors: accidentRisk.contributingFactors,
        congestionIndex: congestion.congestionIndex,
        congestionStatus: congestion.status,
        forecasts: congestion.forecasts
      };
    });

    return res.json({
      success: true,
      roadsCount: evaluated.length,
      evaluations: evaluated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  predictAccidentRisk,
  predictCongestion,
  getModelMetrics,
  evaluateAllRoads
};
