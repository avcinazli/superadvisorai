const express = require('express');
const pool    = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const { project_id = '', status = '', assigned_to = '' } = req.query;
  const params = [];
  const where  = [];

  if (project_id)  { params.push(project_id);  where.push(`t.project_id = $${params.length}`); }
  if (status)      { params.push(status);       where.push(`t.status = $${params.length}`); }
  if (assigned_to) { params.push(assigned_to);  where.push(`t.assigned_to = $${params.length}`); }

  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT t.*, p.title AS project_title, u.name AS assigned_to_name, cr.name AS created_by_name
       FROM tasks t
       LEFT JOIN projects p ON t.project_id  = p.id
       LEFT JOIN users u    ON t.assigned_to  = u.id
       LEFT JOIN users cr   ON t.created_by   = cr.id
       ${w}
       ORDER BY t.sort_order ASC, t.created_at ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { project_id, title, description, status = 'todo', priority = 'medium', assigned_to, due_date } = req.body || {};
  if (!title || !project_id) return res.status(400).json({ error: 'Başlık ve proje zorunlu' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [project_id, title.trim(), description || null, status, priority, assigned_to || null, due_date || null, req.user.id]
    );
    res.status(201).json({ ...rows[0], assigned_to_name: null });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.put('/:id', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { title, description, status, priority, assigned_to, due_date } = req.body || {};

  try {
    const { rows } = await pool.query(
      `UPDATE tasks
       SET title=$1, description=$2, status=$3, priority=$4, assigned_to=$5, due_date=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [title, description || null, status, priority, assigned_to || null, due_date || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Görev bulunamadı' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/:id', auth, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Görev bulunamadı' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

module.exports = router;
