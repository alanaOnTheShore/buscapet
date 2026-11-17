const db = require('../config/db'); // Importa a tua ligação à base de dados

const criarPetPerdido = async (dadosPet) => {
  const { usuario_id, nome, descricao, detalhes_fuga } = dadosPet;
  const categoria = 'PERDIDO'; // Forçamos a categoria para garantir que não há erros

  // A query SQL. Usamos $1, $2, etc., para evitar ataques de SQL Injection
  const query = `
    INSERT INTO animais (usuario_id, categoria, nome, descricao, detalhes_fuga)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  
  const valores = [usuario_id, categoria, nome, descricao, detalhes_fuga];

  // Executa o comando na base de dados e devolve a linha que acabou de ser criada
  const resultado = await db.query(query, valores);
  return resultado.rows[0];
};

module.exports = {
  criarPetPerdido
};

const listarPetsPerdidos = async () => {
  const query = `
    SELECT * FROM animais 
    WHERE categoria = 'PERDIDO' 
    ORDER BY criado_em DESC;
  `;
  
  const resultado = await db.query(query);
  return resultado.rows; // Retorna a lista de animais
};

module.exports = {
  criarPetPerdido,
  listarPetsPerdidos
};