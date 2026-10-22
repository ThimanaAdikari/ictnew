import express from 'express';
import { supabaseAdmin } from '../server.js';
import { verifyAuth, requireAdmin } from '../middleware/auth.js';
const router = express.Router();

// All student routes require auth
router.use(verifyAuth);

// Admin: list all students with stats
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { search, sort = 'created_at', order = 'desc' } = req.query;
    let query = supabaseAdmin.from('profiles').select('*').eq('role', 'student');
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,student_code.ilike.%${search}%,email.ilike.%${search}%`);
    }
    query = query.order(sort, { ascending: order === 'asc' });
    const { data: students, error } = await query;
    if (error) throw error;

    // Enrich with stats
    const enriched = await Promise.all(students.map(async (s) => {
      const { data: results } = await supabaseAdmin.from('results').select('marks_obtained, paper_id, entered_at').eq('student_id', s.id);
      const { data: papers } = await supabaseAdmin.from('papers').select('max_marks');
      // simple calc
      let totalPct = 0;
      if (results && results.length > 0) {
        // Need max marks per paper - fetch papers map
        const { data: allPapers } = await supabaseAdmin.from('papers').select('id, max_marks');
        const map = new Map(allPapers.map(p => [p.id, p.max_marks]));
        const pcts = results.map(r => {
          const max = map.get(r.paper_id) || 100;
          return (r.marks_obtained / max) * 100;
        });
        totalPct = pcts.reduce((a,b)=>a+b,0)/pcts.length;
      }
      return {
        ...s,
        total_papers: results ? results.length : 0,
        avg_percentage: Math.round(totalPct*100)/100,
        last_activity: results && results.length ? results.sort((a,b)=> new Date(b.entered_at)-new Date(a.entered_at))[0].entered_at : null
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get single student profile (admin any, student own only)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.profile.role === 'admin';
    if (!isAdmin && req.user.profile.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { data: student, error } = await supabaseAdmin.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;

    const { data: results } = await supabaseAdmin.from('results')
      .select(`*, papers(paper_name, paper_type, max_marks, exam_date)`)
      .eq('student_id', id)
      .order('entered_at', { ascending: true });

    const { data: allPapers } = await supabaseAdmin.from('papers').select('*').order('exam_date', { ascending: true });

    // Calculate summary
    let avg = 0, best = 0, worst = 100, first = null, latest = null;
    if (results && results.length > 0) {
      const pcts = results.map(r => (r.marks_obtained / r.papers.max_marks) * 100);
      avg = pcts.reduce((a,b)=>a+b,0)/pcts.length;
      best = Math.max(...pcts);
      worst = Math.min(...pcts);
      first = pcts[0];
      latest = pcts[pcts.length-1];
    }

    const completedPaperIds = new Set(results ? results.map(r=>r.paper_id) : []);
    const missingPapers = allPapers ? allPapers.filter(p => !completedPaperIds.has(p.id)) : [];

    res.json({
      student,
      results: results || [],
      allPapers: allPapers || [],
      missingPapers,
      summary: {
        total_papers: results ? results.length : 0,
        avg_percentage: Math.round(avg*100)/100,
        best_percentage: Math.round(best*100)/100,
        worst_percentage: results && results.length ? Math.round(worst*100)/100 : 0,
        improvement: results && results.length >=2 ? Math.round((latest-first)*100)/100 : 0,
        first_percentage: first ? Math.round(first*100)/100 : 0,
        latest_percentage: latest ? Math.round(latest*100)/100 : 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: create student
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, password, full_name, student_code } = req.body;
    if (!email || !password || !full_name || !student_code) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    // Create auth user via admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name }
    });
    if (authError) throw authError;

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      full_name,
      student_code: student_code.toUpperCase(),
      email,
      role: 'student'
    }).select().single();

    if (profileError) {
      // rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    res.status(201).json(profile);
  } catch (err) {
    console.error('Create student error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: update student
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, student_code, email } = req.body;
    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (student_code) updates.student_code = student_code.toUpperCase();
    if (email) updates.email = email;

    const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete student
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Delete auth user (cascade will delete profile)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;
    // Also delete profile just in case
    await supabaseAdmin.from('profiles').delete().eq('id', id);
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
