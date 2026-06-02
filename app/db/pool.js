const { Pool } = require('pg');

// DATABASE_URL varsa kullan (Railway ${{Postgres.DATABASE_URL}})
// PGHOST varsa Railway'in bireysel PG değişkenlerini kullan
// Yoksa local Docker değişkenlerine düş
const sslConfig = process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false };

let poolConfig;
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig,
  };
} else if (process.env.PGHOST) {
  poolConfig = {
    host:     process.env.PGHOST,
    port:     parseInt(process.env.PGPORT) || 5432,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl:      sslConfig,
  };
} else {
  poolConfig = {
    host:     process.env.DB_HOST     || 'postgres',
    port:     parseInt(process.env.DB_PORT) || 5432,
    user:     process.env.DB_USER     || 'supervisor',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME     || 'supervisor_db',
  };
}

const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('DB pool error:', err.message));

module.exports = pool;
