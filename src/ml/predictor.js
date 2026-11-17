/**
 * AI Prediction Engine & Evaluation Metrics Manager
 * Manages model training, risk evaluation, and performance metrics (Accuracy, Precision, Recall, F1, Confusion Matrix).
 */

const path = require('path');
const fs = require('fs');
const { RandomForestClassifier } = require('./MLClassifier');
const { generateDataset } = require('./datasetGenerator');

const FEATURES = ['density', 'speed', 'speedLimit', 'weather', 'roadCondition', 'timeOfDay', 'historicalAccidents'];
const TARGET_KEY = 'accidentRisk';
const CLASSES = ['Low', 'Medium', 'High'];

class TrafficPredictor {
  constructor() {
    this.model = new RandomForestClassifier({ numTrees: 15, maxDepth: 7 });
    this.isTrained = false;
    this.metrics = null;
    this.datasetPath = path.join(__dirname, '../../data/sample_dataset.json');
  }

  init(dataset = null) {
    let trainData = dataset;
    if (!trainData) {
      if (fs.existsSync(this.datasetPath)) {
        trainData = JSON.parse(fs.readFileSync(this.datasetPath, 'utf-8'));
      } else {
        trainData = generateDataset(1200, this.datasetPath);
      }
    }

    // Split 80% train, 20% validation
    const shuffle = [...trainData].sort(() => 0.5 - Math.random());
    const splitIndex = Math.floor(shuffle.length * 0.8);
    const trainSet = shuffle.slice(0, splitIndex);
    const testSet = shuffle.slice(splitIndex);

    console.log(`[TrafficPredictor] Training Random Forest on ${trainSet.length} samples, validating on ${testSet.length} samples...`);
    this.model.fit(trainSet, FEATURES, TARGET_KEY);
    this.isTrained = true;

    // Evaluate performance metrics
    this.metrics = this.evaluateModel(testSet);
    console.log(`[TrafficPredictor] Training completed! Model Accuracy: ${(this.metrics.accuracy * 100).toFixed(2)}%`);
    return this.metrics;
  }

  evaluateModel(testSet) {
    let correctCount = 0;
    // Confusion Matrix structure: [Actual][Predicted]
    const confusionMatrix = {
      Low: { Low: 0, Medium: 0, High: 0 },
      Medium: { Low: 0, Medium: 0, High: 0 },
      High: { Low: 0, Medium: 0, High: 0 }
    };

    for (const sample of testSet) {
      const actual = sample[TARGET_KEY];
      const { prediction } = this.model.predict(sample);
      if (confusionMatrix[actual] && confusionMatrix[actual][prediction] !== undefined) {
        confusionMatrix[actual][prediction]++;
      }
      if (prediction === actual) correctCount++;
    }

    const total = testSet.length;
    const accuracy = parseFloat((correctCount / total).toFixed(4));

    // Calculate Precision, Recall, F1 for each class
    const classMetrics = {};
    let macroF1Sum = 0;

    for (const cls of CLASSES) {
      let tp = confusionMatrix[cls][cls];
      let fp = 0;
      let fn = 0;

      for (const other of CLASSES) {
        if (other !== cls) {
          fp += confusionMatrix[other][cls]; // Predicted cls, but actually other
          fn += confusionMatrix[cls][other]; // Actually cls, but predicted other
        }
      }

      const precision = (tp + fp) > 0 ? parseFloat((tp / (tp + fp)).toFixed(4)) : 0;
      const recall = (tp + fn) > 0 ? parseFloat((tp / (tp + fn)).toFixed(4)) : 0;
      const f1 = (precision + recall) > 0 ? parseFloat((2 * (precision * recall) / (precision + recall)).toFixed(4)) : 0;

      classMetrics[cls] = { precision, recall, f1, tp, fp, fn };
      macroF1Sum += f1;
    }

    const macroF1 = parseFloat((macroF1Sum / CLASSES.length).toFixed(4));

    return {
      accuracy,
      macroF1,
      confusionMatrix,
      classMetrics,
      featureImportances: this.model.featureImportances,
      testSampleCount: total
    };
  }

  predictAccidentRisk(inputData) {
    if (!this.isTrained) this.init();

    // Fill defaults for missing fields
    const sample = {
      density: inputData.density || 30,
      speed: inputData.speed || 50,
      speedLimit: inputData.speedLimit || 60,
      weather: inputData.weather || 'clear',
      roadCondition: inputData.roadCondition || 'dry',
      timeOfDay: inputData.timeOfDay || 'daytime',
      historicalAccidents: inputData.historicalAccidents !== undefined ? inputData.historicalAccidents : 2
    };

    const res = this.model.predict(sample);

    // Identify primary contributing risk factors
    const riskFactors = [];
    if (sample.density > 70) riskFactors.push('Severe Traffic Density');
    if (sample.weather !== 'clear') riskFactors.push(`Hazardous Weather (${sample.weather})`);
    if (sample.roadCondition !== 'dry') riskFactors.push(`Slippery Road (${sample.roadCondition})`);
    if (sample.speed > sample.speedLimit * 0.9 && sample.density > 60) riskFactors.push('Unsafe Speed relative to Density');
    if (sample.historicalAccidents >= 5) riskFactors.push('High Historical Accident Spot');
    if (sample.timeOfDay === 'night') riskFactors.push('Low Night Visibility');

    if (riskFactors.length === 0) riskFactors.push('Favorable Road & Weather Conditions');

    return {
      accidentRisk: res.prediction,
      confidence: res.confidence,
      probabilities: res.probabilities,
      contributingFactors: riskFactors,
      evalMetrics: {
        modelAccuracy: (this.metrics.accuracy * 100).toFixed(1) + '%',
        macroF1: this.metrics.macroF1
      }
    };
  }

  predictCongestion(inputData) {
    const density = inputData.density || 30;
    const speed = inputData.speed || 50;
    const weather = inputData.weather || 'clear';

    let congestionScore = density * 0.7 + (100 - speed) * 0.3;
    if (weather === 'rain') congestionScore += 10;
    if (weather === 'storm') congestionScore += 20;

    congestionScore = Math.min(100, Math.max(0, Math.round(congestionScore)));

    let status = 'Smooth';
    if (congestionScore >= 40 && congestionScore < 65) status = 'Moderate';
    if (congestionScore >= 65 && congestionScore < 85) status = 'Heavy';
    if (congestionScore >= 85) status = 'Severe';

    // Trend projections (15 min, 30 min, 60 min)
    const trend15 = Math.min(100, Math.round(congestionScore * (1 + (density > 60 ? 0.08 : -0.05))));
    const trend30 = Math.min(100, Math.round(congestionScore * (1 + (density > 60 ? 0.15 : -0.10))));
    const trend60 = Math.min(100, Math.round(congestionScore * (1 + (density > 60 ? 0.22 : -0.18))));

    return {
      congestionIndex: congestionScore,
      status,
      forecasts: {
        min15: trend15,
        min30: trend30,
        min60: trend60
      },
      recommendations: status === 'Severe' || status === 'Heavy'
        ? ['Extend green signal duration by 15s', 'Trigger route diversion advisory', 'Deploy traffic control unit']
        : ['Maintain current signal cycle', 'Traffic flowing normally']
    };
  }

  getMetrics() {
    if (!this.isTrained) this.init();
    return this.metrics;
  }
}

const predictorInstance = new TrafficPredictor();

module.exports = predictorInstance;
