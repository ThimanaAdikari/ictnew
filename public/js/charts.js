
let charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
function getPerformanceColor(p) { if (p >= 75) return '#059669'; if (p >= 60) return '#2563eb'; if (p >= 40) return '#d97706'; return '#dc2626'; }
function createProgressLineChart(canvasId, results) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  destroyChart(canvasId);
  if (!results || results.length === 0) {
    ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="bi bi-graph-up"></i></div><div class="empty-title">No results yet</div><div class="empty-desc">Complete papers to see progress</div></div>';
    return;
  }
  const sorted = [...results].sort((a,b) => new Date(a.papers?.exam_date || a.entered_at) - new Date(b.papers?.exam_date || b.entered_at));
  const labels = sorted.map(r => r.papers?.paper_name || 'Paper');
  const percentages = sorted.map(r => Math.round((r.marks_obtained / (r.papers?.max_marks || 100)) * 100 *10)/10);
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Percentage %', data: percentages, borderColor: '#2563eb', backgroundColor: (c) => { const g = c.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0,'rgba(37,99,235,0.2)'); g.addColorStop(1,'rgba(37,99,235,0)'); return g; }, borderWidth: 3, pointRadius: 5, pointBackgroundColor: percentages.map(p=>getPerformanceColor(p)), pointBorderColor: '#fff', pointBorderWidth: 2, fill: true, tension: 0.4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1', padding: 12, callbacks: { afterBody: (items) => { const idx = items[0].dataIndex; const r = sorted[idx]; return [`Marks: ${r.marks_obtained} / ${r.papers?.max_marks}`, `Date: ${formatDate(r.papers?.exam_date || r.entered_at)}`, `Type: ${r.papers?.paper_type || 'N/A'}`]; } } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false }, ticks: { maxRotation: 45 } } } }
  });
}
function createPerformanceBarChart(canvasId, results) {
  const ctx = document.getElementById(canvasId); if (!ctx) return; destroyChart(canvasId);
  if (!results || results.length === 0) { ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon"><i class="bi bi-bar-chart"></i></div><div class="empty-title">No data</div></div>'; return; }
  const sorted = [...results].sort((a,b) => (b.marks_obtained / b.papers.max_marks) - (a.marks_obtained / a.papers.max_marks));
  const labels = sorted.map(r => r.papers.paper_name.length > 20 ? r.papers.paper_name.substring(0,20)+'...' : r.papers.paper_name);
  const percentages = sorted.map(r => Math.round((r.marks_obtained / r.papers.max_marks) * 100 *10)/10);
  const colors = percentages.map(p => getPerformanceColor(p));
  charts[canvasId] = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Percentage', data: percentages, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a', callbacks: { label: (c) => `${c.raw}% (${sorted[c.dataIndex].marks_obtained}/${sorted[c.dataIndex].papers.max_marks})` } } }, scales: { x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f1f5f9' } }, y: { grid: { display: false } } } } });
}
function createClassAverageChart(canvasId, papersWithStats) {
  const ctx = document.getElementById(canvasId); if (!ctx) return; destroyChart(canvasId);
  if (!papersWithStats || papersWithStats.length === 0) return;
  const sorted = [...papersWithStats].sort((a,b) => new Date(a.exam_date) - new Date(b.exam_date));
  const labels = sorted.map(p => p.paper_name); const avgs = sorted.map(p => p.avg_percentage || 0);
  charts[canvasId] = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Class Average %', data: avgs, backgroundColor: '#2563eb', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }, x: { ticks: { maxRotation: 45 } } } } });
}
function createDistributionChart(canvasId, results) {
  const ctx = document.getElementById(canvasId); if (!ctx) return; destroyChart(canvasId);
  const ranges = { '0-39':0, '40-59':0, '60-74':0, '75-100':0 };
  results.forEach(r => { const pct = (r.marks_obtained / (r.papers?.max_marks || 100))*100; if (pct < 40) ranges['0-39']++; else if (pct < 60) ranges['40-59']++; else if (pct < 75) ranges['60-74']++; else ranges['75-100']++; });
  charts[canvasId] = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(ranges), datasets: [{ data: Object.values(ranges), backgroundColor: ['#dc2626','#d97706','#2563eb','#059669'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
}
window.createProgressLineChart = createProgressLineChart;
window.createPerformanceBarChart = createPerformanceBarChart;
window.createClassAverageChart = createClassAverageChart;
window.createDistributionChart = createDistributionChart;
window.destroyChart = destroyChart;
