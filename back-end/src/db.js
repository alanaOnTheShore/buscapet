const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on('error', (erro) => console.error('Erro inesperado no pool do PostgreSQL:', erro));

module.exports = { pool };
