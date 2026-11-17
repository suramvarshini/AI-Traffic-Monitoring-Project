/**
 * Traffic Telemetry Simulator & Event Controls
 */

const Simulator = {
  isSimulating: true,
  currentWeather: 'clear',
  currentRoadCondition: 'dry',

  init(onTickCallback) {
    this.onTickCallback = onTickCallback;

    // Simulation Loop every 4 seconds
    setInterval(() => {
      if (this.isSimulating) {
        this.stepTick();
      }
    }, 4000);
  },

  async stepTick() {
    // Randomly fluctuate density and speed on 2 random roads
    const overview = await ApiService.fetchOverview();
    if (!overview.success || !overview.roads) return;

    const roads = overview.roads;
    const randomIdx1 = Math.floor(Math.random() * roads.length);
    const randomIdx2 = Math.floor(Math.random() * roads.length);

    [randomIdx1, randomIdx2].forEach(idx => {
      const road = roads[idx];
      const deltaDensity = Math.floor(Math.random() * 11) - 5; // -5 to +5%
      const newDensity = Math.max(10, Math.min(98, road.density + deltaDensity));
      
      // Speed inversely correlates with density
      const speedFactor = 1 - (newDensity / 100) * 0.6;
      const newSpeed = Math.max(10, Math.round(road.speedLimit * speedFactor + (Math.random() * 6 - 3)));

      ApiService.updateTelemetry({
        roadId: road.id,
        density: newDensity,
        speed: newSpeed,
        weather: this.currentWeather,
        roadCondition: this.currentRoadCondition
      });
    });

    if (this.onTickCallback) this.onTickCallback();
  },

  async setWeather(weather, roadCondition) {
    this.currentWeather = weather;
    this.currentRoadCondition = roadCondition;
    await ApiService.updateWeather(weather, roadCondition);
    if (this.onTickCallback) this.onTickCallback();
  },

  async triggerRandomAccident() {
    const overview = await ApiService.fetchOverview();
    if (!overview.success || !overview.roads) return null;

    const roads = overview.roads;
    const randomRoad = roads[Math.floor(Math.random() * roads.length)];

    const res = await ApiService.reportAccident({
      roadId: randomRoad.id,
      severity: Math.random() > 0.4 ? 'High' : 'Medium',
      description: `Simulated collision event on ${randomRoad.name}`,
      lat: randomRoad.coordinates[0][0],
      lng: randomRoad.coordinates[0][1]
    });

    if (this.onTickCallback) this.onTickCallback();
    return res;
  }
};
