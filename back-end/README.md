# BuscaPet – Back-end (Autenticação + Módulo de Adoção)

API em Node.js/Express + PostgreSQL. **O mesmo servidor entrega as páginas HTML e a API**, então
os `action="/login"`, `fetch("/api/...")` e cookies do front funcionam sem CORS.

```
buscapet/                  <- raiz do repositório (html, css/, img/)
└── back-end/
    ├── database/          schema.sql (v2), migracao_001_*.sql, seed_desempenho.sql
    ├── src/
    │   ├── routes/        auth, usuarios (perfil), animais (adoção), perdidos, encontrados
    │   ├── controllers/   auth, usuarios, animais (genérico), perdidos, encontrados
    │   ├── models/        animal.model.js e usuario.model.js  (únicos lugares com SQL)
    │   ├── middlewares/   sessão, limites, upload, erros
    │   └── utils/         validação, regras por categoria, imagem, cursor, e-mail...
    ├── tests/             auth, usuarios, adocao, meus-pets, perdidos, encontrados, integracao, banco
    └── .env.example
```

O front-end (HTML, `css/`, `img/` e os módulos JavaScript em `js/`) fica na raiz do repositório e é
servido por este mesmo servidor (veja a seção 5).

**Arquitetura em camadas:** `routes` (URL e middlewares) → `controllers` (HTTP e fluxo) →
`models` (SQL; controllers e middlewares nunca acessam o banco diretamente). As regras de cada categoria ficam em `src/utils/regrasAnimal.js` (adoção, perdidos
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
npm test                    # todos os testes (precisa do banco de TESTES)
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
| `PATCH /api/me` | `nome, telefone` (e-mail, tipo e senha não mudam por aqui) | 200 `{usuario}` com os dados gravados | 400 (`campos`), 401 |
| `DELETE /api/me` | – | 200 `{ok}`; apaga a conta, os anúncios e as fotos (inclusive os arquivos) e encerra a sessão | 401 |
| `POST /api/recuperar-senha` | `{email}` | 200 **sempre igual** (não revela se o e-mail existe) | – |
| `POST /atualizar-senha` | `token, senha, conf-senha` | 200 · form → `/index.html?senha=alterada` | 400 link inválido/expirado/usado |

### Animais (Adoção, Perdidos e Encontrados)

| Rota | Descrição |
|---|---|
| `POST /api/animais` | **Login obrigatório.** `multipart/form-data`: `categoria, nome, sexo (M/F), descricao, detalhes_fuga, foto`. Foto: JPG/PNG/WEBP/GIF até 10 MB. |
| `GET /api/animais?categoria=ADOCAO&limite=12&cursor=…` | Pública. `categoria`: `ADOCAO`, `PERDIDO`, `ENCONTRADO` ou `TODOS` (padrão). Limite padrão 12, máximo 30. |
| `GET /api/animais/:id` | Pública. Dados completos + `whatsapp` (já com DDI 55) para o modal. |
| `GET /api/animais/meus` | **Login obrigatório.** Todos os anúncios de quem está logado, do mais recente ao mais antigo: `{ itens: [...] }` (mesmo formato do card da listagem). |
| `DELETE /api/animais/:id` | **Login obrigatório.** Só o dono exclui; apaga também a foto (banco e arquivo). 200 `{ok}`. Anúncio de outra pessoa, inexistente ou id inválido: 404. |
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

## 5. Front-end (`js/`)

As páginas HTML não têm mais JavaScript escrito dentro delas: cada uma carrega **um módulo** de
`js/paginas/` (`<script type="module" src="js/paginas/home.js">`). O servidor entrega a pasta `js/`
em `/js`.

```
js/
├── api.js            único arquivo que chama fetch (JSON, erros -> mensagem pronta, 401 -> login)
├── categorias.js     categoria do banco -> texto e classe de cor (ADOCAO -> "Adoção")
├── componentes.js    pedaços de tela reutilizados (tag de status, ícone de sexo, foto)
├── geral.js          o que toda página faz ao abrir: efeito de toque no iOS e avisos vindos da URL
└── paginas/          um módulo por página: index, cadastro-perfil, redefinir-senha,
                      criar-nova-senha, home, cadastro-pet, meus-pets, perfil
```

| Página | O que usa da API |
|---|---|
| `home.html` | `GET /api/animais` (filtro por categoria + rolagem infinita por cursor) e `GET /api/animais/:id` (modal, WhatsApp em `wa.me`) |
| `meus-pets.html` | `GET /api/animais/meus` e `DELETE /api/animais/:id` |
| `perfil.html` | `GET`, `PATCH` e `DELETE /api/me` e `POST /api/logout` |
| `cadastro-pet.html` | formulário nativo `POST /api/animais` (multipart) |

**Avisos:** os formulários HTML nativos voltam com parâmetros na URL (`?erro=…`, `?cadastro=ok`,
`?senha=alterada`, `?cadastrado=1`). `js/geral.js` mostra a mensagem uma única vez e limpa a URL.

**Segurança no front:** todo texto vindo da API entra na tela por `textContent`, nunca por
`innerHTML`; um nome de pet como `<script>…` aparece como texto e não executa.

**Estilos compartilhados** (tag de status e suas cores, ícone de sexo, logo, mensagem de lista) ficam
em `css/geral.css`; cada página só tem o CSS que é dela.

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

- **Editar anúncio:** o botão "Editar" de Meus Pets mostra "em construção" (a página `editar-animal.html` e a rota
  `PATCH /api/animais/:id` ainda não existem).
