/** Módulo de Pets Perdidos: regra da fuga obrigatória (veja utils/regrasAnimal.js). */
const { criarCategoria, listarCategoria } = require('./animais.controller');

module.exports = {
  cadastrarPetPerdido: criarCategoria('PERDIDO'),
  listarPetsPerdidos: listarCategoria('PERDIDO'),
};
