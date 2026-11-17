const express = require('express');
const app = express();

const petsPerdidosRoutes = require('./routers/PetsPerdidosRoutes');
const animaisEncontradosRoutes = require('./routers/AnimaisEncontradosRoutes');

app.use(express.json());
app.use('/api/animais/perdidos', petsPerdidosRoutes);
app.use('/api/animais/encontrados', animaisEncontradosRoutes);

module.exports = app;