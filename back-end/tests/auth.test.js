jest.mock('../src/utils/email', () => ({
  enviarEmailRecuperacao: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const email = require('../src/utils/email');
const { pool, recriarEsquema, limparTabelas, DADOS_USUARIO, entrar } = require('./helpers');

beforeAll(recriarEsquema);
beforeEach(async () => {
  await limparTabelas();
  email.enviarEmailRecuperacao.mockClear();
});
afterAll(() => pool.end());

const tokenDoEmail = (chamada = 0) =>
  new URL(email.enviarEmailRecuperacao.mock.calls[chamada][0].link).searchParams.get('token');

// =====================================================================
describe('Cadastro (POST /cadastrar)', () => {
  test('cria usuário, guarda só o hash da senha e não devolve dados sensíveis', async () => {
    const res = await request(app).post('/cadastrar').send(DADOS_USUARIO);

    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ nome: 'ONG Patas', email: 'ong@teste.com', tipo: 'ONG' });
    expect(res.body.usuario.senha_hash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('senha123');

    const { rows } = await pool.query('SELECT senha_hash FROM usuarios');
    expect(rows[0].senha_hash).not.toBe('senha123');
    expect(await bcrypt.compare('senha123', rows[0].senha_hash)).toBe(true);
  });

  test('e-mail duplicado é recusado (409), inclusive com maiúsculas', async () => {
    await request(app).post('/cadastrar').send(DADOS_USUARIO).expect(201);
    const res = await request(app)
      .post('/cadastrar')
      .send({ ...DADOS_USUARIO, email: 'ONG@Teste.com' });
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/já está cadastrado/i);
  });

  test('tipo padrão é PESSOA', async () => {
    const { tipo, ...semTipo } = DADOS_USUARIO;
    const res = await request(app).post('/cadastrar').send(semTipo);
    expect(res.status).toBe(201);
    expect(res.body.usuario.tipo).toBe('PESSOA');
  });

  test.each([
    ['nome vazio', { nome: '  ' }, 'nome'],
    ['nome com mais de 120 caracteres', { nome: 'a'.repeat(121) }, 'nome'],
    ['e-mail inválido', { email: 'abc' }, 'email'],
    ['e-mail sem domínio', { email: 'abc@' }, 'email'],
    ['telefone curto', { telefone: '123' }, 'telefone'],
    ['tipo inválido', { tipo: 'ADMIN' }, 'tipo'],
    ['senha curta', { senha: '123', 'conf-senha': '123' }, 'senha'],
    ['senha com mais de 72 bytes', { senha: 'a'.repeat(73), 'conf-senha': 'a'.repeat(73) }, 'senha'],
    ['senhas diferentes', { 'conf-senha': 'outra-senha' }, 'confSenha'],
  ])('rejeita %s (400)', async (_descricao, alteracao, campo) => {
    const res = await request(app).post('/cadastrar').send({ ...DADOS_USUARIO, ...alteracao });
    expect(res.status).toBe(400);
    expect(res.body.campos[campo]).toBeDefined();
    expect((await pool.query('SELECT 1 FROM usuarios')).rowCount).toBe(0);
  });

  test('formulário HTML: sucesso redireciona e erro volta com ?erro=', async () => {
    const ok = await request(app)
      .post('/cadastrar')
      .type('form')
      .set('Accept', 'text/html')
      .send(DADOS_USUARIO);
    expect(ok.status).toBe(303);
    expect(ok.headers.location).toBe('/index.html?cadastro=ok');

    const erro = await request(app)
      .post('/cadastrar')
      .type('form')
      .set('Accept', 'text/html')
      .send(DADOS_USUARIO); // e-mail repetido
    expect(erro.status).toBe(303);
    expect(erro.headers.location).toMatch(/^\/cadastro-perfil\.html\?erro=/);
  });
});

// =====================================================================
describe('Login, sessão e logout', () => {
  beforeEach(() => request(app).post('/cadastrar').send(DADOS_USUARIO).expect(201));

  test('login correto cria cookie HttpOnly e /api/me devolve o usuário', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/login').send({ email: 'ong@teste.com', senha: 'senha123' });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/buscapet_sessao=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.usuario.email).toBe('ong@teste.com');
  });

  test('e-mail é aceito em qualquer caixa e com espaços', async () => {
    const res = await request(app).post('/login').send({ email: '  ONG@Teste.COM ', senha: 'senha123' });
    expect(res.status).toBe(200);
  });

  test('senha errada e e-mail inexistente dão a MESMA resposta (não revela quem existe)', async () => {
    const errada = await request(app).post('/login').send({ email: 'ong@teste.com', senha: 'errada123' });
    const inexistente = await request(app).post('/login').send({ email: 'x@teste.com', senha: 'senha123' });

    expect(errada.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(errada.body).toEqual(inexistente.body);
    expect(errada.headers['set-cookie']).toBeUndefined();
  });

  test('sem corpo / sem senha é recusado', async () => {
    expect((await request(app).post('/login').send({})).status).toBe(401);
    expect((await request(app).post('/login').send({ email: 'ong@teste.com' })).status).toBe(401);
  });

  test('/api/me sem login e com cookie adulterado -> 401', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
    const res = await request(app).get('/api/me').set('Cookie', 'buscapet_sessao=token.falso.aqui');
    expect(res.status).toBe(401);
  });

  test('usuário excluído perde a sessão mesmo com cookie válido', async () => {
    const agent = request.agent(app);
    await agent.post('/login').send({ email: 'ong@teste.com', senha: 'senha123' });
    await pool.query('DELETE FROM usuarios');
    expect((await agent.get('/api/me')).status).toBe(401);
  });

  test('logout encerra a sessão', async () => {
    const agent = request.agent(app);
    await agent.post('/login').send({ email: 'ong@teste.com', senha: 'senha123' });
    await agent.post('/api/logout').expect(200);
    expect((await agent.get('/api/me')).status).toBe(401);
  });

  test('formulário HTML: login vai para /home.html; erro volta ao /index.html com ?erro=', async () => {
    const ok = await request(app)
      .post('/login')
      .type('form')
      .set('Accept', 'text/html')
      .send({ email: 'ong@teste.com', senha: 'senha123' });
    expect(ok.status).toBe(303);
    expect(ok.headers.location).toBe('/home.html');

    const erro = await request(app)
      .post('/login')
      .type('form')
      .set('Accept', 'text/html')
      .send({ email: 'ong@teste.com', senha: 'errada123' });
    expect(erro.status).toBe(303);
    expect(erro.headers.location).toMatch(/^\/index\.html\?erro=/);
  });
});

// =====================================================================
describe('Recuperação de senha', () => {
  beforeEach(() => request(app).post('/cadastrar').send(DADOS_USUARIO).expect(201));

  test('e-mail desconhecido recebe a mesma resposta e nenhum e-mail é enviado', async () => {
    const conhecido = await request(app).post('/api/recuperar-senha').send({ email: 'ong@teste.com' });
    email.enviarEmailRecuperacao.mockClear();
    const desconhecido = await request(app).post('/api/recuperar-senha').send({ email: 'nada@teste.com' });

    expect(desconhecido.status).toBe(200);
    expect(desconhecido.body).toEqual(conhecido.body);
    expect(email.enviarEmailRecuperacao).not.toHaveBeenCalled();
  });

  test('e-mail inválido também responde 200 (sem revelar nada)', async () => {
    const res = await request(app).post('/api/recuperar-senha').send({ email: 'abc' });
    expect(res.status).toBe(200);
    expect(email.enviarEmailRecuperacao).not.toHaveBeenCalled();
  });

  test('envia e-mail com link e guarda só o HASH do token, com validade de ~1h', async () => {
    await request(app).post('/api/recuperar-senha').send({ email: 'ong@teste.com' }).expect(200);

    expect(email.enviarEmailRecuperacao).toHaveBeenCalledTimes(1);
    const { para, link } = email.enviarEmailRecuperacao.mock.calls[0][0];
    expect(para).toBe('ong@teste.com');
    expect(link).toMatch(/^http:\/\/localhost:3000\/criar-nova-senha\.html\?token=[a-f0-9]{64}$/);

    const token = tokenDoEmail();
    const { rows } = await pool.query(
      `SELECT token_hash, EXTRACT(EPOCH FROM (expira_em - criado_em)) AS segundos FROM tokens_recuperacao`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toHaveLength(64);
    expect(Number(rows[0].segundos)).toBeGreaterThan(3500);
    expect(Number(rows[0].segundos)).toBeLessThanOrEqual(3600);
  });

  test('um novo pedido invalida o link anterior', async () => {
    await request(app).post('/api/recuperar-senha').send({ email: 'ong@teste.com' });
    await request(app).post('/api/recuperar-senha').send({ email: 'ong@teste.com' });
    const antigo = tokenDoEmail(0);
    const novo = tokenDoEmail(1);

    const res = await request(app)
      .post('/atualizar-senha')
      .send({ token: antigo, senha: 'novasenha1', 'conf-senha': 'novasenha1' });
    expect(res.status).toBe(400);

    await request(app)
      .post('/atualizar-senha')
      .send({ token: novo, senha: 'novasenha1', 'conf-senha': 'novasenha1' })
      .expect(200);
  });

  test('troca a senha com o token: senha nova entra, a antiga não, e o token não é reutilizável', async () => {
    await request(app).post('/api/recuperar-senha').send({ email: 'ong@teste.com' });
    const token = tokenDoEmail();

    await request(app)
      .post('/atualizar-senha')
      .send({ token, senha: 'novasenha1', 'conf-senha': 'novasenha1' })
      .expect(200);

    await request(app).post('/login').send({ email: 'ong@teste.com', senha: 'novasenha1' }).expect(200);
    await request(app).post('/login').send({ email: 'ong@teste.com', senha: 'senha123' }).expect(401);

    const reuso = await request(app)
      .post('/atualizar-senha')
      .send({ token, senha: 'outrasenha1', 'conf-senha': 'outrasenha1' });
    expect(reuso.status).toBe(400);
    expect(reuso.body.erro).toMatch(/inválido ou expirado/i);
  });

  test('token expirado é recusado', async () => {
    await request(app).post('/api/recuperar-senha').send({ email: 'ong@teste.com' });
    const token = tokenDoEmail();
    await pool.query(`UPDATE tokens_recuperacao SET expira_em = NOW() - INTERVAL '1 minute'`);

    const res = await request(app)
      .post('/atualizar-senha')
      .send({ token, senha: 'novasenha1', 'conf-senha': 'novasenha1' });
    expect(res.status).toBe(400);
    await request(app).post('/login').send({ email: 'ong@teste.com', senha: 'senha123' }).expect(200);
  });

  test.each([
    ['ausente', undefined],
    ['formato inválido', 'abc'],
    ['hex correto mas inexistente', 'a'.repeat(64)],
  ])('token %s é recusado', async (_d, token) => {
    const res = await request(app)
      .post('/atualizar-senha')
      .send({ token, senha: 'novasenha1', 'conf-senha': 'novasenha1' });
    expect(res.status).toBe(400);
  });

  test('senha nova inválida ou diferente é recusada SEM gastar o token', async () => {
    await request(app).post('/api/recuperar-senha').send({ email: 'ong@teste.com' });
    const token = tokenDoEmail();

    const curta = await request(app).post('/atualizar-senha').send({ token, senha: '123', 'conf-senha': '123' });
    const diferente = await request(app)
      .post('/atualizar-senha')
      .send({ token, senha: 'novasenha1', 'conf-senha': 'outra' });
    expect(curta.status).toBe(400);
    expect(diferente.status).toBe(400);

    await request(app)
      .post('/atualizar-senha')
      .send({ token, senha: 'novasenha1', 'conf-senha': 'novasenha1' })
      .expect(200);
  });

  test('formulário HTML: sucesso -> /index.html?senha=alterada; erro mantém o token na URL', async () => {
    await request(app).post('/api/recuperar-senha').send({ email: 'ong@teste.com' });
    const token = tokenDoEmail();

    const erro = await request(app)
      .post('/atualizar-senha')
      .type('form')
      .set('Accept', 'text/html')
      .send({ token, senha: 'novasenha1', 'conf-senha': 'diferente1' });
    expect(erro.status).toBe(303);
    expect(erro.headers.location).toContain(`/criar-nova-senha.html?token=${token}`);
    expect(erro.headers.location).toContain('erro=');

    const ok = await request(app)
      .post('/atualizar-senha')
      .type('form')
      .set('Accept', 'text/html')
      .send({ token, senha: 'novasenha1', 'conf-senha': 'novasenha1' });
    expect(ok.status).toBe(303);
    expect(ok.headers.location).toBe('/index.html?senha=alterada');
  });
});

// =====================================================================
describe('Páginas protegidas', () => {
  test.each(['/cadastro-pet.html', '/meus-pets.html', '/perfil.html'])(
    '%s sem login redireciona ao início',
    async (pagina) => {
      const res = await request(app).get(pagina);
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/^\/index\.html/);
    }
  );

  test('arquivos fora da lista de páginas não são servidos', async () => {
    expect((await request(app).get('/package.html')).status).toBe(404);
    expect((await request(app).get('/back-end/package.json')).status).toBe(404);
    expect((await request(app).get('/.env')).status).toBe(404);
  });

  test('rota de API inexistente responde 404 em JSON', async () => {
    const res = await request(app).get('/api/nada');
    expect(res.status).toBe(404);
    expect(res.body.erro).toBeDefined();
  });
});

// entrar() é usado pelos testes de adoção; aqui só garantimos que funciona
test('helper entrar() cadastra e autentica', async () => {
  const agent = await entrar(request, app);
  expect((await agent.get('/api/me')).status).toBe(200);
});

// requisições sem corpo (robôs, curl) devem receber erro de validação, nunca 500
describe('Requisições sem corpo', () => {
  test.each([
    ['/login', 401],
    ['/cadastrar', 400],
    ['/atualizar-senha', 400],
  ])('POST %s sem corpo -> %i', async (rota, esperado) => {
    const res = await request(app).post(rota);
    expect(res.status).toBe(esperado);
  });

  test('POST /api/recuperar-senha sem corpo responde 200 genérico', async () => {
    const res = await request(app).post('/api/recuperar-senha');
    expect(res.status).toBe(200);
    expect(email.enviarEmailRecuperacao).not.toHaveBeenCalled();
  });
});
