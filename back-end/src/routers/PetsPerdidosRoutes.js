const express = require('express');
const router = express.Router();
const petsPerdidosController = require('../controllers/PetsPerdidosController');

// Quando receber dados via POST, aciona a função do controller
router.post('/', petsPerdidosController.cadastrarPetPerdido);
router.get('/', petsPerdidosController.listarPetsPerdidos);

module.exports = router;