const multer = require('multer');
const { ErroHttp } = require('../utils/erros');

const LIMITE_FOTO_BYTES = 10 * 1024 * 1024; // 10 MB: só para entrada; o que fica salvo é ~50-100 KB

/** Foto em memória (não vai para o disco antes de ser otimizada). */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_FOTO_BYTES, files: 1, fields: 20, fieldSize: 16 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) {
      const msg = 'O arquivo enviado não é uma imagem.';
      return cb(new ErroHttp(400, msg, { foto: msg }));
    }
    cb(null, true);
  },
});

module.exports = { upload };
