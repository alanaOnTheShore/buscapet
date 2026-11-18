/**
 * Os formulários atuais do front fazem POST nativo (a página recarrega) e o
 * fetch faz JSON. Estas funções atendem aos dois:
 *   - formulário HTML (o navegador envia "Accept: text/html") -> redirecionamento 303,
 *     com ?erro=... em caso de falha;
 *   - qualquer outro cliente (fetch, Postman, testes) -> resposta JSON.
 */
function querJson(req) {
  if (req.is('application/json')) return true;
  return !/text\/html/.test(req.headers.accept || '');
}

function comParametros(destino, params = {}) {
  const url = new URL(destino, 'http://local');
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(chave, String(valor));
    }
  }
  return url.pathname + url.search;
}

function sucesso(req, res, { status = 200, json = {}, redirect } = {}) {
  if (!redirect || querJson(req)) return res.status(status).json(json);
  return res.redirect(303, redirect);
}

function falha(req, res, status, mensagem, { redirect, campos } = {}) {
  if (!redirect || querJson(req)) {
    return res.status(status).json({ erro: mensagem, ...(campos ? { campos } : {}) });
  }
  return res.redirect(303, comParametros(redirect, { erro: mensagem }));
}

module.exports = { querJson, comParametros, sucesso, falha };
