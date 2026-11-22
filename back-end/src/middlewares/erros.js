const multer = require('multer');
const { ErroHttp } = require('../utils/erros');
const { falha } = require('../utils/responder');

function naoEncontrado(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada.' });
}

// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let mensagem = 'Erro interno. Tente novamente em instantes.';
  let campos;

  if (err instanceof ErroHttp) {
    status = err.status;
    mensagem = err.message;
    campos = err.campos;
  } else if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      mensagem = 'A foto deve ter no máximo 10 MB.';
    } else {
      status = 400;
      mensagem = 'Não foi possível processar o envio.';
    }
  } else if (err.type === 'entity.too.large') {
    status = 413;
    mensagem = 'Requisição grande demais.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    mensagem = 'JSON inválido.';
  } else {
    console.error(err);
  }

  falha(req, res, status, mensagem, { redirect: req.retornoErro, campos });
}

module.exports = { naoEncontrado, tratarErros };
