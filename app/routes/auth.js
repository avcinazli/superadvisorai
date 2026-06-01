const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const { auth } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';

async function auditLog(userId, userName, action, resourceType, resourceName, details, ip) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, resource_type, resource_name, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, userName, action, resourceType, resourceName, details ? JSON.stringify(details) : null, ip]
    );
  } catch (_) {}
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'E-posta ve şifre zorunlu' });

  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user || !user.is_active)
      return res.status(401).json({ error: 'Geçersiz kimlik bilgileri' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Geçersiz kimlik bilgileri' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
    const token   = jwt.sign(payload, SECRET, { expiresIn: '8h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure:   IS_PROD,
      sameSite: 'strict',
      maxAge:   8 * 60 * 60 * 1000,
    });

    await auditLog(user.id, user.name, 'login', 'auth', user.email, null, req.ip);
    res.json({ user: payload });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/logout', auth, async (req, res) => {
  await auditLog(req.user.id, req.user.name, 'logout', 'auth', req.user.email, null, req.ip);
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
