import express from 'express';
import { supabaseAdmin } from '../server.js';
import { verifyAuth, requireAdmin } from '../middleware/auth.js';
const router = express.Router();
router.use(verifyAuth);

// List results - admin all, student own only
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.profile.role === 'admin';
    const { student_id, paper_id } = req.query;
    let query = supabaseAdmin.from('results').select(`*, papers(paper_name, max_marks, paper_type, exam_date), profiles!inner(full_name, student_code)`).order('entered_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('student_id', req.user.profile.id);
    } else {
      if (student_id) query = query.eq('student_id', student_id);
      if (paper_id) query = query.eq('paper_id', paper_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit result - student can only submit for self, admin can submit for any
router.post('/', async (req, res) => {
  try {
    const { paper_id, marks_obtained, student_id } = req.body;
    const isAdmin = req.user.profile.role === 'admin';
    const targetStudentId = isAdmin && student_id ? student_id : req.user.profile.id;

    if (!paper_id || marks_obtained === undefined) return res.status(400).json({ error: 'Missing fields' });

    const { data: paper, error: paperError } = await supabaseAdmin.from('papers').select('max_marks').eq('id', paper_id).single();
    if (paperError) throw new Error('Paper not found');
    const marks = parseInt(marks_obtained);
    if (isNaN(marks) || marks < 0 || marks > paper.max_marks) {
      return res.status(400).json({ error: `Marks must be between 0 and ${paper.max_marks}` });
    }

    // Check duplicate - if exists, require explicit retake? For now, prevent duplicate unless attempt_number increased
    const { data: existing } = await supabaseAdmin.from('results').select('attempt_number').eq('student_id', targetStudentId).eq('paper_id', paper_id).order('attempt_number', { ascending: false }).limit(1);
    let attemptNumber = 1;
    if (existing && existing.length > 0) {
      // If duplicate exists, we allow retake as new attempt (store separately)
      attemptNumber = existing[0].attempt_number + 1;
    }

    const { data, error } = await supabaseAdmin.from('results').insert({
      student_id: targetStudentId,
      paper_id,
      marks_obtained: marks,
      attempt_number: attemptNumber
    }).select(`*, papers(paper_name, max_marks)`).single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Result submit error:', err);
    if (err.message.includes('duplicate')) {
      return res.status(409).json({ error: 'Result already exists for this paper. Retake will be stored as new attempt.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update result (admin can update any, student own only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { marks_obtained } = req.body;
    const isAdmin = req.user.profile.role === 'admin';

    // Check ownership
    const { data: existing, error: fetchError } = await supabaseAdmin.from('results').select('student_id, paper_id').eq('id', id).single();
    if (fetchError) throw new Error('Result not found');
    if (!isAdmin && existing.student_id !== req.user.profile.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: paper } = await supabaseAdmin.from('papers').select('max_marks').eq('id', existing.paper_id).single();
    const marks = parseInt(marks_obtained);
    if (isNaN(marks) || marks < 0 || marks > paper.max_marks) {
      return res.status(400).json({ error: `Marks must be between 0 and ${paper.max_marks}` });
    }

    const { data, error } = await supabaseAdmin.from('results').update({ marks_obtained: marks }).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete result (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('results').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Result deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: class stats
router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const { data: students } = await supabaseAdmin.from('profiles').select('id').eq('role','student');
    const { data: papers } = await supabaseAdmin.from('papers').select('id');
    const { data: results } = await supabaseAdmin.from('results').select('marks_obtained, paper_id, student_id');

    // Calculate avg class performance
    let avgClass = 0;
    if (results && results.length) {
      const { data: allPapers } = await supabaseAdmin.from('papers').select('id, max_marks');
      const map = new Map(allPapers.map(p=>[p.id, p.max_marks]));
      const pcts = results.map(r => {
        const max = map.get(r.paper_id) || 100;
        return (r.marks_obtained / max) * 100;
      });
      avgClass = pcts.reduce((a,b)=>a+b,0)/pcts.length;
    }

    res.json({
      total_students: students ? students.length : 0,
      total_papers: papers ? papers.length : 0,
      total_results: results ? results.length : 0,
      avg_class_performance: Math.round(avgClass*100)/100
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
