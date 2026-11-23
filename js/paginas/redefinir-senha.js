/** Esqueci a senha: envia o e-mail por fetch e mostra sempre a mesma confirmação. */
import { api } from '../api.js';
import { iniciarPagina } from '../geral.js';

iniciarPagina();

const form = document.getElementById('form-redefinir');
const mensagemSucesso = document.getElementById('mensagem-sucesso');

form.addEventListener('submit', async (evento) => {
  evento.preventDefault(); // não recarrega a página

  try {
    await api('/api/recuperar-senha', {
      metodo: 'POST',
      corpo: { email: document.getElementById('email-redefinicao').value.trim() },
    });
  } catch (erro) {
    alert(erro.message); // falha de conexão ou limite de pedidos
    return;
  }

  // A resposta é igual exista o e-mail ou não: assim ninguém descobre quem tem conta.
  form.style.display = 'none';
  mensagemSucesso.style.display = 'block';
});
