const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

async function log(userId, userName, action, id, name, details, ip) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, resource_type, resource_id, resource_name, details, ip_address)
       VALUES ($1,$2,$3,'user',$4,$5,$6,$7)`,
      [userId, userName, action, id, name, details ? JSON.stringify(details) : null, ip]
    );
  } catch (_) {}
}

router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role = 'viewer' } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Ad, e-posta ve şifre zorunlu' });
  if (!['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'Geçersiz rol' });
  if (password.length < 8) return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
       RETURNING id, name, email, role, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), hash, role]
    );
    await log(req.user.id, req.user.name, 'create', rows[0].id, name, { email, role }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  const { name, email, role, is_active, password } = req.body || {};
  const { id } = req.params;

  if (parseInt(id) === req.user.id && role && role !== req.user.role)
    return res.status(400).json({ error: 'Kendi rolünüzü değiştiremezsiniz' });

  try {
    let hash;
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı' });
      hash = await bcrypt.hash(password, 12);
    }

    const { rows } = await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, is_active=$4 ${hash ? ', password_hash=$6' : ''}, updated_at=NOW()
       WHERE id=$5 RETURNING id, name, email, role, is_active, last_login, created_at`,
      hash ? [name, email?.toLowerCase().trim(), role, is_active, id, hash] : [name, email?.toLowerCase().trim(), role, is_active, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    await log(req.user.id, req.user.name, 'update', parseInt(id), name, { role, is_active, passwordChanged: !!password }, req.ip);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });

  try {
    const { rows } = await pool.query('DELETE FROM users WHERE id=$1 RETURNING name', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    await log(req.user.id, req.user.name, 'delete', parseInt(req.params.id), rows[0].name, null, req.ip);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Sunucu hatası' }); }
});

module.exports = router;
