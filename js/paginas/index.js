/** Tela inicial: abre e fecha o modal de login e valida o formulário antes do envio. */
import { iniciarPagina } from '../geral.js';

const avisos = iniciarPagina();

const modal = document.getElementById('modal-login');
const abrirModal = () => modal.classList.add('mostrar');
const fecharModal = () => modal.classList.remove('mostrar');

document.getElementById('btn-login').addEventListener('click', abrirModal);
document.getElementById('btn-fechar-login').addEventListener('click', fecharModal);

// Voltou para cá por login errado, sessão ausente, conta criada ou senha trocada: falta entrar.
if (avisos.erro || avisos.cadastro === 'ok' || avisos.senha === 'alterada') abrirModal();

document.getElementById('form-login').addEventListener('submit', (evento) => {
  const campoEmail = document.getElementById('email');
  campoEmail.value = campoEmail.value.trim(); // espaços acidentais

  if (document.getElementById('senha').value.length < 6) {
    evento.preventDefault();
    alert('A senha deve ter pelo menos 6 caracteres.');
  }
});
