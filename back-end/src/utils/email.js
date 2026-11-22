const nodemailer = require('nodemailer');
const config = require('../config');

let transporte;
function obterTransporte() {
  if (!config.smtp.host) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporte;
}

const escapar = (valor) =>
  String(valor).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function enviarEmailRecuperacao({ para, nome, link }) {
  const transp = obterTransporte();
  if (!transp) {
    if (config.producao) {
      console.error('SMTP não configurado: e-mail de recuperação NÃO enviado.');
    } else {
      console.log(`\n[e-mail simulado] Para: ${para}\nLink de recuperação: ${link}\n`);
    }
    return;
  }

  const texto =
    `Olá, ${nome}!\n\n` +
    `Recebemos um pedido para redefinir a sua senha no BuscaPet.\n` +
    `Acesse o link abaixo (válido por 1 hora):\n${link}\n\n` +
    `Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.`;

  const html =
    `<p>Olá, ${escapar(nome)}!</p>` +
    `<p>Recebemos um pedido para redefinir a sua senha no <strong>BuscaPet</strong>.</p>` +
    `<p><a href="${escapar(link)}">Clique aqui para criar uma nova senha</a> (link válido por 1 hora).</p>` +
    `<p>Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.</p>`;

  await transp.sendMail({
    from: config.emailFrom,
    to: para,
    subject: 'BuscaPet - Redefinição de senha',
    text: texto,
    html,
  });
}

module.exports = { enviarEmailRecuperacao };
