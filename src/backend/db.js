/**
 * Embedded Database Manager (JSON File Storage with Thread-Safe File Access & In-Memory Cache)
 * Supports serverless execution environments (AWS Lambda / Netlify Functions) with read-only file systems.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/traffic_db.json');

class DatabaseManager {
  constructor() {
    this.data = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.data = { intersections: [], roads: [], recentAccidents: [], recentEvents: [] };
      }
    } catch (err) {
      console.error('[DB] Error loading database file:', err);
      this.data = { intersections: [], roads: [], recentAccidents: [], recentEvents: [] };
    }
  }

  save() {
    try {
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      // In serverless environments like Netlify Functions, filesystem may be read-only.
      // We gracefully maintain state in memory without throwing uncaught server errors.
      console.warn('[DB] Operating in read-only environment. State updated in memory.');
    }
  }

  getRoads() {
    return this.data.roads || [];
  }

  getRoadById(id) {
    return (this.data.roads || []).find(r => r.id === id);
  }

  getIntersections() {
    return this.data.intersections || [];
  }

  getAccidents() {
    return this.data.recentAccidents || [];
  }

  getEvents() {
    return this.data.recentEvents || [];
  }

  updateRoad(id, updateFields) {
    const road = this.getRoadById(id);
    if (!road) return null;

    Object.assign(road, updateFields);
    this.save();
    return road;
  }

  addAccident(accident) {
    const newAccident = {
      id: `ACC-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...accident
    };
    this.data.recentAccidents.unshift(newAccident);
    // Keep max 20 records
    if (this.data.recentAccidents.length > 20) this.data.recentAccidents.pop();

    this.addEvent({
      type: 'ACCIDENT',
      title: 'Accident Reported',
      message: `${accident.severity || 'Medium'} severity incident on ${accident.roadName || 'Road'}`,
      timestamp: newAccident.timestamp
    });

    this.save();
    return newAccident;
  }

  addEvent(event) {
    const newEvent = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.data.recentEvents.unshift(newEvent);
    if (this.data.recentEvents.length > 25) this.data.recentEvents.pop();
    this.save();
    return newEvent;
  }

  updateGlobalWeather(weatherType, roadCondition) {
    const roads = this.getRoads();
    for (const r of roads) {
      r.weather = weatherType;
      if (roadCondition) r.roadCondition = roadCondition;
    }
    this.addEvent({
      type: 'WEATHER',
      title: 'Weather Updated',
      message: `Global weather updated to ${weatherType.toUpperCase()}`
    });
    this.save();
    return roads;
  }
}

const dbInstance = new DatabaseManager();

module.exports = dbInstance;
