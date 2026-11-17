/**
 * Chart.js Visualizer Manager
 * Handles dynamic chart rendering for traffic analytics, accident risk distributions, and ML feature importances.
 */

const ChartsManager = {
  trafficTrendChart: null,
  riskDistChart: null,
  congestionChart: null,
  featureImpChart: null,

  initAll() {
    this.initTrafficTrend();
    this.initRiskDistribution();
    this.initCongestionChart();
    this.initFeatureImportance();
  },

  initTrafficTrend() {
    const ctx = document.getElementById('chartTrafficTrend');
    if (!ctx) return;

    const hours = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    const volumeData = [450, 1200, 850, 700, 750, 1100, 1450, 950, 500];
    const speedData = [68, 28, 45, 52, 50, 32, 22, 42, 60];

    this.trafficTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [
          {
            label: 'Traffic Volume (Vehicles/hr)',
            data: volumeData,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            yAxisID: 'yVolume',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Avg Speed (km/h)',
            data: speedData,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            yAxisID: 'ySpeed',
            borderDash: [5, 5],
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          yVolume: {
            type: 'linear',
            position: 'left',
            ticks: { color: '#06b6d4' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          ySpeed: {
            type: 'linear',
            position: 'right',
            ticks: { color: '#10b981' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  },

  initRiskDistribution() {
    const ctx = document.getElementById('chartRiskDistribution');
    if (!ctx) return;

    this.riskDistChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Low Risk', 'Medium Risk', 'High Risk'],
        datasets: [{
          data: [5, 2, 1],
          backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
        },
        cutout: '70%'
      }
    });
  },

  initCongestionChart() {
    const ctx = document.getElementById('chartCongestionIndex');
    if (!ctx) return;

    this.congestionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['ROAD-101', 'ROAD-102', 'ROAD-103', 'ROAD-104', 'ROAD-105', 'ROAD-106'],
        datasets: [{
          label: 'Congestion Index (%)',
          data: [42, 78, 25, 88, 30, 35],
          backgroundColor: function (context) {
            const val = context.raw;
            if (val >= 80) return '#f43f5e';
            if (val >= 60) return '#f59e0b';
            return '#06b6d4';
          },
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y: { ticks: { color: '#64748b' }, min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  },

  initFeatureImportance() {
    const ctx = document.getElementById('chartFeatureImportance');
    if (!ctx) return;

    this.featureImpChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Traffic Density', 'Speed Variance', 'Weather Severity', 'Road Surface', 'Night Visibility', 'Accident History'],
        datasets: [{
          label: 'Importance Weight',
          data: [0.35, 0.22, 0.18, 0.12, 0.08, 0.05],
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b' }, min: 0, max: 0.4, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        }
      }
    });
  },

  updateCharts(roads, evaluations) {
    if (!roads || roads.length === 0) return;

    // Update Congestion Bar Chart
    if (this.congestionChart) {
      const labels = roads.map(r => r.name.split(' to ')[0] || r.id);
      const densities = roads.map(r => r.density);
      this.congestionChart.data.labels = labels;
      this.congestionChart.data.datasets[0].data = densities;
      this.congestionChart.update();
    }

    // Update Risk Doughnut Chart
    if (this.riskDistChart && evaluations && evaluations.length > 0) {
      let low = 0, med = 0, high = 0;
      evaluations.forEach(ev => {
        if (ev.accidentRisk === 'Low') low++;
        else if (ev.accidentRisk === 'Medium') med++;
        else if (ev.accidentRisk === 'High') high++;
      });
      this.riskDistChart.data.datasets[0].data = [low, med, high];
      this.riskDistChart.update();
    }
  },

  updateFeatureImportances(featureImportances) {
    if (!this.featureImpChart || !featureImportances) return;

    const labels = Object.keys(featureImportances);
    const values = Object.values(featureImportances);

    this.featureImpChart.data.labels = labels;
    this.featureImpChart.data.datasets[0].data = values;
    this.featureImpChart.update();
  }
};
