/**
 * Módulo de Animais Encontrados (rotas /api/animais/encontrados).
 * Adaptado dos testes originais: agora o cadastro exige login, sexo e foto,
 * e cada teste cria os próprios dados no banco de TESTES.
 */
const request = require('supertest');
const app = require('../src/app');
const {
  pool,
  recriarEsquema,
  limparTabelas,
  limparUploads,
  contarUploads,
  criarFotoGrande,
  entrar,
  inserirAnimal,
} = require('./helpers');

let foto;
let agent;

beforeAll(async () => {
  await recriarEsquema();
  foto = await criarFotoGrande();
});
beforeEach(async () => {
  await limparTabelas();
  limparUploads();
  agent = await entrar(request, app);
});
afterAll(async () => {
  limparUploads();
  await pool.end();
});

function enviar(cliente, campos = {}) {
  const dados = { sexo: 'F', descricao: 'Gatinho rajado encontrado perto da padaria.', ...campos };
  let req = cliente.post('/api/animais/encontrados').set('Accept', 'application/json');
  for (const [chave, valor] of Object.entries(dados)) {
    if (valor !== undefined) req = req.field(chave, valor);
  }
  return req.attach('foto', foto, { filename: 'gato.jpg', contentType: 'image/jpeg' });
}

describe('Módulo de Animais Encontrados', () => {
  it('deve cadastrar um animal ENCONTRADO com sucesso (sem nome e sem fuga)', async () => {
    const response = await enviar(agent); // não enviamos "nome" nem "detalhes_fuga"

    expect(response.status).toBe(201);
    expect(response.body.animal.categoria).toBe('ENCONTRADO');
    expect(response.body.animal.nome).toBeNull();

    const { rows } = await pool.query('SELECT nome, detalhes_fuga FROM animais');
    expect(rows).toEqual([{ nome: null, detalhes_fuga: null }]);
  });

  it('aceita nome quando a pessoa sabe o nome do animal', async () => {
    const response = await enviar(agent, { nome: 'Mimi' });
    expect(response.status).toBe(201);
    expect(response.body.animal.nome).toBe('Mimi');
  });

  it('deve retornar erro 400 se tentar enviar detalhes_fuga num animal ENCONTRADO', async () => {
    const response = await enviar(agent, { descricao: 'Cachorro caramelo.', detalhes_fuga: 'Fugiu ontem' });

    expect(response.status).toBe(400);
    expect(response.body.campos.detalhes_fuga).toMatch(/pets perdidos/i);
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
    expect(contarUploads()).toBe(0);
  });

  it('deve listar todos os animais encontrados com status 200', async () => {
    const usuarioId = (await pool.query('SELECT id FROM usuarios')).rows[0].id;
    await inserirAnimal(usuarioId, { categoria: 'ENCONTRADO', nome: null });
    await inserirAnimal(usuarioId, { categoria: 'PERDIDO', nome: 'Mel', detalhes_fuga: 'fuga' });
    await inserirAnimal(usuarioId, { categoria: 'ADOCAO', nome: 'Rex' });

    const response = await request(app).get('/api/animais/encontrados');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.itens)).toBe(true);
    expect(response.body.itens).toHaveLength(1);
    expect(response.body.itens[0].categoria).toBe('ENCONTRADO');
  });

  // ---- novidades da integração com Autenticação e banco oficial ----
  it('exige login (401) e não grava nada', async () => {
    const response = await enviar(request(app));
    expect(response.status).toBe(401);
    expect((await pool.query('SELECT 1 FROM animais')).rowCount).toBe(0);
  });

  it('o dono do animal é o usuário da sessão, mesmo que o corpo mande outro usuario_id', async () => {
    await entrar(request, app, { email: 'outra@teste.com', nome: 'Outra Pessoa' }); // usuário 2
    const response = await enviar(agent, { usuario_id: '2' });
    expect(response.status).toBe(201);
    expect((await pool.query('SELECT usuario_id FROM animais')).rows).toEqual([{ usuario_id: 1 }]);
  });

  it('o ícone de gênero vem do sexo salvo no banco', async () => {
    await enviar(agent, { sexo: 'F' }).expect(201);
    const { itens } = (await request(app).get('/api/animais/encontrados')).body;
    expect(itens[0]).toMatchObject({ sexo: 'F', sexoRotulo: 'Fêmea', sexoIcone: '/img/icon-sexo/fem.png' });
  });

  it('exige sexo e descrição', async () => {
    const semSexo = await enviar(agent, { sexo: undefined });
    expect(semSexo.status).toBe(400);
    expect(semSexo.body.campos.sexo).toBeDefined();

    const semDescricao = await enviar(agent, { descricao: ' ' });
    expect(semDescricao.status).toBe(400);
    expect(semDescricao.body.campos.descricao).toBeDefined();
  });

  it('o contato do responsável aparece no detalhe (WhatsApp para o dono achar o pet)', async () => {
    const criado = (await enviar(agent)).body.animal;
    const detalhe = (await request(app).get(`/api/animais/${criado.id}`)).body.animal;
    expect(detalhe.whatsapp).toBe('5547999998888'); // telefone do usuário logado
    expect(detalhe.responsavel.nome).toBe('ONG Patas');
  });
});
