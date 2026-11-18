/**
 * Único lugar que traduz o valor salvo no banco (ENUM sexo_animal: 'M' | 'F')
 * para o que o front exibe (rótulo e ícone). Para trocar um ícone, só aqui.
 */
const SEXOS = {
  M: { rotulo: 'Macho', icone: '/img/icon-sexo/masc.png' },
  F: { rotulo: 'Fêmea', icone: '/img/icon-sexo/fem.png' },
};

/** Normaliza a entrada ('m', ' F ') e devolve 'M' | 'F' ou null. */
function normalizarSexo(valor) {
  const sexo = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  return SEXOS[sexo] ? sexo : null;
}

/** Campos de gênero que a API devolve junto de cada animal. */
function descreverSexo(sexo) {
  const dados = SEXOS[sexo];
  return { sexo, sexoRotulo: dados.rotulo, sexoIcone: dados.icone };
}

module.exports = { normalizarSexo, descreverSexo };
