import express from 'express';
import { supabaseAdmin } from '../server.js';
import { verifyAuth, requireAdmin } from '../middleware/auth.js';
const router = express.Router();
router.use(verifyAuth);

// List all papers (any authenticated)
router.get('/', async (req, res) => {
  try {
    const { search, type, category } = req.query;
    let query = supabaseAdmin.from('papers').select('*').order('exam_date', { ascending: false });
    if (search) query = query.ilike('paper_name', `%${search}%`);
    if (type) query = query.eq('paper_type', type);
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw error;

    // Add stats: count students, avg
    const enriched = await Promise.all((data||[]).map(async (p) => {
      const { data: results } = await supabaseAdmin.from('results').select('marks_obtained').eq('paper_id', p.id);
      const count = results ? results.length : 0;
      const avg = count ? results.reduce((a,b)=>a+b.marks_obtained,0)/count : 0;
      const avgPct = count ? (avg / p.max_marks * 100) : 0;
      return { ...p, total_attempts: count, avg_marks: Math.round(avg*10)/10, avg_percentage: Math.round(avgPct*100)/100 };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single paper
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin.from('papers').select('*').eq('id', id).single();
    if (error) throw error;

    const { data: results } = await supabaseAdmin.from('results')
      .select(`*, profiles(full_name, student_code)`)
      .eq('paper_id', id)
      .order('marks_obtained', { ascending: false });

    res.json({ paper: data, results: results || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create paper (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { paper_name, paper_type, category, max_marks, exam_date, description } = req.body;
    if (!paper_name || !max_marks || !exam_date) return res.status(400).json({ error: 'Missing required fields' });
    if (max_marks <=0 || max_marks > 1000) return res.status(400).json({ error: 'Invalid max_marks' });

    const { data, error } = await supabaseAdmin.from('papers').insert({
      paper_name: paper_name.trim(),
      paper_type: paper_type || 'Model Paper',
      category: category || 'ICT',
      max_marks: parseInt(max_marks),
      exam_date,
      description: description || null,
      created_by: req.user.profile.id
    }).select().single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update paper (admin)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { paper_name, paper_type, category, max_marks, exam_date, description } = req.body;
    const updates = {};
    if (paper_name) updates.paper_name = paper_name.trim();
    if (paper_type) updates.paper_type = paper_type;
    if (category) updates.category = category;
    if (max_marks) updates.max_marks = parseInt(max_marks);
    if (exam_date) updates.exam_date = exam_date;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabaseAdmin.from('papers').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete paper (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('papers').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Paper deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
