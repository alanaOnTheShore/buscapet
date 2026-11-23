/** Perfil: mostra e edita os dados do usuário logado (GET/PATCH/DELETE /api/me) e faz logout. */
import { api } from '../api.js';
import { iniciarPagina } from '../geral.js';

iniciarPagina();

const nomeTopo = document.getElementById('perfil-nome');
const badge = document.getElementById('perfil-badge-tipo');
const form = document.getElementById('form-perfil');
const campoNome = document.getElementById('nome-perfil');
const campoEmail = document.getElementById('email-perfil');
const campoTelefone = document.getElementById('telefone-perfil');
const botaoSalvar = form.querySelector('button[type="submit"]');

function preencher(usuario) {
  nomeTopo.textContent = usuario.nome;
  campoNome.value = usuario.nome;
  campoEmail.value = usuario.email;
  campoTelefone.value = usuario.telefone;

  const ong = usuario.tipo === 'ONG';
  badge.textContent = ong ? 'ONG' : 'PESSOA';
  badge.classList.toggle('badge-ong', ong);
  badge.classList.toggle('badge-pessoa', !ong);
  badge.hidden = false;
}

async function carregar() {
  try {
    const { usuario } = await api('/api/me');
    preencher(usuario);
  } catch (erro) {
    nomeTopo.textContent = erro.message;
  }
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  botaoSalvar.disabled = true;
  try {
    const { usuario } = await api('/api/me', {
      metodo: 'PATCH',
      corpo: { nome: campoNome.value, telefone: campoTelefone.value },
    });
    preencher(usuario); // mostra o que o servidor gravou (já sem espaços sobrando)
    alert('Alterações salvas com sucesso!');
  } catch (erro) {
    alert(erro.message);
  } finally {
    botaoSalvar.disabled = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', async (evento) => {
  evento.preventDefault();
  try {
    await api('/api/logout', { metodo: 'POST' });
  } finally {
    window.location.href = '/index.html';
  }
});

document.getElementById('btn-excluir-conta').addEventListener('click', async (evento) => {
  evento.preventDefault();
  const confirmou = confirm(
    '🚨 ATENÇÃO: Tem certeza que deseja excluir sua conta?\n\nEsta ação é irreversível. Todos os seus dados e pets cadastrados serão apagados permanentemente.'
  );
  if (!confirmou) return;

  try {
    await api('/api/me', { metodo: 'DELETE' });
    alert('Conta excluída com sucesso. Esperamos ver você de volta em breve!');
    window.location.href = '/index.html';
  } catch (erro) {
    alert(erro.message);
  }
});

carregar();
