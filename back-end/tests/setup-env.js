// Executa antes de cada arquivo de teste: aponta tudo para o banco de TESTES.
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Defina TEST_DATABASE_URL (banco SEPARADO para testes) no arquivo back-end/.env');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres-ok';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'buscapet-uploads-teste');
process.env.APP_URL = 'http://localhost:3000';
delete process.env.SMTP_HOST;
