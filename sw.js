/**
 * Service worker do BuscaPet.
 *
 * O que ele faz:
 *  - páginas (navegação): sempre da internet; sem conexão (ou servidor fora do ar), mostra /offline.html;
 *  - /css e /js: internet primeiro, cache como reserva (o app abre mesmo sem rede e nunca fica com código velho);
 *  - /img e /uploads: cache primeiro (as imagens não mudam de nome).
 *
 * O que ele NUNCA faz:
 *  - não guarda HTML (as páginas de perfil e Meus Pets dependem de login);
 *  - não toca em /api, login, cadastro nem em nenhum POST/PATCH/DELETE: dados privados nunca ficam em cache,
 *    então ninguém vê dados de outra conta no mesmo aparelho;
 *  - não interfere em requisições de outro domínio (as fotos do Supabase seguem o cache normal do navegador).
 *
 * Ao publicar uma mudança que precise invalidar o cache, aumente VERSAO.
 */
const VERSAO = 'v1';
const CACHE_CODIGO = `buscapet-codigo-${VERSAO}`;
const CACHE_IMAGENS = `buscapet-imagens-${VERSAO}`;
const PAGINA_OFFLINE = '/offline.html';
const PRE_CACHE = [PAGINA_OFFLINE, '/img/logo.png', '/img/pwa/icon-192.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_CODIGO)
      .then((cache) => cache.addAll(PRE_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes.filter((nome) => nome !== CACHE_CODIGO && nome !== CACHE_IMAGENS).map((nome) => caches.delete(nome))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Só guarda respostas boas do próprio site (nada de erro, redirecionamento ou outro domínio). */
async function guardar(nomeCache, requisicao, resposta) {
  if (resposta.ok && resposta.type === 'basic') {
    const cache = await caches.open(nomeCache);
    await cache.put(requisicao, resposta.clone());
  }
  return resposta;
}

async function redePrimeiro(requisicao, nomeCache) {
  try {
    return await guardar(nomeCache, requisicao, await fetch(requisicao));
  } catch (erro) {
    const guardada = await caches.match(requisicao);
    if (guardada) return guardada;
    throw erro;
  }
}

async function cachePrimeiro(requisicao, nomeCache) {
  const guardada = await caches.match(requisicao);
  if (guardada) return guardada;
  return guardar(nomeCache, requisicao, await fetch(requisicao));
}

async function navegar(requisicao) {
  try {
    const resposta = await fetch(requisicao);
    // 502/503/504: o servidor está acordando ou fora do ar (comum em hospedagem gratuita)
    if (resposta.status >= 502 && resposta.status <= 504) return await caches.match(PAGINA_OFFLINE);
    return resposta;
  } catch {
    return caches.match(PAGINA_OFFLINE);
  }
}

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;

  if (requisicao.mode === 'navigate') {
    evento.respondWith(navegar(requisicao));
    return;
  }

  if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
    evento.respondWith(redePrimeiro(requisicao, CACHE_CODIGO));
  } else if (url.pathname.startsWith('/img/') || url.pathname.startsWith('/uploads/')) {
    evento.respondWith(cachePrimeiro(requisicao, CACHE_IMAGENS));
  }
  // qualquer outra coisa (principalmente /api): o navegador resolve sozinho, sem cache
});
