/** Cadastro de usuário: modal dos Termos de Uso e conferência das senhas antes do envio. */
import { iniciarPagina } from '../geral.js';
import { validarCampo, erroDeNomeUsuario, erroDeTelefone } from '../validacoes.js';

iniciarPagina();

//exibe e fecha modal de termos de uso
const modalTermos = document.getElementById('modal-termos');

document.getElementById('abrir-termos').addEventListener('click', (evento) => {
  evento.preventDefault();
  modalTermos.classList.add('mostrar');
});
document.getElementById('btn-fechar-termos').addEventListener('click', () => {
  modalTermos.classList.remove('mostrar');
});

// nome (a regra muda com o tipo: pessoa física só letras; ONG sem @ # ! * ?) e telefone (DDD válido)
const selectTipo = document.getElementById('tipo-cadastro');
const conferirNome = validarCampo(document.getElementById('nome-cadastro'), () =>
  erroDeNomeUsuario(document.getElementById('nome-cadastro').value, selectTipo.value)
);
selectTipo.addEventListener('change', conferirNome);
validarCampo(document.getElementById('telefone-cadastro'), () =>
  erroDeTelefone(document.getElementById('telefone-cadastro').value)
);

//compara a senha com a confirmação de senha 
document.getElementById('form-cadastro').addEventListener('submit', (evento) => {
  const senha = document.getElementById('senha-cadastro').value;
  const confirmacao = document.getElementById('conf-senha-cadastro').value;

  if (senha !== confirmacao) {
    evento.preventDefault();
    alert('As senhas não coincidem! Por favor, verifique.');
  }
});
