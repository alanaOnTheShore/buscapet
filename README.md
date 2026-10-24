# 🐾 BuscaPet: App Mobile Para Busca e Cadastro de Animais

> **Projeto Integrador - Desenvolvimento Orientado a Testes (TDD) e Programação Mobile**  
> *Curso de Análise e Desenvolvimento de Sistemas — Universidade do Vale do Itajaí (UNIVALI)*
> https://alanaontheshore.github.io/buscapet/

---

## 📌 Sobre o Projeto

O **BuscaPet** é uma aplicação (com foco mobile e MVP em Web App / PWA) desenvolvida para centralizar e conectar a comunicação entre organizações de proteção animal (ONGs), protetores independentes, tutores e potenciais adotantes.

A plataforma resolve três problemas principais enfrentados pela comunidade:
1. **Adoção Responsável:** Cadastro e divulgação unificada de animais para adoção.
2. **Pets Perdidos:** Divulgação ágil e centralizada de animais que fugiram do tutor.
3. **Animais Encontrados:** Registro de pets resgatados nas ruas que possuem indícios de ter tutor.

---

## 🛠️ Tecnologias Utilizadas

### **Front-end**
- **HTML5 / CSS3 / JavaScript (ES6+)** — Interfaces responsivas para navegadores móveis e desktop.
- **PWA (Progressive Web App)** — Aplicação web com comportamento nativo no celular.

### **Back-end & Banco de Dados**
- **Node.js** com **Express** — Servidor RESTful para gestão de rotas e regras de negócio.
- **PostgreSQL** — Banco de dados relacional para armazenamento seguro.

### **Testes & Qualidade**
- **Jest** — Framework para testes unitários, de integração e garantia de TDD (cobertura mínima de 80%).

### **Deploy & CI/CD**
- **GitHub Actions** — Pipeline de integração e entrega contínua.
- **Netlify** — Hospedagem do MVP em nuvem.

---

## 🧪 Plano de Testes (TDD / Jest)

O projeto segue a abordagem de **Test-Driven Development (TDD)**, onde as regras de negócio e testes são escritos antes do código de produção.

### **Divisão dos Módulos de Teste (`tests/`)**

- **`tests/auth.test.js` (Módulo de Autenticação):**
  - [ ] Impede o cadastro de e-mails duplicados.
  - [ ] Valida formato correto de e-mail e força de senha.
  - [ ] Garante a emissão de token/sessão em logins bem-sucedidos.

- **`tests/adoption.test.js` (Módulo de Adoção):**
  - [ ] Valida preenchimento dos campos obrigatórios (nome, foto, descrição e contato).
  - [ ] Garante que apenas animais com status "Disponível" sejam listados na aba de adoção.

- **`tests/lost-found.test.js` (Pets Perdidos e Encontrados):**
  - [ ] Valida o registro de animais perdidos com dados de local e momento de fuga.
  - [ ] Garante o armazenamento dos dados de contato do benfeitor em animais encontrados.

- **`tests/filters.test.js` (Sistema de Filtros Cruzados):**
  - [ ] Valida a alternância em até 2 cliques entre *Adoção*, *Perdidos* e *Encontrados*.
  - [ ] Garante a integridade dos dados retornados ao aplicar múltiplos filtros.

---

## 📂 Estrutura do Repositório

```text
buscapet/
├── back-end/             # Lógica do servidor e rotas da aplicação
├── css/                  # Arquivos de estilização (ex: index.css, meus-pets.css)
├── img/                  # Imagens e assets visuais do projeto
├── .gitignore            # Arquivos e pastas ignorados pelo Git
├── README.md             # Documentação principal do repositório
├── cadastro-perfil.html  # Página de cadastro de usuário
├── cadastro-pet.html     # Página de cadastro de novos pets
├── criar-nova-senha.html # Página para redefinição/criação de nova senha
├── home.html             # Página principal/home do sistema
├── index.html            # Página de entrada/login
├── meus-pets.html        # Página de gerenciamento dos pets cadastrados
├── package.json          # Dependências e scripts do projeto Node.js
├── perfil.html           # Página de perfil do usuário
└── redefinir-senha.html  # Página de fluxo de recuperação de senha
````

## 🚀 Como Executar o Projeto Localmente:
- Pré-requisitosNode.js instalado na máquina.
- Git configurado.
### Passo a Passo
1. Clonar o repositório:  
**Bash**  
git clone [https://github.com/SEU-USUARIO/buscapet.git](https://github.com/SEU-USUARIO/buscapet.git)  
cd buscapet  
2. Instalar as dependências:  
**Bash**  
npm install  
3. Executar os testes automatizados (Jest):  
**Bash**  
npm test  
4. Iniciar o servidor em ambiente de desenvolvimento:  
**Bash**  
npm start  
## 👥 Equipe de Desenvolvimento
- Alana Paola Silva Nascimento — Scrum Master, Documentadora & Full-stack
- Hanna Clara Pereira da Silva — Desenvolvedora Front-end & UI/UX 
- Hellen Fernanda Lunardi Gilli — Desenvolvedora Full-stack
- Rita de Cássia da Silva Borges — Engenheira de Banco de Dados & Back-end
## 📄 Licença
*Este projeto foi desenvolvido para fins acadêmicos no curso de Análise e Desenvolvimento de Sistemas (UNIVALI).*
