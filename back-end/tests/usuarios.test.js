/**
 * Módulo de Perfil do usuário (rotas /api/me).
 * GET /api/me já é coberto em auth.test.js; aqui: editar o perfil e excluir a conta.
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
} = require('./helpers');

let foto;

beforeAll(async () => {
  await recriarEsquema();
  foto = await criarFotoGrande();
});
beforeEach(async () => {
  await limparTabelas();
  limparUploads();
});
afterAll(async () => {
  limparUploads();
  await pool.end();
});

const OUTRO_USUARIO = { nome: 'Maria Silva', email: 'maria@teste.com', telefone: '(11) 98888-2222', tipo: 'PESSOA' };

/** Cadastra um pet de verdade (com upload da foto), como o formulário do front faz. */
function enviarPet(cliente, campos = {}) {
  let req = cliente.post('/api/animais').set('Accept', 'application/json');
  const dados = { categoria: 'ADOCAO', nome: 'Rex', sexo: 'M', descricao: 'Cachorro dócil.', detalhes_fuga: '', ...campos };
  for (const [chave, valor] of Object.entries(dados)) req = req.field(chave, valor);
  return req.attach('foto', foto, { filename: 'foto.jpg', contentType: 'image/jpeg' });
}

// =====================================================================
describe('Editar perfil (PATCH /api/me)', () => {
  test('exige login (401) e não altera nada', async () => {
    await entrar(request, app);
    const res = await request(app).patch('/api/me').send({ nome: 'Invasor', telefone: '(47) 98888-7777' });

    expect(res.status).toBe(401);
    expect((await pool.query('SELECT nome FROM usuarios')).rows[0].nome).toBe('ONG Patas');
  });

  test('atualiza nome e telefone, devolve o usuário e o /api/me já mostra os dados novos', async () => {
    const agent = await entrar(request, app);

    const res = await agent.patch('/api/me').send({ nome: '  Novo Nome  ', telefone: '(47) 98888-7777' });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toEqual({
      id: 1,
      nome: 'Novo Nome', // sem os espaços das pontas
      email: 'ong@teste.com',
      telefone: '(47) 98888-7777',
      tipo: 'ONG',
    });
    expect((await pool.query('SELECT nome, telefone FROM usuarios')).rows).toEqual([
      { nome: 'Novo Nome', telefone: '(47) 98888-7777' },
    ]);
    expect((await agent.get('/api/me')).body.usuario.nome).toBe('Novo Nome');
  });

  test('e-mail, tipo, senha e id enviados no corpo são ignorados', async () => {
    const agent = await entrar(request, app);
    const { senha_hash: hashAntes } = (await pool.query('SELECT senha_hash FROM usuarios')).rows[0];

    await agent
      .patch('/api/me')
      .send({
        nome: 'Nome',
        telefone: '(47) 98888-7777',
        email: 'invasor@teste.com',
        tipo: 'PESSOA',
        senha: 'outrasenha1',
        id: 99,
      })
      .expect(200);

    expect((await pool.query('SELECT id, email, tipo, senha_hash FROM usuarios')).rows).toEqual([
      { id: 1, email: 'ong@teste.com', tipo: 'ONG', senha_hash: hashAntes },
    ]);
  });

  test('altera somente a conta da sessão, nunca a de outra pessoa', async () => {
    const agenteA = await entrar(request, app);
    await entrar(request, app, OUTRO_USUARIO);

    await agenteA.patch('/api/me').send({ nome: 'Só a A mudou', telefone: '(47) 98888-7777' }).expect(200);

    const { rows } = await pool.query('SELECT id, nome, telefone FROM usuarios ORDER BY id');
    expect(rows).toEqual([
      { id: 1, nome: 'Só a A mudou', telefone: '(47) 98888-7777' },
      { id: 2, nome: 'Maria Silva', telefone: '(11) 98888-2222' },
    ]);
  });

  test.each([
    ['sem nome', { nome: '   ' }, 'nome'],
    ['nome muito longo (121 caracteres)', { nome: 'a'.repeat(121) }, 'nome'],
    ['sem telefone', { telefone: '' }, 'telefone'],
    ['telefone inválido', { telefone: '123' }, 'telefone'],
  ])('rejeita %s (400) e não altera nada', async (_descricao, alteracao, campo) => {
    const agent = await entrar(request, app);

    const res = await agent.patch('/api/me').send({ nome: 'Nome Válido', telefone: '(47) 98888-7777', ...alteracao });

    expect(res.status).toBe(400);
    expect(res.body.campos[campo]).toBeDefined();
    expect((await pool.query('SELECT nome, telefone FROM usuarios')).rows).toEqual([
      { nome: 'ONG Patas', telefone: '(47) 99999-8888' },
    ]);
  });
});

// =====================================================================
describe('Excluir conta (DELETE /api/me)', () => {
  test('exige login (401) e não apaga ninguém', async () => {
    await entrar(request, app);

    expect((await request(app).delete('/api/me')).status).toBe(401);
    expect((await pool.query('SELECT 1 FROM usuarios')).rowCount).toBe(1);
  });

  test('apaga a conta, os anúncios, as fotos do banco e os arquivos das fotos', async () => {
    const agent = await entrar(request, app);
    await enviarPet(agent).expect(201);
    await enviarPet(agent, { nome: 'Fabi', sexo: 'F' }).expect(201);
    expect(contarUploads()).toBe(2);

    const res = await agent.delete('/api/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    for (const tabela of ['usuarios', 'animais', 'fotos_animal']) {
      expect((await pool.query(`SELECT 1 FROM ${tabela}`)).rowCount).toBe(0);
    }
    expect(contarUploads()).toBe(0);
  });

  test('a sessão deixa de valer na hora', async () => {
    const agent = await entrar(request, app);

    await agent.delete('/api/me').expect(200);

    expect((await agent.get('/api/me')).status).toBe(401);
  });

  test('não mexe nos dados (nem nas fotos) de outros usuários', async () => {
    const agenteA = await entrar(request, app);
    const agenteB = await entrar(request, app, OUTRO_USUARIO);
    await enviarPet(agenteA, { nome: 'PetDaA' }).expect(201);
    await enviarPet(agenteB, { nome: 'PetDaB' }).expect(201);
    expect(contarUploads()).toBe(2);

    await agenteA.delete('/api/me').expect(200);

    expect((await pool.query('SELECT id FROM usuarios')).rows).toEqual([{ id: 2 }]);
    expect((await pool.query('SELECT nome FROM animais')).rows).toEqual([{ nome: 'PetDaB' }]);
    expect(contarUploads()).toBe(1);
    expect((await agenteB.get('/api/me')).status).toBe(200);
  });
});
