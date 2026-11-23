/**
 * Cadastro de pet: ajusta os campos conforme a situação, espelhando as regras do banco
 * (ck_animais_nome e ck_animais_detalhes_fuga). O envio é o do próprio formulário (multipart).
 */
import { iniciarPagina } from '../geral.js';

iniciarPagina();

const selectSituacao = document.getElementById('situacao-pet');
const boxFuga = document.getElementById('box-detalhes-fuga');
const inputFuga = document.getElementById('fuga-pet');
const inputNome = document.getElementById('nome-pet');
const labelNome = document.getElementById('label-nome-pet');

function atualizarFormularioPorSituacao(situacao) {
  const perdido = situacao === 'PERDIDO';
  const encontrado = situacao === 'ENCONTRADO';

  // Detalhes da fuga: obrigatórios só para Perdido; nas outras situações o banco exige que fiquem vazios
  boxFuga.style.display = perdido ? 'block' : 'none';
  inputFuga.required = perdido;
  if (!perdido) inputFuga.value = '';

  // Nome: Encontrado pode não ter nome registrado
  labelNome.textContent = encontrado ? 'Nome do pet (Opcional)' : 'Nome do pet *';
  inputNome.required = !encontrado;
}

selectSituacao.addEventListener('change', (evento) => {
  atualizarFormularioPorSituacao(evento.target.value);
});

// Vindo do carrossel da home (?tipo=PERDIDO, ?tipo=ADOCAO ou ?tipo=ENCONTRADO) a situação já vem escolhida.
// Pela barra inferior, o formulário começa em "Selecione a situação...".
const tipo = new URLSearchParams(window.location.search).get('tipo');
if (tipo) {
  selectSituacao.value = tipo;
  if (selectSituacao.value === tipo) atualizarFormularioPorSituacao(tipo); // ignora valor que não existe na lista
}
