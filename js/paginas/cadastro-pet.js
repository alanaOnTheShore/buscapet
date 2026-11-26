/**
 * Cadastro de pet: ajusta os campos conforme a situação, espelhando as regras do banco
 * (ck_animais_nome e ck_animais_detalhes_fuga). O envio é o do próprio formulário (multipart).
 */
import { iniciarPagina } from '../geral.js';
import { validarCampo, erroDeNomePet, erroDeDescricao, erroDeTextoLivre, DESCRICAO_MIN } from '../validacoes.js';

iniciarPagina();

const selectSituacao = document.getElementById('situacao-pet');
const boxFuga = document.getElementById('box-detalhes-fuga');
const inputFuga = document.getElementById('fuga-pet');
const inputNome = document.getElementById('nome-pet');
const labelNome = document.getElementById('label-nome-pet');
const selectSexo = document.getElementById('sexo-pet');
const labelSexo = document.getElementById('label-sexo-pet');
const opcaoSexoVazia = document.getElementById('opcao-sexo-vazia');
const contadorNome = document.getElementById('contador-nome');

// Contador do nome: o limite é o maxlength do próprio campo (30), que o servidor também confere.
function atualizarContadorNome() {
  contadorNome.textContent = `${inputNome.value.length}/${inputNome.maxLength}`;
}
inputNome.addEventListener('input', atualizarContadorNome);
atualizarContadorNome();

// Descrição: mínimo de 30 caracteres. O contador mostra quanto falta.
const inputDescricao = document.getElementById('descricao-pet');
const contadorDescricao = document.getElementById('contador-descricao');
function atualizarContadorDescricao() {
  const tamanho = inputDescricao.value.trim().length;
  contadorDescricao.textContent =
    tamanho < DESCRICAO_MIN ? `${tamanho}/${DESCRICAO_MIN} (mínimo de ${DESCRICAO_MIN} caracteres)` : `${tamanho} caracteres`;
}
inputDescricao.addEventListener('input', atualizarContadorDescricao);
atualizarContadorDescricao();

// Sem caracteres especiais (acentos valem). Com erro, o navegador bloqueia o envio e mostra a mensagem.
validarCampo(inputNome, () => erroDeNomePet(inputNome.value));
validarCampo(inputDescricao, () => erroDeDescricao(inputDescricao.value));
validarCampo(inputFuga, () => erroDeTextoLivre(inputFuga.value));

// Aviso antes de escolher a foto: o card aparece, e só depois do "Ok" abre a escolha de arquivo.
const inputFoto = document.getElementById('foto-pet');
const avisoFoto = document.getElementById('aviso-foto');
let liberarEscolhaDeFoto = false;

inputFoto.addEventListener('click', (evento) => {
  if (liberarEscolhaDeFoto) return; // clique vindo do botão "Ok": segue o fluxo normal
  evento.preventDefault();
  avisoFoto.classList.add('mostrar');
  document.getElementById('aviso-foto-ok').focus();
});
document.getElementById('aviso-foto-ok').addEventListener('click', () => {
  avisoFoto.classList.remove('mostrar');
  liberarEscolhaDeFoto = true;
  inputFoto.click();
  liberarEscolhaDeFoto = false;
});

// Mostra o nome do arquivo escolhido (antes o texto continuava "Escolher imagem" mesmo com foto selecionada)
const textoUpload = document.querySelector('.upload-placeholder');
inputFoto.addEventListener('change', () => {
  textoUpload.textContent = inputFoto.files.length ? `📸 ${inputFoto.files[0].name}` : '📸 Escolher imagem do pet';
});

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

  // Sexo: Encontrado pode não saber. Nesse caso o campo é opcional e dá para voltar a "Não informado".
  labelSexo.textContent = encontrado ? 'Sexo (Opcional)' : 'Sexo *';
  selectSexo.required = !encontrado;
  opcaoSexoVazia.textContent = encontrado ? 'Não informado' : 'Selecione o sexo...';
  opcaoSexoVazia.disabled = !encontrado;
  opcaoSexoVazia.hidden = !encontrado;
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
