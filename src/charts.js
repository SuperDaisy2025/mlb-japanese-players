// Chart rendering with symbols + straight lines
const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

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
        backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] + '33',
        borderWidth: ds.isHighlight ? 3 : 2,
        pointStyle: POINT_STYLES[i % POINT_STYLES.length],
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBorderWidth: 2,
        pointBackgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
        tension: 0,
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
          labels: { color: '#e0e6f0', font: { family: 'Barlow', size: 13 }, padding: 16, usePointStyle: true, pointStyleWidth: 14 }
        },
        tooltip: { backgroundColor: '#1a2035', titleColor: '#a0b4cc', bodyColor: '#e0e6f0', borderColor: '#2a3a55', borderWidth: 1, padding: 10 }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', displayFormats: { day: 'M/d' } },
          min: options.xMin || undefined,
          max: options.xMax || undefined,
          ticks: { color: '#6a8aaa', maxRotation: 0, font: { size: 11 } },
          grid: { color: '#1a2a3a' }
        },
        y: {
          ticks: { color: '#6a8aaa', font: { size: 12 } },
          grid: { color: '#1a2a3a' },
          title: { display: !!options.yLabel, text: options.yLabel || '', color: '#6a8aaa', font: { size: 13 } }
        }
      }
    }
  });
}

function renderBarChart(canvasId, labels, values, colors, options = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.map(c=>c+'cc'), borderColor: colors, borderWidth:1, borderRadius:4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor:'#1a2035', titleColor:'#a0b4cc', bodyColor:'#e0e6f0', borderColor:'#2a3a55', borderWidth:1 }
      },
      scales: {
        x: { ticks:{ color:'#6a8aaa', font:{size:12} }, grid:{ color:'#1a2a3a' } },
        y: { ticks:{ color:'#6a8aaa', font:{size:12} }, grid:{ color:'#1a2a3a' }, title:{ display:!!options.yLabel, text:options.yLabel||'', color:'#6a8aaa' } }
      }
    }
  });
}

function renderPitchTypeChart(canvasId, pitchCounts) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const labels = Object.keys(pitchCounts);
  const data = Object.values(pitchCounts);
  const colors = PLAYER_COLORS.slice(0, labels.length);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color:'#e0e6f0', font:{size:12}, padding:8 } } }
    }
  });
}
