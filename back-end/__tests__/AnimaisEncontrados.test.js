const request = require('supertest');
const app = require('../src/app');

describe('Módulo de Animais Encontrados', () => {
  
  it('deve cadastrar um animal ENCONTRADO com sucesso (sem nome e sem fuga)', async () => {
    const animalEncontradoMock = {
      usuario_id: 1,
      categoria: 'ENCONTRADO',
      descricao: 'Gatinho rajado encontrado perto da padaria.'
      // Não enviamos "nome" nem "detalhes_fuga"
    };

    const response = await request(app)
      .post('/api/animais/encontrados')
      .send(animalEncontradoMock);

    expect(response.status).toBe(201);
    expect(response.body.categoria).toBe('ENCONTRADO');
  });

  it('deve retornar erro 400 se tentar enviar detalhes_fuga num animal ENCONTRADO', async () => {
    const animalComFuga = {
      usuario_id: 1,
      categoria: 'ENCONTRADO',
      descricao: 'Cachorro caramelo.',
      detalhes_fuga: 'Fugiu ontem' // O banco não permite isso para esta categoria
    };

    const response = await request(app)
      .post('/api/animais/encontrados')
      .send(animalComFuga);

    expect(response.status).toBe(400); 
  });

  it('deve listar todos os animais encontrados com status 200', async () => {
    const response = await request(app).get('/api/animais/encontrados');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
});