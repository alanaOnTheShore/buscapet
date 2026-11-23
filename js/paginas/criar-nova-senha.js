/** Nova senha: pega o token do link do e-mail e confere as senhas antes do envio. */
import { iniciarPagina } from '../geral.js';

iniciarPagina();

const token = new URLSearchParams(window.location.search).get('token');

if (token) {
  document.getElementById('token-seguranca').value = token;
} else {
  alert('Token de segurança ausente ou inválido. Solicite uma nova redefinição.');
  window.location.href = 'redefinir-senha.html';
}

document.getElementById('form-nova-senha').addEventListener('submit', (evento) => {
  const senha = document.getElementById('nova-senha').value;
  const confirmacao = document.getElementById('conf-nova-senha').value;

  if (senha !== confirmacao) {
    evento.preventDefault();
    alert('As senhas não coincidem! Verifique e tente novamente.');
  }
});
