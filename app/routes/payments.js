const express = require('express');
const pool    = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

async function log(userId, userName, action, id, name, details, ip) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, resource_type, resource_id, resource_name, details, ip_address)
       VALUES ($1,$2,$3,'payment',$4,$5,$6,$7)`,
      [userId, userName, action, id, name, details ? JSON.stringify(details) : null, ip]
    );
  } catch (_) {}
}

router.get('/', auth, async (req, res) => {
  const { status = '', client_id = '', project_id = '', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where  = [];

  if (status)     { params.push(status);     where.push(`p.status = $${params.length}`); }
  if (client_id)  { params.push(client_id);  where.push(`p.client_id = $${params.length}`); }
  if (project_id) { params.push(project_id); where.push(`p.project_id = $${params.length}`); }

  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT p.*, c.name AS client_name, pr.title AS project_title, u.name AS created_by_name
         FROM payments p
         LEFT JOIN clients c   ON p.client_id  = c.id
         LEFT JOIN projects pr ON p.project_id = pr.id
         LEFT JOIN users u     ON p.created_by  = u.id
         ${w}
         ORDER BY p.due_date ASC NULLS LAST, p.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM payments p ${w}`, params),
    ]);

    const summary = await pool.query(
      `SELECT
         SUM(CASE WHEN status='pending' THEN amount ELSE 0 END)  AS pending_total,
         SUM(CASE WHEN status='paid'    THEN amount ELSE 0 END)  AS paid_total,
         SUM(CASE WHEN status='overdue' THEN amount ELSE 0 END)  AS overdue_total,
         COUNT(*) AS total_count
       FROM payments`
    );

    res.json({
      data: rows.rows,
      total: parseInt(count.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      summary: summary.rows[0],
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { project_id, client_id, title, amount, status = 'pending', due_date, invoice_no, notes } = req.body || {};
  if (!title || !amount) return res.status(400).json({ error: 'Başlık ve tutar zorunlu' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO payments (project_id, client_id, title, amount, status, due_date, invoice_no, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [project_id || null, client_id || null, title.trim(), amount, status, due_date || null, invoice_no || null, notes || null, req.user.id]
    );
    await log(req.user.id, req.user.name, 'create', rows[0].id, title, { amount, status }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.put('/:id', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { project_id, client_id, title, amount, status, due_date, invoice_no, notes } = req.body || {};

  try {
    const { rows } = await pool.query(
      `UPDATE payments
       SET project_id=$1, client_id=$2, title=$3, amount=$4, status=$5,
           due_date=$6, invoice_no=$7, notes=$8,
           paid_at = CASE WHEN $5='paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END,
           updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [project_id || null, client_id || null, title, amount, status, due_date || null, invoice_no || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ödeme bulunamadı' });
    await log(req.user.id, req.user.name, 'update', parseInt(req.params.id), title, { status, amount }, req.ip);
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM payments WHERE id=$1 RETURNING title', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Ödeme bulunamadı' });
    await log(req.user.id, req.user.name, 'delete', parseInt(req.params.id), rows[0].title, null, req.ip);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

module.exports = router;
