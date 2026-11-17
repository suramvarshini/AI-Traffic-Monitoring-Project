/**
 * Road Network Graph & Dijkstra Route Optimization Engine
 * Calculates optimal and alternative paths considering distance, traffic delay, and AI accident risk weights.
 */

const predictor = require('../ml/predictor');

class PriorityQueue {
  constructor() {
    this.nodes = [];
  }
  enqueue(element, priority) {
    this.nodes.push({ element, priority });
    this.nodes.sort((a, b) => a.priority - b.priority);
  }
  dequeue() {
    return this.nodes.shift();
  }
  isEmpty() {
    return this.nodes.length === 0;
  }
}

class RoadGraph {
  constructor(intersections, roads) {
    this.nodes = intersections;
    this.roads = roads;
    this.adjacencyList = {};
    this._buildGraph();
  }

  _buildGraph() {
    for (const node of this.nodes) {
      this.adjacencyList[node.id] = [];
    }

    for (const road of this.roads) {
      // Predict risk on edge to compute safety penalty
      const riskEval = predictor.predictAccidentRisk({
        density: road.density,
        speed: road.currentSpeed,
        speedLimit: road.speedLimit,
        weather: road.weather,
        roadCondition: road.roadCondition,
        historicalAccidents: road.historicalAccidents
      });

      const travelTimeMinutes = (road.distanceKm / Math.max(5, road.currentSpeed)) * 60;
      const congestionPenalty = (road.density / 100) * 8;
      
      let riskPenalty = 0;
      if (riskEval.accidentRisk === 'High') riskPenalty = 12;
      else if (riskEval.accidentRisk === 'Medium') riskPenalty = 4;

      const weightedCost = travelTimeMinutes + congestionPenalty + riskPenalty;

      const edgeInfo = {
        roadId: road.id,
        roadName: road.name,
        targetNode: road.toNode,
        distanceKm: road.distanceKm,
        travelTimeMinutes: parseFloat(travelTimeMinutes.toFixed(1)),
        cost: parseFloat(weightedCost.toFixed(2)),
        accidentRisk: riskEval.accidentRisk,
        density: road.density,
        coordinates: road.coordinates
      };

      if (!this.adjacencyList[road.fromNode]) this.adjacencyList[road.fromNode] = [];
      this.adjacencyList[road.fromNode].push(edgeInfo);

      // Bi-directional for standard city road network
      if (!this.adjacencyList[road.toNode]) this.adjacencyList[road.toNode] = [];
      this.adjacencyList[road.toNode].push({
        ...edgeInfo,
        targetNode: road.fromNode,
        coordinates: [...road.coordinates].reverse()
      });
    }
  }

  findRoutes(startNodeId, endNodeId) {
    if (!this.adjacencyList[startNodeId] || !this.adjacencyList[endNodeId]) {
      return { error: 'Invalid start or destination intersection node ID.' };
    }

    const primaryRoute = this._dijkstra(startNodeId, endNodeId, []);
    if (!primaryRoute) {
      return { error: 'No reachable route found between specified locations.' };
    }

    // Find alternative route by penalizing primary edges
    const primaryEdgeIds = primaryRoute.pathEdges.map(e => e.roadId);
    const alternativeRoute = this._dijkstra(startNodeId, endNodeId, primaryEdgeIds);

    const routes = [this._formatRouteResult(primaryRoute, 'Primary (AI Optimized)', true)];
    if (alternativeRoute && alternativeRoute.totalDistance > 0) {
      routes.push(this._formatRouteResult(alternativeRoute, 'Alternative Route', false));
    }

    return {
      startNodeId,
      endNodeId,
      routesCount: routes.length,
      routes
    };
  }

  _dijkstra(startNodeId, endNodeId, penalizedEdgeIds = []) {
    const distances = {};
    const previous = {};
    const previousEdge = {};
    const pq = new PriorityQueue();

    for (const nodeId in this.adjacencyList) {
      distances[nodeId] = Infinity;
      previous[nodeId] = null;
      previousEdge[nodeId] = null;
    }

    distances[startNodeId] = 0;
    pq.enqueue(startNodeId, 0);

    while (!pq.isEmpty()) {
      const { element: currentNodeId } = pq.dequeue();

      if (currentNodeId === endNodeId) break;

      const neighbors = this.adjacencyList[currentNodeId] || [];
      for (const edge of neighbors) {
        let edgeCost = edge.cost;
        if (penalizedEdgeIds.includes(edge.roadId)) {
          edgeCost += 25.0; // Avoid reusing primary route edges for alternative
        }

        const alt = distances[currentNodeId] + edgeCost;
        if (alt < distances[edge.targetNode]) {
          distances[edge.targetNode] = alt;
          previous[edge.targetNode] = currentNodeId;
          previousEdge[edge.targetNode] = edge;
          pq.enqueue(edge.targetNode, alt);
        }
      }
    }

    if (distances[endNodeId] === Infinity) return null;

    // Reconstruct path
    const pathNodes = [];
    const pathEdges = [];
    let curr = endNodeId;

    while (curr) {
      pathNodes.unshift(curr);
      if (previousEdge[curr]) {
        pathEdges.unshift(previousEdge[curr]);
      }
      curr = previous[curr];
    }

    let totalDistance = 0;
    let totalTimeMinutes = 0;
    let hasHighRiskSegment = false;
    const fullCoordinates = [];

    for (const edge of pathEdges) {
      totalDistance += edge.distanceKm;
      totalTimeMinutes += edge.travelTimeMinutes;
      if (edge.accidentRisk === 'High') hasHighRiskSegment = true;
      fullCoordinates.push(...edge.coordinates);
    }

    return {
      pathNodes,
      pathEdges,
      totalDistance: parseFloat(totalDistance.toFixed(1)),
      totalTimeMinutes: Math.round(totalTimeMinutes),
      hasHighRiskSegment,
      fullCoordinates
    };
  }

  _formatRouteResult(routeData, label, isPrimary) {
    const safetyScore = routeData.hasHighRiskSegment ? 'Caution (Moderate Risk)' : 'High Safety (Low Risk)';
    return {
      name: label,
      isPrimary,
      totalDistanceKm: routeData.totalDistance,
      estimatedTimeMinutes: routeData.totalTimeMinutes,
      safetyRating: safetyScore,
      segmentCount: routeData.pathEdges.length,
      waypoints: routeData.pathNodes,
      segments: routeData.pathEdges.map(e => ({
        roadId: e.roadId,
        roadName: e.roadName,
        distanceKm: e.distanceKm,
        travelTimeMinutes: e.travelTimeMinutes,
        risk: e.accidentRisk,
        density: e.density
      })),
      pathCoordinates: routeData.fullCoordinates
    };
  }
}

module.exports = RoadGraph;
