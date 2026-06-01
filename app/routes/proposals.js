const express = require('express');
const pool    = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

async function log(userId, userName, action, id, name, details, ip) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, resource_type, resource_id, resource_name, details, ip_address)
       VALUES ($1,$2,$3,'proposal',$4,$5,$6,$7)`,
      [userId, userName, action, id, name, details ? JSON.stringify(details) : null, ip]
    );
  } catch (_) {}
}

router.get('/', auth, async (req, res) => {
  const { search = '', status = '', client_id = '', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where  = [];

  if (search)    { params.push(`%${search}%`); where.push(`(p.title ILIKE $${params.length} OR c.name ILIKE $${params.length})`); }
  if (status)    { params.push(status);    where.push(`p.status = $${params.length}`); }
  if (client_id) { params.push(client_id); where.push(`p.client_id = $${params.length}`); }

  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT p.*, c.name AS client_name, pr.title AS project_title, u.name AS created_by_name
         FROM proposals p
         LEFT JOIN clients c  ON p.client_id  = c.id
         LEFT JOIN projects pr ON p.project_id = pr.id
         LEFT JOIN users u    ON p.created_by  = u.id
         ${w}
         ORDER BY p.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM proposals p LEFT JOIN clients c ON p.client_id = c.id ${w}`, params),
    ]);
    res.json({ data: rows.rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { client_id, project_id, title, description, amount, status = 'draft', valid_until, notes } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Teklif başlığı zorunlu' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO proposals (client_id, project_id, title, description, amount, status, valid_until, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [client_id || null, project_id || null, title.trim(), description || null, amount || null, status, valid_until || null, notes || null, req.user.id]
    );
    await log(req.user.id, req.user.name, 'create', rows[0].id, title, { status, amount }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.put('/:id', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { client_id, project_id, title, description, amount, status, valid_until, notes, sent_at } = req.body || {};

  try {
    const sentAt = status === 'sent' ? (sent_at || 'NOW()') : sent_at || null;
    const { rows } = await pool.query(
      `UPDATE proposals
       SET client_id=$1, project_id=$2, title=$3, description=$4, amount=$5,
           status=$6, valid_until=$7, notes=$8, sent_at=CASE WHEN $6='sent' AND sent_at IS NULL THEN NOW() ELSE sent_at END,
           updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [client_id || null, project_id || null, title, description || null, amount || null, status, valid_until || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Teklif bulunamadı' });
    await log(req.user.id, req.user.name, 'update', parseInt(req.params.id), title, { status }, req.ip);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM proposals WHERE id=$1 RETURNING title', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Teklif bulunamadı' });
    await log(req.user.id, req.user.name, 'delete', parseInt(req.params.id), rows[0].title, null, req.ip);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

module.exports = router;
