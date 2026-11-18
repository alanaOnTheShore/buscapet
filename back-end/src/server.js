const config = require('./config');
const { pool } = require('./db');
const app = require('./app');

async function iniciar() {
  await pool.query('SELECT 1'); // falha cedo se o banco estiver inacessível
  const servidor = app.listen(config.porta, () => {
    console.log(`BuscaPet rodando em ${config.appUrl} (${config.ambiente})`);
  });

  const encerrar = () => {
    servidor.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

iniciar().catch((erro) => {
  console.error('Não foi possível iniciar:', erro.message);
  process.exit(1);
});
