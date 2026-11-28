/**
 * Cadastro duplicado: o mesmo usuário não pode ter dois envios sendo processados ao mesmo tempo
 * (clicar várias vezes em "Cadastrar" criava o mesmo pet várias vezes).
 */
const { EventEmitter } = require('events');
const { bloquearEnvioSimultaneo } = require('../src/middlewares/envio');
const { ErroHttp } = require('../src/utils/erros');

const requisicao = (id) => ({ usuario: { id } });
const resposta = () => new EventEmitter();

describe('bloquearEnvioSimultaneo', () => {
  test('o segundo envio do mesmo usuário, enquanto o primeiro não terminou, recebe 409', () => {
    const res1 = resposta();
    const proximo1 = jest.fn();
    bloquearEnvioSimultaneo(requisicao(1), res1, proximo1);
    expect(proximo1).toHaveBeenCalledWith(); // o primeiro passa

    const proximo2 = jest.fn();
    bloquearEnvioSimultaneo(requisicao(1), resposta(), proximo2);
    const erro = proximo2.mock.calls[0][0];
    expect(erro).toBeInstanceOf(ErroHttp);
    expect(erro.status).toBe(409);

    res1.emit('finish'); // libera para o próximo envio de verdade
    const proximo3 = jest.fn();
    bloquearEnvioSimultaneo(requisicao(1), resposta(), proximo3);
    expect(proximo3).toHaveBeenCalledWith();
  });

  test('usuários diferentes não se bloqueiam', () => {
    const proximoA = jest.fn();
    const proximoB = jest.fn();
    bloquearEnvioSimultaneo(requisicao(10), resposta(), proximoA);
    bloquearEnvioSimultaneo(requisicao(11), resposta(), proximoB);
    expect(proximoA).toHaveBeenCalledWith();
    expect(proximoB).toHaveBeenCalledWith();
  });

  test('se a conexão cair no meio ("close"), o bloqueio é liberado', () => {
    const res = resposta();
    bloquearEnvioSimultaneo(requisicao(20), res, jest.fn());
    res.emit('close');
    const proximo = jest.fn();
    bloquearEnvioSimultaneo(requisicao(20), resposta(), proximo);
    expect(proximo).toHaveBeenCalledWith();
  });
});
