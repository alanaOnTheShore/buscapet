/** Erro "esperado" (validação, não autorizado...) com status HTTP. */
class ErroHttp extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

module.exports = { ErroHttp };
