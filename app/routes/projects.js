const express = require('express');
const pool    = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

async function log(userId, userName, action, id, name, details, ip) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, resource_type, resource_id, resource_name, details, ip_address)
       VALUES ($1,$2,$3,'project',$4,$5,$6,$7)`,
      [userId, userName, action, id, name, details ? JSON.stringify(details) : null, ip]
    );
  } catch (_) {}
}

router.get('/', auth, async (req, res) => {
  const { search = '', status = '', priority = '', client_id = '', template_id = '', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where  = [];

  if (search)      { params.push(`%${search}%`); where.push(`(p.title ILIKE $${params.length} OR c.name ILIKE $${params.length})`); }
  if (status)      { params.push(status);      where.push(`p.status = $${params.length}`); }
  if (priority)    { params.push(priority);    where.push(`p.priority = $${params.length}`); }
  if (client_id)   { params.push(client_id);   where.push(`p.client_id = $${params.length}`); }
  if (template_id) { params.push(template_id); where.push(`p.template_id = $${params.length}`); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT p.*, c.name AS client_name, t.name AS template_name,
                u.name AS assigned_to_name, cr.name AS created_by_name
         FROM projects p
         LEFT JOIN clients c ON p.client_id = c.id
         LEFT JOIN templates t ON p.template_id = t.id
         LEFT JOIN users u ON p.assigned_to = u.id
         LEFT JOIN users cr ON p.created_by = cr.id
         ${whereClause}
         ORDER BY p.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM projects p LEFT JOIN clients c ON p.client_id = c.id ${whereClause}`,
        params
      ),
    ]);
    res.json({ data: rows.rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.get('/export', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.title, c.name AS client, t.name AS template,
              p.status, p.priority, p.budget, p.deadline, p.url, p.created_at
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       LEFT JOIN templates t ON p.template_id = t.id
       ORDER BY p.created_at DESC`
    );
    const header = 'ID,Başlık,Müşteri,Şablon,Durum,Öncelik,Bütçe,Son Tarih,URL,Oluşturulma\n';
    const csv    = rows.map(r =>
      `${r.id},"${r.title}","${r.client || ''}","${r.template || ''}","${r.status}","${r.priority}","${r.budget || ''}","${r.deadline || ''}","${r.url || ''}","${r.created_at.toISOString()}"`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="projeler.csv"');
    res.send('﻿' + header + csv);
  } catch (err) { res.status(500).json({ error: 'Dışa aktarım hatası' }); }
});

router.post('/', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { title, client_id, template_id, status = 'planning', priority = 'medium', url, description, budget, deadline, assigned_to } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Proje başlığı zorunlu' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (title, client_id, template_id, status, priority, url, description, budget, deadline, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title.trim(), client_id || null, template_id || null, status, priority, url || null, description || null, budget || null, deadline || null, assigned_to || null, req.user.id]
    );
    await log(req.user.id, req.user.name, 'create', rows[0].id, title, { status, priority, template_id }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.put('/:id', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { title, client_id, template_id, status, priority, url, description, budget, deadline, assigned_to } = req.body || {};

  try {
    const { rows } = await pool.query(
      `UPDATE projects SET title=$1, client_id=$2, template_id=$3, status=$4, priority=$5,
              url=$6, description=$7, budget=$8, deadline=$9, assigned_to=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [title, client_id || null, template_id || null, status, priority, url || null, description || null, budget || null, deadline || null, assigned_to || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Proje bulunamadı' });
    await log(req.user.id, req.user.name, 'update', parseInt(req.params.id), title, { status, priority }, req.ip);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM projects WHERE id=$1 RETURNING title', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Proje bulunamadı' });
    await log(req.user.id, req.user.name, 'delete', parseInt(req.params.id), rows[0].title, null, req.ip);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

module.exports = router;
