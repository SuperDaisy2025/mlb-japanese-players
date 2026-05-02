// Chart rendering utilities
const PLAYER_COLORS = [
  '#c8102e', // Red - Ohtani
  '#005A9C', // Blue - Yamamoto
  '#0E3386', // Cubs Blue - Imanaga
  '#CC3433', // Cubs Red - Suzuki
  '#134A8E', // Blue Jays
  '#002D72', // Mets Blue
  '#FF5910', // Mets Orange
];

const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// Line chart for cumulative stats comparison
function renderLineChart(canvasId, datasets, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: datasets.map((ds, i) => ({
        label: ds.label,
        data: ds.data,
        borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
        backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] + '22',
        borderWidth: ds.label.includes('大谷') || ds.label.includes('Ohtani') ? 3 : 2,
        pointRadius: 2,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#e0e6f0', font: { family: 'Barlow', size: 12 }, padding: 16 }
        },
        tooltip: {
          backgroundColor: '#1a2035',
          titleColor: '#a0b4cc',
          bodyColor: '#e0e6f0',
          borderColor: '#2a3a55',
          borderWidth: 1,
          callbacks: options.tooltipCallbacks || {}
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', displayFormats: { day: 'MM/dd' } },
          ticks: { color: '#6a8aaa', maxRotation: 0 },
          grid: { color: '#1a2a3a' }
        },
        y: {
          ticks: { color: '#6a8aaa' },
          grid: { color: '#1a2a3a' },
          title: { display: !!options.yLabel, text: options.yLabel || '', color: '#6a8aaa' }
        }
      }
    }
  });
}

// Bar chart for single stat comparison
function renderBarChart(canvasId, labels, values, colors, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2035',
          titleColor: '#a0b4cc',
          bodyColor: '#e0e6f0',
          borderColor: '#2a3a55',
          borderWidth: 1,
        }
      },
      scales: {
        x: { ticks: { color: '#6a8aaa' }, grid: { color: '#1a2a3a' } },
        y: {
          ticks: { color: '#6a8aaa' },
          grid: { color: '#1a2a3a' },
          title: { display: !!options.yLabel, text: options.yLabel || '', color: '#6a8aaa' }
        }
      }
    }
  });
}

// Pitch type distribution donut
function renderPitchTypeChart(canvasId, pitchData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  const typeMap = {};
  pitchData.forEach(p => {
    const type = p.details?.type?.description || p.pitchType || 'Unknown';
    typeMap[type] = (typeMap[type] || 0) + 1;
  });

  const labels = Object.keys(typeMap);
  const data = Object.values(typeMap);
  const colors = ['#c8102e','#005A9C','#f5a623','#7ed321','#9b59b6','#1abc9c','#e67e22'];

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#e0e6f0', font: { size: 11 }, padding: 8 }
        }
      }
    }
  });
}

// Sparkline (tiny inline chart)
function renderSparkline(canvasId, values, color = '#c8102e') {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: values.map((_, i) => i),
      datasets: [{
        data: values,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        backgroundColor: color + '22',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      animation: false
    }
  });
}
