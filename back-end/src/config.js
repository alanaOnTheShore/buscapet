const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ambiente = process.env.NODE_ENV || 'development';
const producao = ambiente === 'production';
const porta = Number(process.env.PORT) || 3000;

if (producao) {
  for (const nome of ['DATABASE_URL', 'JWT_SECRET', 'APP_URL']) {
    if (!process.env[nome]) {
      throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
    }
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  }
}

module.exports = {
  ambiente,
  producao,
  teste: ambiente === 'test',
  porta,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'segredo-apenas-para-desenvolvimento-local-0000',
  sessaoDias: 7,
  // URL pública do site (usada no link do e-mail de recuperação)
  appUrl: (process.env.APP_URL || `http://localhost:${porta}`).replace(/\/$/, ''),
  // Os HTML/CSS/IMG ficam na raiz do repositório (uma pasta acima de back-end/)
  raizFront: path.join(__dirname, '..', '..'),
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  emailFrom: process.env.EMAIL_FROM || 'BuscaPet <nao-responda@buscapet.local>',
};
