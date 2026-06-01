const express = require('express');
const pool    = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

async function log(userId, userName, action, id, name, details, ip) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, resource_type, resource_id, resource_name, details, ip_address)
       VALUES ($1,$2,$3,'client',$4,$5,$6,$7)`,
      [userId, userName, action, id, name, details ? JSON.stringify(details) : null, ip]
    );
  } catch (_) {}
}

router.get('/', auth, async (req, res) => {
  const { search = '', status = '', page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where  = [];

  if (search) { params.push(`%${search}%`); where.push(`(c.name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.company ILIKE $${params.length})`); }
  if (status) { params.push(status); where.push(`c.status = $${params.length}`); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT c.*, u.name AS created_by_name,
                (SELECT COUNT(*) FROM projects WHERE client_id = c.id) AS project_count
         FROM clients c
         LEFT JOIN users u ON c.created_by = u.id
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM clients c ${whereClause}`, params),
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
      'SELECT id, name, email, company, phone, status, notes, created_at FROM clients ORDER BY created_at DESC'
    );
    const header = 'ID,Ad,E-posta,Şirket,Telefon,Durum,Oluşturulma\n';
    const csv    = rows.map(r =>
      `${r.id},"${r.name}","${r.email}","${r.company || ''}","${r.phone || ''}","${r.status}","${r.created_at.toISOString()}"`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="musteriler.csv"');
    res.send('﻿' + header + csv);
  } catch (err) { res.status(500).json({ error: 'Dışa aktarım hatası' }); }
});

router.post('/', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { name, email, company, phone, status = 'active', notes } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Ad ve e-posta zorunlu' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO clients (name, email, company, phone, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name.trim(), email.toLowerCase().trim(), company || null, phone || null, status, notes || null, req.user.id]
    );
    await log(req.user.id, req.user.name, 'create', rows[0].id, name, { email, company }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.put('/:id', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { name, email, company, phone, status, notes } = req.body || {};
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE clients SET name=$1, email=$2, company=$3, phone=$4, status=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, email?.toLowerCase().trim(), company || null, phone || null, status, notes || null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Müşteri bulunamadı' });
    await log(req.user.id, req.user.name, 'update', parseInt(id), name, req.body, req.ip);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM clients WHERE id=$1 RETURNING name', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Müşteri bulunamadı' });
    await log(req.user.id, req.user.name, 'delete', parseInt(req.params.id), rows[0].name, null, req.ip);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

module.exports = router;
