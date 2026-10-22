import { supabaseAdmin } from '../server.js';
export async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('id, role, full_name, student_code, email').eq('id', user.id).single();
    if (profileError || !profile) return res.status(403).json({ error: 'Profile not found' });
    req.user = { ...user, profile };
    next();
  } catch (err) {
    console.error('Auth verify error:', err);
    return res.status(401).json({ error: 'Auth failed' });
  }
}
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.profile.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
  next();
}
export function requireStudentOrAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
