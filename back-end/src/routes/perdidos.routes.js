const express = require('express');
const { ah } = require('../utils/assincrono');
const { definirRetorno } = require('../middlewares/retorno');
const { exigirLogin } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const { bloquearEnvioSimultaneo } = require('../middlewares/envio');
const controller = require('../controllers/perdidos.controller');

const router = express.Router();

router.get('/', ah(controller.listarPetsPerdidos));
router.post(
  '/',
  definirRetorno('/cadastro-pet.html?tipo=PERDIDO'),
  exigirLogin,
  bloquearEnvioSimultaneo,
  upload.single('foto'),
  ah(controller.cadastrarPetPerdido)
);

module.exports = router;
