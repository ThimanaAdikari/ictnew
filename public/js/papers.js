
// Papers Management - Admin
let currentPapers = [];
let editingPaperId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const auth = await protectPage('admin');
  if (!auth) return;
  document.getElementById('userName').textContent = auth.profile.full_name;
  document.getElementById('userAvatar').textContent = auth.profile.full_name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('userRole').textContent = 'Administrator';

  loadPapers();

  document.getElementById('searchPapers')?.addEventListener('input', (e) => {
    filterPapers(e.target.value, document.getElementById('filterType').value);
  });
  document.getElementById('filterType')?.addEventListener('change', (e) => {
    filterPapers(document.getElementById('searchPapers').value, e.target.value);
  });

  document.getElementById('paperForm')?.addEventListener('submit', handlePaperSubmit);
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
});

async function loadPapers() {
  const tbody = document.getElementById('papersBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="empty"><div class="spinner"></div></td></tr>';
  try {
    currentPapers = await apiFetch('/api/papers');
    renderPapers(currentPapers);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Error: ${err.message}</td></tr>`;
  }
}

function renderPapers(papers) {
  const tbody = document.getElementById('papersBody');
  if (papers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No papers found. Create your first paper.</td></tr>';
    return;
  }
  tbody.innerHTML = papers.map(p => `
    <tr>
      <td><div style="font-weight:600">${p.paper_name}</div><div style="font-size:12px;color:var(--text-tertiary)">${p.id.substring(0,8)}...</div></td>
      <td><span class="badge badge-blue">${p.paper_type}</span></td>
      <td>${p.category}</td>
      <td>${p.max_marks}</td>
      <td>${formatDate(p.exam_date)}</td>
      <td><div>${p.total_attempts || 0} attempts</div><div style="font-size:12px;color:var(--text-tertiary)">${formatPercentage(p.avg_percentage)} avg</div></td>
      <td><div class="flex gap-2"><button class="btn btn-sm btn-secondary" onclick="editPaper('${p.id}')">Edit</button><button class="btn btn-sm btn-ghost" style="color:var(--accent-red)" onclick="deletePaper('${p.id}')">Delete</button></div></td>
    </tr>
  `).join('');
}

function filterPapers(search, type) {
  let filtered = [...currentPapers];
  if (search) filtered = filtered.filter(p => p.paper_name.toLowerCase().includes(search.toLowerCase()));
  if (type) filtered = filtered.filter(p => p.paper_type === type);
  renderPapers(filtered);
}

function openPaperModal() {
  editingPaperId = null;
  document.getElementById('paperModalTitle').textContent = 'Add New Paper';
  document.getElementById('paperForm').reset();
  document.getElementById('paperModal').classList.add('open');
}
window.openPaperModal = openPaperModal;

function editPaper(id) {
  const paper = currentPapers.find(p => p.id === id);
  if (!paper) return;
  editingPaperId = id;
  document.getElementById('paperModalTitle').textContent = 'Edit Paper';
  document.getElementById('paperName').value = paper.paper_name;
  document.getElementById('paperType').value = paper.paper_type;
  document.getElementById('paperCategory').value = paper.category;
  document.getElementById('maxMarks').value = paper.max_marks;
  document.getElementById('examDate').value = paper.exam_date;
  document.getElementById('paperDescription').value = paper.description || '';
  document.getElementById('paperModal').classList.add('open');
}
window.editPaper = editPaper;

async function handlePaperSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('savePaperBtn');
  const data = {
    paper_name: document.getElementById('paperName').value.trim(),
    paper_type: document.getElementById('paperType').value,
    category: document.getElementById('paperCategory').value.trim(),
    max_marks: parseInt(document.getElementById('maxMarks').value),
    exam_date: document.getElementById('examDate').value,
    description: document.getElementById('paperDescription').value.trim()
  };
  if (!data.paper_name || !data.max_marks || !data.exam_date) { showToast('Fill required fields', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    if (editingPaperId) {
      await apiFetch(`/api/papers/${editingPaperId}`, { method: 'PUT', body: JSON.stringify(data) });
      showToast('Paper updated', 'success');
    } else {
      await apiFetch('/api/papers', { method: 'POST', body: JSON.stringify(data) });
      showToast('Paper created', 'success');
    }
    document.getElementById('paperModal').classList.remove('open');
    loadPapers();
  } catch (err) {
    showToast(err.message, 'error');
  } finally { btn.disabled = false; btn.textContent = 'Save Paper'; }
}

async function deletePaper(id) {
  if (!confirm('Delete this paper? This will also delete all student results for this paper. This action cannot be undone.')) return;
  try {
    await apiFetch(`/api/papers/${id}`, { method: 'DELETE' });
    showToast('Paper deleted', 'success');
    loadPapers();
  } catch (err) { showToast(err.message, 'error'); }
}
window.deletePaper = deletePaper;

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
window.closeModal = closeModal;
