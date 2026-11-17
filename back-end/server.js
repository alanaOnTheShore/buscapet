const app = require('./src/app');

const PORTA = 3000;

// Liga o servidor e deixa ele "escutando" as requisições do front-end
app.listen(PORTA, () => {
  console.log(`Servidor do BuscaPet rodando na porta ${PORTA} 🚀`);
});