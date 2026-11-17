/**
 * Synthetic Dataset Generator for AI Traffic & Accident Prediction
 * Generates realistic training and validation records based on physical traffic rules & weather factors.
 */

const fs = require('fs');
const path = require('path');

const WEATHERS = ['clear', 'rain', 'fog', 'storm'];
const ROADS = ['dry', 'wet', 'icy', 'construction'];
const TIMES = ['peak_morning', 'daytime', 'peak_evening', 'night'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function generateSingleRecord(id) {
  const weather = getRandomItem(WEATHERS);
  const roadCondition = (weather === 'rain' || weather === 'storm')
    ? (Math.random() > 0.3 ? 'wet' : 'dry')
    : (weather === 'fog' ? (Math.random() > 0.6 ? 'wet' : 'dry') : getRandomItem(ROADS));

  const timeOfDay = getRandomItem(TIMES);
  const isPeak = timeOfDay === 'peak_morning' || timeOfDay === 'peak_evening';

  // Density correlates with time of day
  const density = isPeak ? getRandomInt(55, 98) : getRandomInt(10, 70);
  const speedLimit = getRandomItem([40, 50, 60, 80, 100]);

  // Speed drops as density or weather worsens
  const speedReductionFactor = (density / 100) * 0.5 + (weather !== 'clear' ? 0.2 : 0);
  const actualSpeed = Math.max(5, Math.round(speedLimit * (1 - speedReductionFactor) + getRandomInt(-10, 5)));

  const historicalAccidents = getRandomInt(0, 8);

  // Compute realistic ground-truth risk score (0 - 100)
  let riskScore = 0;
  riskScore += (density / 100) * 30; // High density adds risk
  
  // Speed variance risk (speeding relative to density or slippery road)
  if (actualSpeed > speedLimit * 0.9 && density > 60) riskScore += 25;
  
  if (weather === 'rain') riskScore += 15;
  if (weather === 'fog') riskScore += 20;
  if (weather === 'storm') riskScore += 30;

  if (roadCondition === 'wet') riskScore += 10;
  if (roadCondition === 'icy') riskScore += 25;
  if (roadCondition === 'construction') riskScore += 15;

  if (timeOfDay === 'night') riskScore += 15;
  riskScore += historicalAccidents * 3;

  // Add slight random noise to simulate real-world variability
  riskScore += getRandomInt(-5, 5);
  riskScore = Math.max(0, Math.min(100, riskScore));

  let accidentRisk = 'Low';
  if (riskScore >= 45 && riskScore < 70) accidentRisk = 'Medium';
  if (riskScore >= 70) accidentRisk = 'High';

  let congestionLevel = 'Low';
  if (density >= 40 && density < 65) congestionLevel = 'Moderate';
  if (density >= 65 && density < 85) congestionLevel = 'Heavy';
  if (density >= 85) congestionLevel = 'Severe';

  return {
    id: id || `REC-${1000 + id}`,
    timestamp: new Date(Date.now() - getRandomInt(0, 30 * 24 * 3600 * 1000)).toISOString(),
    density,
    speed: actualSpeed,
    speedLimit,
    weather,
    roadCondition,
    timeOfDay,
    historicalAccidents,
    riskScore: parseFloat(riskScore.toFixed(1)),
    accidentRisk,
    congestionLevel
  };
}

function generateDataset(sampleCount = 1200, outputPath = null) {
  const dataset = [];
  for (let i = 1; i <= sampleCount; i++) {
    dataset.push(generateSingleRecord(i));
  }

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2), 'utf-8');
    console.log(`[DatasetGenerator] Successfully generated ${sampleCount} records at ${outputPath}`);
  }

  return dataset;
}

module.exports = {
  generateDataset,
  generateSingleRecord,
  WEATHERS,
  ROADS,
  TIMES
};
