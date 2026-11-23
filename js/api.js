/**
 * Cliente da API: o ÚNICO arquivo do front que chama fetch.
 *  - sempre pede JSON (o servidor só responde com redirecionamento a formulários HTML);
 *  - 401 (sessão expirada ou ausente) leva de volta ao login;
 *  - qualquer falha vira ErroApi com uma mensagem pronta para mostrar ao usuário.
 */
export class ErroApi extends Error {
  constructor(mensagem, status = 0, campos) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.campos = campos;
  }
}

/**
 * @param {string} url
 * @param {{ metodo?: string, corpo?: object }} [opcoes] `corpo` é enviado como JSON.
 * @returns {Promise<object>} o JSON da resposta
 */
export async function api(url, { metodo = 'GET', corpo } = {}) {
  const opcoes = {
    method: metodo,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch {
    throw new ErroApi('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.');
  }

  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401) {
    const mensagem = dados.erro || 'Faça login para continuar.';
    window.location.href = `/index.html?erro=${encodeURIComponent(mensagem)}`;
    throw new ErroApi(mensagem, 401);
  }
  if (!resposta.ok) {
    throw new ErroApi(dados.erro || 'Erro inesperado. Tente novamente.', resposta.status, dados.campos);
  }
  return dados;
}
