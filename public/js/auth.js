
document.addEventListener('DOMContentLoaded', () => {
  const supabase = getSupabase();
  if (!supabase) { showToast('Supabase not configured', 'error'); return; }
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) redirectByRole(session.user.id);
  });
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const btn = document.getElementById('loginBtn');
      const errorEl = document.getElementById('loginError');
      if (!email || !password) { errorEl.textContent = 'Enter email and password'; errorEl.classList.remove('hidden'); return; }
      btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;"></span> Signing in...'; errorEl.classList.add('hidden');
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('Login successful!', 'success');
        await redirectByRole(data.user.id);
      } catch (err) {
        errorEl.textContent = err.message || 'Login failed'; errorEl.classList.remove('hidden');
      } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
    });
  }
});
async function redirectByRole(userId) {
  try {
    const supabase = getSupabase();
    const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (error) throw error;
    if (profile.role === 'admin') window.location.href = '/admin-dashboard.html';
    else window.location.href = '/student-dashboard.html';
  } catch (err) {
    console.error(err);
    showToast('Role check failed', 'error');
    setTimeout(() => { window.location.href = '/student-dashboard.html'; }, 1000);
  }
}
async function logout() {
  const supabase = getSupabase();
  if (supabase) await supabase.auth.signOut();
  window.location.href = '/login.html';
}
window.logout = logout;
async function protectPage(requiredRole = null) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = '/login.html'; return null; }
  try {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (!profile) throw new Error('Profile not found');
    if (requiredRole && profile.role !== requiredRole) {
      if (profile.role === 'admin') window.location.href = '/admin-dashboard.html';
      else window.location.href = '/student-dashboard.html';
      return null;
    }
    return { session, profile };
  } catch (err) {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
    return null;
  }
}
window.protectPage = protectPage;
