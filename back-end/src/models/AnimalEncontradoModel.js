const db = require('../config/db');

const criarAnimalEncontrado = async (dadosAnimal) => {
  const { usuario_id, nome, descricao } = dadosAnimal;
  const categoria = 'ENCONTRADO';
  
  // Garantimos que detalhes_fuga é nulo
  const detalhes_fuga = null; 

  const query = `
    INSERT INTO animais (usuario_id, categoria, nome, descricao, detalhes_fuga)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  
  const valores = [usuario_id, categoria, nome, descricao, detalhes_fuga];

  const resultado = await db.query(query, valores);
  return resultado.rows[0];
};

module.exports = {
  criarAnimalEncontrado
};

const listarAnimaisEncontrados = async () => {
  const query = `
    SELECT * FROM animais 
    WHERE categoria = 'ENCONTRADO' 
    ORDER BY criado_em DESC;
  `;
  
  const resultado = await db.query(query);
  return resultado.rows;
};

module.exports = {
  criarAnimalEncontrado,
  listarAnimaisEncontrados
};