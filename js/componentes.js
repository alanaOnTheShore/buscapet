/**
 * Pedaços de tela reutilizados pela home e por "Meus Pets".
 * Todo texto vindo da API entra por textContent / propriedades do DOM, NUNCA por innerHTML:
 * assim um nome como "<script>..." aparece como texto e não executa (evita XSS).
 */
import { infoCategoria } from './categorias.js';

/** Cria um elemento, com classe e texto opcionais. */
export function el(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

/** Animal encontrado pode não ter nome registrado. */
export const nomeDoPet = (animal) => animal.nome ?? 'Sem nome';

export function criarTagStatus(categoria, tag = 'span') {
  const { rotulo, classe } = infoCategoria(categoria);
  return el(tag, `tag-status ${classe}`.trim(), rotulo);
}

/**
 * O ícone e o rótulo do sexo já vêm prontos da API (traduzidos a partir do banco).
 * Pet encontrado pode não ter sexo informado: nesse caso não há ícone (devolve um fragmento vazio).
 */
export function criarIconeSexo(animal) {
  if (!animal.sexoIcone) return document.createDocumentFragment();
  const icone = el('img', 'genero-pet-icon');
  icone.src = animal.sexoIcone;
  icone.alt = animal.sexoRotulo;
  return icone;
}

export function criarFoto(animal, classe) {
  const foto = el('img', classe);
  foto.loading = 'lazy';
  foto.src = animal.foto ?? '';
  foto.alt = nomeDoPet(animal);
  return foto;
}
