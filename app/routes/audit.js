const express = require('express');
const pool    = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, requireRole('admin', 'editor'), async (req, res) => {
  const { page = 1, limit = 30, user_id = '', action = '', resource_type = '', from = '', to = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const params = [];
  const where  = [];

  if (user_id)       { params.push(user_id);       where.push(`a.user_id = $${params.length}`); }
  if (action)        { params.push(action);         where.push(`a.action = $${params.length}`); }
  if (resource_type) { params.push(resource_type);  where.push(`a.resource_type = $${params.length}`); }
  if (from)          { params.push(from);           where.push(`a.created_at >= $${params.length}`); }
  if (to)            { params.push(to);             where.push(`a.created_at <= $${params.length}`); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [rows, count, userList] = await Promise.all([
      pool.query(
        `SELECT a.* FROM audit_logs a ${whereClause}
         ORDER BY a.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM audit_logs a ${whereClause}`, params),
      pool.query('SELECT id, name FROM users ORDER BY name'),
    ]);
    res.json({
      data:  rows.rows,
      total: parseInt(count.rows[0].count),
      page:  parseInt(page),
      limit: parseInt(limit),
      users: userList.rows,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
