const express = require('express');
const pool    = require('../db/pool');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', auth, async (req, res) => {
  try {
    const [clients, projects, byStatus, byTemplate, recentProjects] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status=\'active\') AS active FROM clients'),
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status=\'completed\') AS completed, COUNT(*) FILTER (WHERE status=\'in_progress\') AS in_progress FROM projects'),
      pool.query(`SELECT status, COUNT(*) AS count FROM projects GROUP BY status ORDER BY count DESC`),
      pool.query(`
        SELECT t.name AS template, COUNT(p.id) AS count
        FROM projects p
        JOIN templates t ON p.template_id = t.id
        GROUP BY t.name ORDER BY count DESC LIMIT 6
      `),
      pool.query(`
        SELECT p.id, p.title, p.status, p.priority, p.created_at,
               c.name AS client_name, t.name AS template_name
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN templates t ON p.template_id = t.id
        ORDER BY p.created_at DESC LIMIT 8
      `),
    ]);

    const monthlyQ = await pool.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
      FROM projects
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY month ORDER BY month
    `);

    const auditQ = await pool.query(`
      SELECT user_name, action, resource_type, resource_name, created_at
      FROM audit_logs ORDER BY created_at DESC LIMIT 10
    `);

    res.json({
      clients:        clients.rows[0],
      projects:       projects.rows[0],
      byStatus:       byStatus.rows,
      byTemplate:     byTemplate.rows,
      monthly:        monthlyQ.rows,
      recentProjects: recentProjects.rows,
      recentAudit:    auditQ.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
