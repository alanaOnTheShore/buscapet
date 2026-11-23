/**
 * O que toda página faz ao abrir: efeito de toque no iOS e avisos vindos da URL.
 *
 * O servidor redireciona formulários HTML de volta com parâmetros, por exemplo
 * /cadastro-pet.html?erro=Informe+o+nome  ou  /index.html?cadastro=ok
 */
const AVISOS = {
  erro: (valor) => valor,
  cadastro: (valor) => (valor === 'ok' ? 'Conta criada! Faça login.' : null),
  senha: (valor) => (valor === 'alterada' ? 'Senha alterada! Faça login.' : null),
  cadastrado: (valor) => (valor === '1' ? 'Pet cadastrado com sucesso!' : null),
};

/**
 * Mostra os avisos da URL uma única vez e limpa esses parâmetros (atualizar a página não repete).
 * Parâmetros que a página usa (token, tipo) são mantidos.
 * @returns {Record<string, string>} os avisos que existiam, para a página reagir se precisar.
 */
export function mostrarAvisosDaUrl() {
  const parametros = new URLSearchParams(window.location.search);
  const encontrados = {};
  const mensagens = [];

  for (const [chave, paraTexto] of Object.entries(AVISOS)) {
    if (!parametros.has(chave)) continue;
    encontrados[chave] = parametros.get(chave);
    const mensagem = paraTexto(encontrados[chave]);
    if (mensagem) mensagens.push(mensagem);
    parametros.delete(chave);
  }

  if (Object.keys(encontrados).length) {
    const resto = parametros.toString();
    window.history.replaceState(null, '', window.location.pathname + (resto ? `?${resto}` : ''));
  }
  if (mensagens.length) alert(mensagens.join('\n'));
  return encontrados;
}

/** Chame uma vez no início do script de cada página. */
export function iniciarPagina() {
  // efeito de :active nos botões do iOS
  document.addEventListener('touchstart', () => {}, true);
  return mostrarAvisosDaUrl();
}
