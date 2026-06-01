const express = require('express');
const pool    = require('../db/pool');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, (SELECT COUNT(*) FROM projects WHERE template_id = t.id) AS project_count
       FROM templates t ORDER BY t.name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
