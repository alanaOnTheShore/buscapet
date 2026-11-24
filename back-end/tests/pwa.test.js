/**
 * PWA: manifesto, service worker, página offline e ícones precisam ser servidos
 * com o tipo certo e sem exigir login (o navegador os busca antes de qualquer sessão).
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const config = require('../src/config');
const { pool } = require('./helpers');

afterAll(async () => {
  await pool.end();
});

describe('PWA', () => {
  test('manifesto: JSON válido, com nome, início, modo standalone e ícones 192 e 512', async () => {
    const res = await request(app).get('/manifest.webmanifest');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/manifest\+json/);
    const manifesto = JSON.parse(res.text);
    expect(manifesto).toMatchObject({ name: 'BuscaPet', start_url: '/home.html', scope: '/', display: 'standalone' });
    const tamanhos = manifesto.icons.map((icone) => icone.sizes);
    expect(tamanhos).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifesto.icons.some((icone) => icone.purpose === 'maskable')).toBe(true);
  });

  test('todos os ícones do manifesto existem e são servidos', async () => {
    const { icons } = JSON.parse((await request(app).get('/manifest.webmanifest')).text);

    for (const icone of icons) {
      const res = await request(app).get(icone.src);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
    }
  });

  test('service worker: na raiz, JavaScript e sem cache (para atualizações chegarem)', async () => {
    const res = await request(app).get('/sw.js');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toMatch(/no-cache/);
  });

  test('o service worker só pré-carrega arquivos que existem (senão a instalação falha)', async () => {
    const codigo = fs.readFileSync(path.join(config.raizFront, 'sw.js'), 'utf8');
    const lista = codigo.match(/const PRE_CACHE = \[([^\]]+)\]/)[1];
    const caminhos = [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((c) => c !== '/offline.html');

    for (const caminho of caminhos) {
      expect((await request(app).get(caminho)).status).toBe(200);
    }
  });

  test('página offline é pública (200, sem redirecionar para o login)', async () => {
    const res = await request(app).get('/offline.html');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Sem conexão');
  });

  test('o service worker não intercepta a API nem guarda HTML', () => {
    const codigo = fs.readFileSync(path.join(config.raizFront, 'sw.js'), 'utf8');

    expect(codigo).not.toMatch(/startsWith\('\/api/); // /api nunca entra nas regras de cache
    expect(codigo).toMatch(/requisicao\.method !== 'GET'/);
  });
});
