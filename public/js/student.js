
// Student Dashboard
let currentUser = null;
let allPapers = [];
let myResults = [];

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await protectPage('student');
  if (!auth) return;
  currentUser = auth.profile;
  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userRole').textContent = currentUser.student_code;
  document.getElementById('userAvatar').textContent = currentUser.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('welcomeName').textContent = currentUser.full_name.split(' ')[0];

  loadStudentData();

  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('enterMarksForm')?.addEventListener('submit', handleMarksSubmit);
  document.getElementById('paperSelect')?.addEventListener('change', updateMaxMarks);
});

async function loadStudentData() {
  try {
    // Fetch via backend which returns enriched data
    const data = await apiFetch(`/api/students/${currentUser.id}`);
    myResults = data.results || [];
    allPapers = data.allPapers || [];
    
    renderSummary(data.summary);
    renderCharts(myResults);
    renderRecentResults(myResults);
    renderAvailablePapers(data.missingPapers || [], myResults);

  } catch (err) {
    console.error(err);
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderSummary(summary) {
  document.getElementById('totalPapers').textContent = summary.total_papers;
  document.getElementById('avgPercentage').textContent = formatPercentage(summary.avg_percentage);
  document.getElementById('bestPercentage').textContent = formatPercentage(summary.best_percentage);
  document.getElementById('latestPercentage').textContent = formatPercentage(summary.latest_percentage);
  document.getElementById('improvement').textContent = (summary.improvement >=0 ? '+' : '') + formatPercentage(summary.improvement);
  document.getElementById('improvement').className = 'stat-change ' + (summary.improvement > 0 ? 'positive' : summary.improvement < 0 ? 'negative' : 'neutral');
}

function renderCharts(results) {
  createProgressLineChart('progressChart', results);
  createPerformanceBarChart('barChart', results);
}

function renderRecentResults(results) {
  const tbody = document.getElementById('recentResultsBody');
  if (!tbody) return;
  if (!results || results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">No results yet. Add your first paper result!</td></tr>';
    return;
  }
  const recent = [...results].sort((a,b) => new Date(b.entered_at) - new Date(a.entered_at)).slice(0,5);
  tbody.innerHTML = recent.map(r => {
    const pct = Math.round((r.marks_obtained / r.papers.max_marks)*100);
    const badge = pct >= 75 ? 'green' : pct >= 60 ? 'blue' : pct >= 40 ? 'amber' : 'red';
    return `<tr><td>${r.papers.paper_name}</td><td>${r.papers.paper_type}</td><td>${r.marks_obtained} / ${r.papers.max_marks}</td><td><span class="badge badge-${badge}">${pct}%</span></td><td>${formatDate(r.entered_at)}</td></tr>`;
  }).join('');
}

function renderAvailablePapers(missing, results) {
  const container = document.getElementById('availablePapersList');
  const select = document.getElementById('paperSelect');
  if (!container || !select) return;

  if (missing.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-title">All caught up!</div><div class="empty-desc">You have completed all available papers.</div></div>';
    select.innerHTML = '<option value="">No papers available</option>';
    return;
  }

  select.innerHTML = '<option value="">Select a paper</option>' + missing.map(p => `<option value="${p.id}" data-max="${p.max_marks}">${p.paper_name} (${p.max_marks} marks) - ${formatDate(p.exam_date)}</option>`).join('');

  container.innerHTML = missing.slice(0,6).map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--border-primary);border-radius:var(--radius-md);margin-bottom:8px;">
      <div><div style="font-weight:600;font-size:14px;">${p.paper_name}</div><div style="font-size:12px;color:var(--text-tertiary);">${p.paper_type} • ${p.category} • ${p.max_marks} marks</div></div>
      <button class="btn btn-sm btn-secondary" onclick="document.getElementById('paperSelect').value='${p.id}'; updateMaxMarks(); document.getElementById('marksModal').classList.add('open');">Add Marks</button>
    </div>
  `).join('');
}

function updateMaxMarks() {
  const select = document.getElementById('paperSelect');
  const maxEl = document.getElementById('maxMarksDisplay');
  const option = select.options[select.selectedIndex];
  if (option && option.dataset.max) {
    maxEl.textContent = `Max marks: ${option.dataset.max}`;
    document.getElementById('marksObtained').max = option.dataset.max;
  } else {
    maxEl.textContent = '';
  }
}
window.updateMaxMarks = updateMaxMarks;

async function handleMarksSubmit(e) {
  e.preventDefault();
  const paperId = document.getElementById('paperSelect').value;
  const marks = document.getElementById('marksObtained').value;
  const btn = document.getElementById('submitMarksBtn');
  if (!paperId || marks === '') { showToast('Select paper and enter marks', 'error'); return; }
  
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await apiFetch('/api/results', { method: 'POST', body: JSON.stringify({ paper_id: paperId, marks_obtained: parseInt(marks) }) });
    showToast('Marks saved successfully!', 'success');
    document.getElementById('marksModal').classList.remove('open');
    document.getElementById('enterMarksForm').reset();
    loadStudentData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Submit Marks';
  }
}

function openMarksModal() {
  if (allPapers.length === 0) { showToast('No papers available', 'error'); return; }
  document.getElementById('marksModal').classList.add('open');
}
window.openMarksModal = openMarksModal;
