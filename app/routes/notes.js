const express = require('express');
const pool    = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  const { client_id, project_id } = req.query;
  const params = [];
  const where  = [];

  if (client_id)  { params.push(client_id);  where.push(`n.client_id = $${params.length}`); }
  if (project_id) { params.push(project_id); where.push(`n.project_id = $${params.length}`); }

  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.name AS author_name
       FROM notes n
       LEFT JOIN users u ON n.created_by = u.id
       ${w}
       ORDER BY n.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { client_id, project_id, content } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: 'Not içeriği zorunlu' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO notes (client_id, project_id, content, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [client_id || null, project_id || null, content.trim(), req.user.id]
    );
    res.status(201).json({ ...rows[0], author_name: req.user.name });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/:id', auth, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM notes WHERE id=$1 AND (created_by=$2 OR $3=TRUE) RETURNING id',
      [req.params.id, req.user.id, req.user.role === 'admin']
    );
    if (!rows.length) return res.status(404).json({ error: 'Not bulunamadı veya yetkiniz yok' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

module.exports = router;
