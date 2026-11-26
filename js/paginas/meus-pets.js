/** Meus Pets: lista e exclui os anúncios do usuário logado (GET /api/animais/meus, DELETE /api/animais/:id). */
import { api } from '../api.js';
import { iniciarPagina } from '../geral.js';
import { el, criarFoto, criarIconeSexo, criarTagStatus, nomeDoPet } from '../componentes.js';

iniciarPagina();

const lista = document.getElementById('lista-meus-pets');
const estado = document.getElementById('estado-lista');

function mostrarEstado(texto) {
  estado.replaceChildren(texto);
}

/** Lista vazia: convida a cadastrar o primeiro pet. */
function mostrarListaVazia() {
  const link = el('a', '', 'Cadastrar agora');
  link.href = 'cadastro-pet.html';
  estado.replaceChildren('Você ainda não cadastrou nenhum pet. ', link);
}

function criarCard(animal) {
  const card = el('article', 'card-meu-pet');
  card.dataset.id = animal.id;

  const foto = el('div', 'meu-pet-foto');
  foto.append(criarFoto(animal, ''));

  const topo = el('div', 'meu-pet-topo');
  topo.append(el('span', 'meu-pet-nome', nomeDoPet(animal)), criarIconeSexo(animal));

  const editar = el('a', 'btn-acao-pet btn-editar', 'Editar');
  editar.href = '#';
  editar.addEventListener('click', (evento) => {
    evento.preventDefault();
    alert('Essa funcionalidade está em construção!');
  });

  const excluir = el('button', 'btn-acao-pet btn-deletar-pet', 'Excluir');
  excluir.type = 'button';
  excluir.addEventListener('click', () => excluirAnuncio(animal, card, excluir));

  const acoes = el('div', 'meu-pet-acoes');
  acoes.append(editar, excluir);

  const info = el('div', 'meu-pet-info');
  info.append(topo, criarTagStatus(animal.categoria), acoes);

  card.append(foto, info);
  return card;
}

async function excluirAnuncio(animal, card, botao) {
  const confirmou = confirm(`Tem certeza que deseja remover o anúncio do pet "${nomeDoPet(animal)}" permanentemente?`);
  if (!confirmou) return;

  botao.disabled = true;
  try {
    await api(`/api/animais/${animal.id}`, { metodo: 'DELETE' });
  } catch (erro) {
    botao.disabled = false;
    alert(erro.message);
    return;
  }

  // só some da tela depois que o servidor confirmou a exclusão
  card.classList.add('removendo');
  setTimeout(() => {
    card.remove();
    if (!lista.children.length) mostrarListaVazia();
  }, 300);
}

async function carregar() {
  mostrarEstado('Estamos conectando com nossos servidores, aguarde um momento...');
  try {
    const { itens } = await api('/api/animais/meus');
    lista.replaceChildren(...itens.map(criarCard));
    if (itens.length) mostrarEstado('');
    else mostrarListaVazia();
  } catch (erro) {
    mostrarEstado(erro.message);
  }
}

carregar();
