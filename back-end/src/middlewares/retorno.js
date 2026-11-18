/**
 * Define para onde um formulário HTML volta quando há erro.
 * `destino` pode ser um texto ou uma função (req) => texto.
 */
const definirRetorno = (destino) => (req, res, next) => {
  req.retornoErro = typeof destino === 'function' ? destino(req) : destino;
  next();
};

module.exports = { definirRetorno };
