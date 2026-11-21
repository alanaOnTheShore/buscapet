/**
 * Teste de Integração: Autenticação <-> Adoção
 * Verifica se os dois módulos funcionam JUNTOS (sessão, dono do anúncio,
 * logout, conta excluída, recuperação de senha, páginas protegidas).
 * Os testes unitários de cada módulo ficam em auth.test.js e adocao.test.js.
 */
jest.mock('../src/utils/email', () => ({
  enviarEmailRecuperacao: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const email = require('../src/utils/email');
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
  email.enviarEmailRecuperacao.mockClear();
});
afterAll(async () => {
  limparUploads();
  await pool.end();
});

const USUARIO_A = { nome: 'ONG Patas', email: 'a@teste.com', telefone: '(47) 99999-1111' };
const USUARIO_B = { nome: 'Maria Silva', email: 'b@teste.com', telefone: '(11) 98888-2222', tipo: 'PESSOA' };

/** Envia o formulário de cadastro de pet (multipart), como o front faz. */
function enviarPet(cliente, campos = {}, { json = true } = {}) {
  let req = cliente.post('/api/animais').set('Accept', json ? 'application/json' : 'text/html');
  const dados = { categoria: 'ADOCAO', nome: 'Rex', sexo: 'M', descricao: 'Cachorro dócil.', detalhes_fuga: '', ...campos };
  for (const [chave, valor] of Object.entries(dados)) req = req.field(chave, valor);
  return req.attach('foto', foto, { filename: 'foto.jpg', contentType: 'image/jpeg' });
}

const assinar = (payload, segredo = process.env.JWT_SECRET) =>
  jwt.sign(payload, segredo, { algorithm: 'HS256' });

const totalAnimais = async () => (await pool.query('SELECT 1 FROM animais')).rowCount;

// =====================================================================
describe('Jornada completa do usuário', () => {
  test('cadastro -> (sem login não cadastra pet) -> login -> cadastra -> aparece na lista e no detalhe', async () => {
    const agent = request.agent(app);

    // 1. conta criada
    await agent.post('/cadastrar').send({ ...USUARIO_A, tipo: 'ONG', senha: 'senha123', 'conf-senha': 'senha123' }).expect(201);

    // 2. ainda sem login: o módulo de Adoção barra o cadastro do pet
    expect((await enviarPet(agent)).status).toBe(401);
    expect(await totalAnimais()).toBe(0);

    // 3. login e cadastro do pet
    await agent.post('/login').send({ email: USUARIO_A.email, senha: 'senha123' }).expect(200);
    const criado = await enviarPet(agent, { nome: 'Fabi', sexo: 'F' });
    expect(criado.status).toBe(201);

    // 4. a lista pública mostra o pet, com o ícone de gênero vindo do banco
    const lista = await request(app).get('/api/animais?categoria=ADOCAO');
    expect(lista.body.itens).toHaveLength(1);
    expect(lista.body.itens[0]).toMatchObject({ nome: 'Fabi', sexoIcone: '/img/icon-sexo/fem.png' });

    // 5. o detalhe aponta para QUEM está logado (responsável e WhatsApp do cadastro)
    const detalhe = await request(app).get(`/api/animais/${criado.body.animal.id}`);
    expect(detalhe.body.animal.responsavel).toEqual({ nome: 'ONG Patas', tipo: 'ONG' });
    expect(detalhe.body.animal.whatsapp).toBe('5547999991111');
  });

  test('recuperar a senha e entrar com a nova senha devolve o acesso ao cadastro de pets', async () => {
    await request(app).post('/cadastrar').send({ ...USUARIO_A, senha: 'senha123', 'conf-senha': 'senha123' }).expect(201);

    await request(app).post('/api/recuperar-senha').send({ email: USUARIO_A.email }).expect(200);
    const token = new URL(email.enviarEmailRecuperacao.mock.calls[0][0].link).searchParams.get('token');
    await request(app)
      .post('/atualizar-senha')
      .send({ token, senha: 'novasenha1', 'conf-senha': 'novasenha1' })
      .expect(200);

    const agent = request.agent(app);
    await agent.post('/login').send({ email: USUARIO_A.email, senha: 'senha123' }).expect(401); // senha antiga
    await agent.post('/login').send({ email: USUARIO_A.email, senha: 'novasenha1' }).expect(200);
    expect((await enviarPet(agent)).status).toBe(201);
  });
});

// =====================================================================
describe('Dono do anúncio = usuário da sessão', () => {
  test('não é possível cadastrar um pet "em nome de" outro usuário (campo usuario_id é ignorado)', async () => {
    await entrar(request, app, USUARIO_A); // vira o usuário 1
    const agenteB = await entrar(request, app, USUARIO_B); // usuário 2

    const res = await enviarPet(agenteB, { usuario_id: '1' });
    expect(res.status).toBe(201);

    const { rows } = await pool.query('SELECT usuario_id FROM animais');
    expect(rows).toEqual([{ usuario_id: 2 }]);
  });

  test('cada anúncio mostra o contato do SEU responsável', async () => {
    const agenteA = await entrar(request, app, USUARIO_A);
    const agenteB = await entrar(request, app, USUARIO_B);

    const petA = (await enviarPet(agenteA, { nome: 'PetDaOng' })).body.animal.id;
    const petB = (await enviarPet(agenteB, { nome: 'PetDaMaria' })).body.animal.id;

    const detalheA = (await request(app).get(`/api/animais/${petA}`)).body.animal;
    const detalheB = (await request(app).get(`/api/animais/${petB}`)).body.animal;

    expect(detalheA.responsavel.nome).toBe('ONG Patas');
    expect(detalheA.whatsapp).toBe('5547999991111');
    expect(detalheB.responsavel.nome).toBe('Maria Silva');
    expect(detalheB.whatsapp).toBe('5511988882222');
  });
});

// =====================================================================
describe('Fim ou invalidação da sessão', () => {
  test('depois do logout não é mais possível cadastrar pets', async () => {
    const agent = await entrar(request, app, USUARIO_A);
    expect((await enviarPet(agent)).status).toBe(201);

    await agent.post('/api/logout').expect(200);

    expect((await enviarPet(agent, { nome: 'Outro' })).status).toBe(401);
    expect(await totalAnimais()).toBe(1);
  });

  test('conta excluída perde a sessão mesmo com cookie válido: não cadastra pets', async () => {
    const agent = await entrar(request, app, USUARIO_A);
    await pool.query('DELETE FROM usuarios');

    expect((await enviarPet(agent)).status).toBe(401);
    expect(await totalAnimais()).toBe(0);
    expect(contarUploads()).toBe(0); // a foto nem chegou a ser processada
  });

  test('cookie assinado com outro segredo, expirado ou sem dados é recusado', async () => {
    await request(app).post('/cadastrar').send({ ...USUARIO_A, senha: 'senha123', 'conf-senha': 'senha123' }).expect(201);
    const agora = Math.floor(Date.now() / 1000);

    const tokens = {
      'segredo errado': assinar({ sub: '1' }, 'outro-segredo-qualquer-com-32-caracteres!!'),
      expirado: assinar({ sub: '1', exp: agora - 60 }),
      'sem sub': assinar({ qualquer: 'coisa' }),
      'usuário inexistente': assinar({ sub: '999' }),
    };

    for (const [motivo, token] of Object.entries(tokens)) {
      const res = await enviarPet(request(app)).set('Cookie', `buscapet_sessao=${token}`);
      expect([motivo, res.status]).toEqual([motivo, 401]);
    }
    expect(await totalAnimais()).toBe(0);
  });

  test('excluir a conta apaga os anúncios e eles somem da lista pública (CASCADE)', async () => {
    const agent = await entrar(request, app, USUARIO_A);
    await enviarPet(agent).expect(201);
    expect((await request(app).get('/api/animais')).body.itens).toHaveLength(1);

    await pool.query('DELETE FROM usuarios');

    expect((await request(app).get('/api/animais')).body.itens).toHaveLength(0);
    expect((await pool.query('SELECT 1 FROM fotos_animal')).rowCount).toBe(0);
  });
});

// =====================================================================
describe('Formulários HTML e páginas protegidas', () => {
  test('formulário de cadastro de pet sem login volta ao início com ?erro=', async () => {
    const res = await enviarPet(request(app), {}, { json: false });
    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/^\/index\.html\?erro=/);
  });

  test('formulário de cadastro de pet com login leva a Meus Pets', async () => {
    const agent = await entrar(request, app, USUARIO_A);
    const res = await enviarPet(agent, {}, { json: false });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/meus-pets.html?cadastrado=1');
  });

  test('página de cadastro de pet: bloqueada sem login, liberada com login, bloqueada após logout', async () => {
    const agent = request.agent(app);
    expect((await agent.get('/cadastro-pet.html')).status).toBe(302);

    await agent.post('/cadastrar').send({ ...USUARIO_A, senha: 'senha123', 'conf-senha': 'senha123' }).expect(201);
    await agent.post('/login').send({ email: USUARIO_A.email, senha: 'senha123' }).expect(200);
    const liberada = await agent.get('/cadastro-pet.html');
    expect(liberada.status).toBe(200);
    expect(liberada.headers['content-type']).toMatch(/text\/html/);

    await agent.post('/api/logout').expect(200);
    expect((await agent.get('/cadastro-pet.html')).status).toBe(302);
  });

  test('a visualização (home) continua pública mesmo sem login', async () => {
    expect((await request(app).get('/home.html')).status).toBe(200);
    expect((await request(app).get('/api/animais')).status).toBe(200);
  });
});
