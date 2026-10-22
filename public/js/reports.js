
// Reports - Class Performance
document.addEventListener('DOMContentLoaded', async () => {
  const auth = await protectPage('admin');
  if (!auth) return;
  document.getElementById('userName').textContent = auth.profile.full_name;
  document.getElementById('userAvatar').textContent = auth.profile.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('userRole').textContent = 'Administrator';

  loadReports();

  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('exportCsvBtn')?.addEventListener('click', exportCsv);
});

async function loadReports() {
  try {
    const [papers, students, results] = await Promise.all([
      apiFetch('/api/papers'),
      apiFetch('/api/students'),
      apiFetch('/api/results')
    ]);

    // Class avg per paper
    const paperAvgs = papers.map(p => {
      const paperResults = results.filter(r => r.paper_id === p.id);
      const avg = paperResults.length ? paperResults.reduce((a,b) => a + (b.marks_obtained / p.max_marks * 100), 0) / paperResults.length : 0;
      return { ...p, avg_percentage: Math.round(avg*100)/100, total_attempts: paperResults.length };
    });

    // Ranking
    const ranking = students.filter(s => s.avg_percentage !== null).sort((a,b) => b.avg_percentage - a.avg_percentage);

    // Improving / declining (need at least 2 results)
    const improving = [];
    const declining = [];
    for (const s of students) {
      try {
        const detail = await apiFetch(`/api/students/${s.id}`);
        const r = detail.results;
        if (r && r.length >= 2) {
          const pcts = r.map(x => (x.marks_obtained / x.papers.max_marks)*100);
          const first = pcts[0];
          const last = pcts[pcts.length-1];
          const diff = last - first;
          if (diff >= 10) improving.push({ ...s, improvement: diff });
          else if (diff <= -10) declining.push({ ...s, decline: diff });
        }
      } catch {}
    }

    renderPaperTable(paperAvgs);
    renderRanking(ranking);
    renderImprovingDeclining(improving, declining);
    createClassAverageChart('classAvgChart', paperAvgs);
    createDistributionChart('distributionChart', results);

    // Store for CSV
    window._reportData = { papers: paperAvgs, students: ranking, results };

  } catch (err) {
    console.error(err);
    showToast('Failed to load reports: ' + err.message, 'error');
  }
}

function renderPaperTable(papers) {
  const tbody = document.getElementById('paperStatsBody');
  if (!tbody) return;
  if (papers.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No papers</td></tr>'; return; }
  const sorted = [...papers].sort((a,b) => a.avg_percentage - b.avg_percentage);
  tbody.innerHTML = sorted.map(p => `
    <tr>
      <td>${p.paper_name}</td>
      <td><span class="badge badge-blue">${p.paper_type}</span></td>
      <td>${p.total_attempts}</td>
      <td><span class="badge ${p.avg_percentage < 40 ? 'badge-red' : p.avg_percentage < 60 ? 'badge-amber' : p.avg_percentage < 75 ? 'badge-blue' : 'badge-green'}">${formatPercentage(p.avg_percentage)}</span></td>
      <td>${formatDate(p.exam_date)}</td>
    </tr>
  `).join('');
}

function renderRanking(students) {
  const tbody = document.getElementById('rankingBody');
  if (!tbody) return;
  if (students.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No ranking data</td></tr>'; return; }
  tbody.innerHTML = students.map((s, idx) => `
    <tr>
      <td><span style="width:28px;height:28px;background:${idx < 3 ? '#2563eb' : 'var(--bg-tertiary)'};color:${idx < 3 ? 'white' : 'var(--text-secondary)'};border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:12px;">${idx+1}</span></td>
      <td><div style="font-weight:600">${s.full_name}</div><div style="font-size:12px;color:var(--text-tertiary)">${s.student_code}</div></td>
      <td>${s.total_papers}</td>
      <td><span class="badge ${s.avg_percentage >= 75 ? 'badge-green' : s.avg_percentage >= 60 ? 'badge-blue' : s.avg_percentage >= 40 ? 'badge-amber' : 'badge-red'}">${formatPercentage(s.avg_percentage)}</span></td>
      <td>${s.last_activity ? formatDate(s.last_activity) : '-'}</td>
    </tr>
  `).join('');
}

function renderImprovingDeclining(improving, declining) {
  const impEl = document.getElementById('improvingList');
  const decEl = document.getElementById('decliningList');
  if (impEl) {
    if (improving.length === 0) impEl.innerHTML = '<div class="empty-desc">Not enough data to determine improving trends (need 2+ results with +10% improvement)</div>';
    else impEl.innerHTML = improving.slice(0,5).map(s => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-primary)"><span>${s.full_name}</span><span class="badge badge-green">+${s.improvement.toFixed(1)}%</span></div>`).join('');
  }
  if (decEl) {
    if (declining.length === 0) decEl.innerHTML = '<div class="empty-desc">No declining trends detected (need 2+ results with -10% decline)</div>';
    else decEl.innerHTML = declining.slice(0,5).map(s => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-primary)"><span>${s.full_name}</span><span class="badge badge-red">${s.decline.toFixed(1)}%</span></div>`).join('');
  }
}

function exportCsv() {
  const data = window._reportData;
  if (!data) { showToast('No data to export', 'error'); return; }
  
  // Students CSV
  let csv = 'Student Code,Full Name,Total Papers,Average %,Best %,Last Activity\n';
  data.students.forEach(s => {
    csv += `"${s.student_code}","${s.full_name}",${s.total_papers},${s.avg_percentage || 0},${s.best_percentage || 0},"${s.last_activity || ''}"\n`;
  });
  csv += '\nPaper Name,Type,Category,Max Marks,Exam Date,Total Attempts,Average %\n';
  data.papers.forEach(p => {
    csv += `"${p.paper_name}","${p.paper_type}","${p.category}",${p.max_marks},"${p.exam_date}",${p.total_attempts},${p.avg_percentage}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ict-experts-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported', 'success');
}
