# BuscaPet – Back-end (Autenticação + Módulo de Adoção)

API em Node.js/Express + PostgreSQL. **O mesmo servidor entrega as páginas HTML e a API**, então
os `action="/login"`, `fetch("/api/...")` e cookies do front funcionam sem CORS.

```
buscapet/                  <- raiz do repositório (html, css/, img/)
└── back-end/
    ├── database/          schema.sql (v2), migracao_001_*.sql, seed_desempenho.sql
    ├── src/
    │   ├── routes/        auth, animais (adoção), perdidos, encontrados
    │   ├── controllers/   auth, animais (genérico), perdidos, encontrados
    │   ├── models/        animal.model.js  (único lugar com SQL de animais)
    │   ├── middlewares/   sessão, limites, upload, erros
    │   └── utils/         validação, regras por categoria, imagem, cursor, e-mail...
    ├── tests/             auth, adocao, perdidos, encontrados, integracao, banco
    └── .env.example
```

**Arquitetura em camadas:** `routes` (URL e middlewares) → `controllers` (HTTP e fluxo) →
`models` (SQL). As regras de cada categoria ficam em `src/utils/regrasAnimal.js` (adoção, perdidos
e encontrados). Os módulos de Perdidos e Encontrados reutilizam o mesmo model da tabela `animais`:
só a categoria e as regras mudam. Stack: Node 18+, Express 5.

## 1. Banco de dados

| Situação | O que rodar (SQL Editor, botão **Run**) |
|---|---|
| Banco novo ou de testes | `database/schema.sql` (apaga e recria tudo) |
| Já criou o banco da v1 e quer **manter os dados** | `database/migracao_001_sexo_tokens_indices.sql` (uma vez) |

O que mudou da v1: coluna `animais.sexo` (`M`/`F`, usada nos ícones de gênero), tabela
`tokens_recuperacao` (esqueci a senha), índices para a paginação e Row Level Security ligado
(sem políticas) para que ninguém leia `usuarios`/tokens pela API pública do Supabase.

## 2. Rodar localmente

```bash
cd back-end
cp .env.example .env        # preencha DATABASE_URL, JWT_SECRET e TEST_DATABASE_URL
npm install
npm test                    # 150 testes (precisa do banco de TESTES)
npm start                   # http://localhost:3000
```

Sem `SMTP_HOST` configurado, o link de recuperação de senha aparece **no console** do servidor.
Adicione `back-end/uploads/` ao `.gitignore` da raiz.

## 3. Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL (Neon/Supabase) |
| `JWT_SECRET` | Assina a sessão (≥ 32 caracteres; obrigatório em produção) |
| `APP_URL` | Endereço público do site (vai no link do e-mail) |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` | Envio do e-mail de recuperação |
| `UPLOAD_DIR` | Pasta das fotos (padrão `back-end/uploads`) |
| `TEST_DATABASE_URL` | Banco **separado** usado só pelos testes (eles apagam tudo) |

## 4. Contrato da API

Cliente JSON (fetch, Postman) recebe JSON. Formulário HTML nativo (o navegador envia
`Accept: text/html`) recebe **redirecionamento** e, em caso de erro, volta à página com `?erro=mensagem`.

### Autenticação

| Rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `POST /cadastrar` | `nome, email, telefone, tipo (PESSOA/ONG), senha, conf-senha` | 201 `{usuario}` · form → `/index.html?cadastro=ok` | 400 (`campos`), 409 e-mail repetido |
| `POST /login` | `email, senha` | 200 `{usuario}` + cookie HttpOnly · form → `/home.html` | 401 genérico |
| `POST /api/logout` | – | 200 · form → `/index.html` | – |
| `GET /api/me` | – | 200 `{usuario}` | 401 |
| `POST /api/recuperar-senha` | `{email}` | 200 **sempre igual** (não revela se o e-mail existe) | – |
| `POST /atualizar-senha` | `token, senha, conf-senha` | 200 · form → `/index.html?senha=alterada` | 400 link inválido/expirado/usado |

### Animais (Adoção, Perdidos e Encontrados)

| Rota | Descrição |
|---|---|
| `POST /api/animais` | **Login obrigatório.** `multipart/form-data`: `categoria, nome, sexo (M/F), descricao, detalhes_fuga, foto`. Foto: JPG/PNG/WEBP/GIF até 10 MB. |
| `GET /api/animais?categoria=ADOCAO&limite=12&cursor=…` | Pública. `categoria`: `ADOCAO`, `PERDIDO`, `ENCONTRADO` ou `TODOS` (padrão). Limite padrão 12, máximo 30. |
| `GET /api/animais/:id` | Pública. Dados completos + `whatsapp` (já com DDI 55) para o modal. |
| `POST/GET /api/animais/perdidos` | Atalho que fixa a categoria `PERDIDO` (`detalhes_fuga` obrigatório). Mesmo formato do `POST/GET /api/animais`. |
| `POST/GET /api/animais/encontrados` | Atalho que fixa a categoria `ENCONTRADO` (nome opcional; `detalhes_fuga` não é aceito). |

Regras por categoria (`src/utils/regrasAnimal.js`): **ADOCAO** exige nome e não aceita fuga · **PERDIDO** exige nome e
`detalhes_fuga` · **ENCONTRADO** tem nome opcional e não aceita fuga. Em todas: `sexo` (M/F), `descricao` e `foto` são
obrigatórios, e o dono do anúncio vem sempre da sessão (o campo `usuario_id` do corpo é ignorado).

`POST` devolve 201 `{ animal: { id, categoria, nome, sexo, sexoRotulo, sexoIcone, foto } }`.

Cada animal devolve o gênero **já traduzido a partir do que está no banco**:
`{ sexo: "F", sexoRotulo: "Fêmea", sexoIcone: "/img/icon-sexo/fem.png" }` (mapeamento em `src/utils/sexo.js`).

Listagem: `{ itens: [...], proximoCursor: "..." | null }`. Enquanto `proximoCursor` não for `null`, há mais.

Páginas `cadastro-pet`, `meus-pets` e `perfil` exigem login (sem sessão, redirecionam ao início).

## 5. Ajustes necessários no front (poucas linhas)

**a) Mostrar as mensagens** (nas páginas que recebem redirecionamento: `index`, `cadastro-perfil`,
`redefinir-senha`, `criar-nova-senha`, `cadastro-pet`):

```js
const p = new URLSearchParams(location.search);
if (p.get("erro")) alert(p.get("erro"));
if (p.get("cadastro") === "ok") alert("Conta criada! Faça login.");
if (p.get("senha") === "alterada") alert("Senha alterada! Faça login.");
```

**b) `home.html` – trocar os dados simulados pela API, com rolagem infinita:**

```js
let categoria = "TODOS", cursor = null, carregando = false;
const grade = document.querySelector(".grid-animais");

async function carregarMais() {
  if (carregando) return;
  carregando = true;
  const url = `/api/animais?categoria=${categoria}&limite=12` + (cursor ? `&cursor=${cursor}` : "");
  const { itens, proximoCursor } = await (await fetch(url)).json();
  itens.forEach((a) => grade.appendChild(criarCard(a)));
  cursor = proximoCursor;
  carregando = false;
  if (!cursor) observador.disconnect();
}

function criarCard(a) {
  const card = document.createElement("article");
  card.className = "card-pet";
  card.innerHTML = `
    <div class="foto-pet-container"><img class="foto-pet" loading="lazy"></div>
    <div class="info-pet"><div class="linha-topo">
      <span class="nome-pet"></span><img class="genero-pet-icon"></div></div>`;
  card.querySelector(".foto-pet").src = a.foto;
  card.querySelector(".nome-pet").textContent = a.nome ?? "Sem nome"; // textContent, nunca innerHTML (XSS)
  const icone = card.querySelector(".genero-pet-icon");
  icone.src = a.sexoIcone;      // vem do banco
  icone.alt = a.sexoRotulo;
  card.addEventListener("click", () => abrirModal(a.id));
  return card;
}

// filtros: zera a lista e recomeça
botao.addEventListener("click", () => { categoria = botao.dataset.categoria; cursor = null; grade.innerHTML = ""; carregarMais(); });

// rolagem infinita: <div id="sentinela"></div> logo após a grade
const observador = new IntersectionObserver((e) => e[0].isIntersecting && carregarMais());
observador.observe(document.getElementById("sentinela"));
```

No modal, busque `GET /api/animais/${id}` e monte o WhatsApp assim:
`` `https://wa.me/${animal.whatsapp}?text=${encodeURIComponent("Olá! Vi o anúncio do pet " + animal.nome + " no BuscaPet.")}` ``

**c) `cadastro-pet.html`:** funciona como está (`action="/api/animais"`, `enctype="multipart/form-data"`).

### Erros encontrados nos HTML (independem do back-end)
1. `home.html`: o link do WhatsApp está `https://whatsapp.com{dados.whatsapp}…` (falta o `/${`); o correto é `https://wa.me/${dados.whatsapp}?text=…`.
2. `cadastro-pet.html`: o item CADASTRAR da barra inferior aponta para `cadastrar-animal.html`; o arquivo é `cadastro-pet.html`.
3. `perfil.html`: a tag `<main class="main-perfil">` nunca é fechada.

## 6. Decisões de segurança e desempenho

- **Senha:** `bcrypt` (custo 10); o banco guarda só o hash. Resposta de login igual para "e-mail inexistente" e "senha errada", com tempo equalizado.
- **Sessão:** JWT em cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` em produção), 7 dias. O usuário é relido do banco a cada requisição: conta excluída perde a sessão na hora.
- **Recuperação de senha:** token aleatório de 256 bits, guardado só como **hash SHA-256**, válido por 1 h, uso único (consumo atômico), pedido novo invalida o anterior. O e-mail é enviado sem bloquear a resposta.
- **Limites por IP:** login/troca de senha (10 por 15 min), recuperação (5 por 15 min), cadastro (20 por hora).
- **Fotos:** nunca se guarda a original. `sharp` corrige a rotação, reduz para no máx. 800×800, comprime a 80% e converte para WebP; remove o GPS/EXIF. SVG e arquivos que não decodificam como imagem são recusados. Servidas com cache de 30 dias.
- **Listagem:** paginação por **cursor** `(criado_em, id)`: custo constante em qualquer página (medido: ~0,1 ms com 10 mil animais; `OFFSET` 3000 levou 6,7 ms e piora a cada página). A lista não traz telefone nem descrição; o telefone só sai no detalhe.
- **Estáticos:** só `css/`, `img/`, `uploads/` e a lista fixa de páginas são servidos; `back-end/`, `.env` etc. não.

## 7. Deploy (atenção)

1. **Um único serviço** (ex.: Render): *Build* `cd back-end && npm install` · *Start* `cd back-end && npm start`, com as variáveis da seção 3 (`NODE_ENV=production`). O Netlify deixa de ser necessário para o front.
2. **Fotos:** discos de serviços gratuitos costumam ser **efêmeros** (as fotos somem a cada novo deploy/reinício). Antes de ir ao ar, troque só `src/utils/armazenamento.js` por um armazenamento de objetos (Supabase Storage, Cloudinary…); o resto do sistema só usa a URL que ele devolve.
3. **E-mail:** use um SMTP gratuito (Brevo, Resend ou Gmail com senha de app) e preencha `SMTP_*`.

## 8. Fora do que foi implementado

Editar/excluir pet, "Meus Pets" com dados reais, edição e exclusão de perfil.
