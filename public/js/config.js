// ICT Experts - Supabase Config
const SUPABASE_URL = localStorage.getItem('SUPABASE_URL') || window.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || window.SUPABASE_ANON_KEY || 'your-anon-key';
let supabaseClient = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = window.__ENV__?.SUPABASE_URL || SUPABASE_URL;
  const anonKey = window.__ENV__?.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase JS not loaded');
    return null;
  }
  supabaseClient = window.supabase.createClient(url, anonKey);
  return supabaseClient;
}
async function getAuthToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}
async function apiFetch(path, options = {}) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) { console.log(`[${type}] ${message}`); return; }
  const toast = document.createElement('div');
  toast.className = `alert alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
  toast.style.cssText = 'position: relative; margin-bottom: 10px; animation: fadeIn 0.3s ease; min-width: 300px; box-shadow: var(--shadow-lg);';
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="margin-left:auto; background:none; border:none; cursor:pointer; font-weight:bold;">×</button>`;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatPercentage(p) {
  if (p === null || p === undefined) return '-';
  return `${Number(p).toFixed(1)}%`;
}
window.getSupabase = getSupabase;
window.apiFetch = apiFetch;
window.showToast = showToast;
window.formatDate = formatDate;
window.formatPercentage = formatPercentage;
