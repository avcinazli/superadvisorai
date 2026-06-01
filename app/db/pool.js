const { Pool } = require('pg');

// Railway ve benzeri platformlar DATABASE_URL sağlar.
// Local Docker kurulumunda tek tek env var'lar kullanılır.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 5432,
      user:     process.env.DB_USER     || 'supervisor',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME     || 'supervisor_db',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

pool.on('error', (err) => console.error('DB pool error:', err.message));

module.exports = pool;
