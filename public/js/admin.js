
// Admin Dashboard Logic
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await protectPage('admin');
  if (!auth) return;
  currentUser = auth.profile;
  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userRole').textContent = 'Administrator';
  document.getElementById('userAvatar').textContent = currentUser.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  
  loadDashboardStats();
  loadRecentResults();
  loadTopStudents();

  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
});

async function loadDashboardStats() {
  try {
    const stats = await apiFetch('/api/results/stats/overview');
    document.getElementById('totalStudents').textContent = stats.total_students;
    document.getElementById('totalPapers').textContent = stats.total_papers;
    document.getElementById('totalResults').textContent = stats.total_results;
    document.getElementById('avgPerformance').textContent = formatPercentage(stats.avg_class_performance);

    // Additional stats from other endpoints
    const students = await apiFetch('/api/students');
    const papers = await apiFetch('/api/papers');
    
    // Students needing improvement (<50% avg)
    const low = students.filter(s => s.avg_percentage !== null && s.avg_percentage < 50).length;
    document.getElementById('needImprovement').textContent = low;

  } catch (err) {
    console.error(err);
    showToast('Failed to load stats: ' + err.message, 'error');
  }
}

async function loadRecentResults() {
  const container = document.getElementById('recentResultsBody');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="5" class="empty"><div class="spinner"></div></td></tr>';
  try {
    const results = await apiFetch('/api/results');
    const recent = results.slice(0, 8);
    if (recent.length === 0) {
      container.innerHTML = '<tr><td colspan="5" class="empty">No results yet. Students will appear here after submitting marks.</td></tr>';
      return;
    }
    container.innerHTML = recent.map(r => {
      const pct = Math.round((r.marks_obtained / r.papers.max_marks) * 100);
      const color = pct >= 75 ? 'green' : pct >= 50 ? 'blue' : pct >= 40 ? 'amber' : 'red';
      return `<tr>
        <td><div style="font-weight:600">${r.profiles.full_name}</div><div style="font-size:12px;color:var(--text-tertiary)">${r.profiles.student_code}</div></td>
        <td>${r.papers.paper_name}</td>
        <td>${r.marks_obtained} / ${r.papers.max_marks}</td>
        <td><span class="badge badge-${color}">${pct}%</span></td>
        <td>${formatDate(r.entered_at)}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" class="empty">Error: ${err.message}</td></tr>`;
  }
}

async function loadTopStudents() {
  const container = document.getElementById('topStudentsList');
  if (!container) return;
  try {
    const students = await apiFetch('/api/students');
    const sorted = students.filter(s => s.avg_percentage !== null).sort((a,b) => b.avg_percentage - a.avg_percentage).slice(0,5);
    if (sorted.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-desc">No student performance data yet</div></div>';
      return;
    }
    container.innerHTML = sorted.map((s, idx) => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-primary);border-radius:var(--radius-md);margin-bottom:8px;">
        <div style="width:32px;height:32px;background:${idx===0 ? '#fbbf24' : idx===1 ? '#94a3b8' : idx===2 ? '#d97706' : 'var(--bg-tertiary)'};color:white;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;">${idx+1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.full_name}</div>
          <div style="font-size:12px;color:var(--text-tertiary);">${s.student_code} • ${s.total_papers} papers</div>
        </div>
        <div style="font-weight:700;color:${s.avg_percentage >= 75 ? 'var(--accent-green)' : s.avg_percentage >= 50 ? 'var(--accent-blue)' : 'var(--accent-red)'};">${formatPercentage(s.avg_percentage)}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
