/**
 * Home: grade de anúncios com filtro por categoria, rolagem infinita e modal de detalhes.
 * Dados da API: GET /api/animais (paginado por cursor) e GET /api/animais/:id.
 */
import { api } from '../api.js';
import { iniciarPagina } from '../geral.js';
import { infoCategoria } from '../categorias.js';
import { el, criarFoto, criarIconeSexo, criarTagStatus, nomeDoPet } from '../componentes.js';

iniciarPagina();

const TAMANHO_PAGINA = 12;

const grade = document.getElementById('grade-animais');
const estado = document.getElementById('estado-lista');
const sentinela = document.getElementById('sentinela');
const botoesFiltro = document.querySelectorAll('.btn-filtro');

// --- estado da listagem ---------------------------------------------------
let categoria = 'TODOS';
let cursor = null; // null = primeira página
let temMais = true;
let carregando = false;
let versao = 0; // muda a cada filtro: respostas atrasadas da lista antiga são descartadas

function mostrarEstado(...conteudo) {
  estado.replaceChildren(...conteudo);
}

function atualizarEstado() {
  if (!grade.children.length && !temMais) mostrarEstado('Nenhum pet por aqui ainda.');
  else mostrarEstado('');
}

function mostrarFalha(mensagem) {
  const tentar = el('button', 'btn-filtro', 'Tentar novamente');
  tentar.type = 'button';
  tentar.addEventListener('click', carregarMais);
  mostrarEstado(`${mensagem} `, tentar);
}

async function carregarMais() {
  if (carregando || !temMais) return;
  carregando = true;
  const minhaVersao = versao;
  if (!grade.children.length) mostrarEstado('Carregando...');

  let falhou = false;
  try {
    const parametros = new URLSearchParams({ categoria, limite: TAMANHO_PAGINA });
    if (cursor) parametros.set('cursor', cursor);
    const { itens, proximoCursor } = await api(`/api/animais?${parametros}`);
    if (minhaVersao !== versao) return; // o filtro mudou enquanto esperava

    grade.append(...itens.map(criarCard));
    cursor = proximoCursor;
    temMais = proximoCursor !== null;
  } catch (erro) {
    if (minhaVersao !== versao) return;
    falhou = true;
    mostrarFalha(erro.message);
  } finally {
    if (minhaVersao === versao) {
      carregando = false;
      if (!falhou) {
        atualizarEstado();
        reobservar();
      }
    }
  }
}

function reiniciar() {
  versao += 1;
  cursor = null;
  temMais = true;
  carregando = false;
  grade.replaceChildren();
  carregarMais();
}

// Rolagem infinita: quando o fim da grade aparece, busca a próxima página.
const observador = new IntersectionObserver(
  (entradas) => {
    if (entradas[0].isIntersecting) carregarMais();
  },
  { rootMargin: '300px' }
);
observador.observe(sentinela);

// Se a página nova não preencheu a tela, o fim continua visível e o observador não avisa de novo:
// observar outra vez força uma nova checagem.
function reobservar() {
  if (!temMais) return;
  observador.unobserve(sentinela);
  observador.observe(sentinela);
}

// --- filtros -----------------------------------------------------------------
botoesFiltro.forEach((botao) => {
  botao.addEventListener('click', () => {
    if (botao.classList.contains('ativo')) return;
    document.querySelector('.btn-filtro.ativo')?.classList.remove('ativo');
    botao.classList.add('ativo');
    categoria = botao.dataset.categoria;
    reiniciar();
  });
});

// --- cards -------------------------------------------------------------------
function criarCard(animal) {
  const card = el('article', 'card-pet');
  card.tabIndex = 0;

  const fotoContainer = el('div', 'foto-pet-container');
  fotoContainer.append(criarFoto(animal, 'foto-pet'));

  const topo = el('div', 'linha-topo');
  topo.append(el('span', 'nome-pet', nomeDoPet(animal)), criarIconeSexo(animal));

  const info = el('div', 'info-pet');
  info.append(topo, criarTagStatus(animal.categoria, 'p'));

  card.append(fotoContainer, info);
  card.addEventListener('click', () => abrirDetalhes(animal.id));
  card.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') abrirDetalhes(animal.id);
  });
  return card;
}

// --- modal de detalhes ---------------------------------------------------------
const modal = document.getElementById('modal-pet');
const campos = {
  foto: document.getElementById('modal-pet-foto'),
  nome: document.getElementById('modal-pet-nome'),
  genero: document.getElementById('modal-pet-genero'),
  status: document.getElementById('modal-pet-status'),
  descricao: document.getElementById('modal-pet-descricao'),
  boxFuga: document.getElementById('modal-box-fuga'),
  fuga: document.getElementById('modal-pet-fuga'),
  whatsapp: document.getElementById('modal-pet-whatsapp'),
};

/** O telefone só vem no detalhe (nunca na listagem), já com DDI 55. */
function linkWhatsapp(animal) {
  const mensagem = `Olá! Vi o anúncio do pet ${nomeDoPet(animal)} no BuscaPet e gostaria de obter mais informações.`;
  return `https://wa.me/${animal.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

function preencherModal(animal) {
  campos.foto.src = animal.foto ?? '';
  campos.foto.alt = nomeDoPet(animal);
  campos.nome.textContent = nomeDoPet(animal);
  campos.genero.src = animal.sexoIcone;
  campos.genero.alt = animal.sexoRotulo;

  const { rotulo, classe } = infoCategoria(animal.categoria);
  campos.status.textContent = rotulo;
  campos.status.className = `tag-status ${classe}`;

  campos.descricao.textContent = animal.descricao;

  const mostrarFuga = animal.categoria === 'PERDIDO' && Boolean(animal.detalhesFuga);
  campos.fuga.textContent = mostrarFuga ? animal.detalhesFuga : '';
  campos.boxFuga.style.display = mostrarFuga ? 'block' : 'none';

  campos.whatsapp.href = linkWhatsapp(animal);
}

async function abrirDetalhes(id) {
  try {
    const { animal } = await api(`/api/animais/${id}`);
    preencherModal(animal);
    modal.classList.add('mostrar');
  } catch (erro) {
    alert(erro.message);
  }
}

const fecharModal = () => modal.classList.remove('mostrar');
document.getElementById('btn-fechar-pet').addEventListener('click', fecharModal);
modal.addEventListener('click', (evento) => {
  if (evento.target === modal) fecharModal(); // clique na área escura
});
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') fecharModal();
});

carregarMais();
