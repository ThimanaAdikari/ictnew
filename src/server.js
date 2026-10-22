import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing Supabase env vars. Check .env file.');
}
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/auth', authLimiter);
app.use(express.static(path.join(__dirname, '..', 'public')));
import studentsRouter from './routes/students.js';
import papersRouter from './routes/papers.js';
import resultsRouter from './routes/results.js';
app.use('/api/students', studentsRouter);
app.use('/api/papers', papersRouter);
app.use('/api/results', resultsRouter);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'ICT Experts' });
});
app.post('/api/setup/admin', async (req, res) => {
  const { setupKey, email, password, fullName, studentCode } = req.body;
  if (setupKey !== process.env.ADMIN_SETUP_KEY) {
    return res.status(403).json({ error: 'Invalid setup key' });
  }
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, fullName required' });
  }
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName }
    });
    if (authError) throw authError;
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id, full_name: fullName, student_code: studentCode || 'ADMIN001', email, role: 'admin'
    });
    if (profileError) throw profileError;
    res.json({ message: 'Admin created', userId: authData.user.id });
  } catch (err) {
    console.error('Admin setup error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
app.listen(PORT, () => {
  console.log(`\n🚀 ICT Experts running on http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin-dashboard.html`);
  console.log(`🎓 Student: http://localhost:${PORT}/student-dashboard.html\n`);
});
