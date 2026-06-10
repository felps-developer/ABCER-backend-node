# ABCER Backend — NestJS

Reimplementação do backend legado Java/Spring Boot do sistema ABCER em **NestJS 11 + TypeScript**, desenvolvida como parte do TCC *"A Abordagem SDD na Modernização de Sistemas Legados em Java"* (UNIFOR, 2026).

## Visão Geral

| Item | Detalhe |
|---|---|
| Framework | NestJS 11 |
| Linguagem | TypeScript 5 |
| ORM | Prisma 7 + PrismaPg adapter |
| Banco | PostgreSQL 16 |
| Autenticação | JWT RS512 via `jose`, cookie HttpOnly `ABCER_JWT_TOKEN` |
| Hash | BCrypt v6 |
| Upload | multer (disco local em `uploads/{cpfCnpj}/`) |
| Porta padrão | 3000 (dev) / 3001 (Docker) |

### Endpoints implementados

| Módulo | Endpoints |
|---|---|
| Endereço | `GET /estado/todos`, `GET /estado/:id/municipios`, `GET /estado/cep/:cep` |
| Usuário | `POST /logar`, `POST /logout`, `GET /isAuthenticated`, `GET /user-info`, `POST /enviarLinkNovaSenha`, `POST /trocarSenha` |
| Sócio | `POST /socio/incluir`, `GET /socio/logado`, `GET /socio/todos`, `PUT /socio`, `DELETE /socio/:id` |
| UC | `GET /uc/todosPaginados`, `GET /uc/:id`, `GET /uc/:id/fatura`, `POST /uc/salvar`, `DELETE /uc/:id` |

---

## Pré-requisitos

- Node.js >= 20
- npm >= 10
- Docker e Docker Compose (para subir o PostgreSQL)
- OpenSSL (para gerar as chaves RSA)

---

## Configuração do ambiente

### 1. Copie o arquivo de variáveis de ambiente

```bash
cp .env.example .env
```

Crie o arquivo `.env` na raiz do projeto com o conteúdo abaixo:

```env
# Banco de dados
POSTGRES_USER=abcer
POSTGRES_PASSWORD=abcer
DATABASE_URL="postgresql://abcer:abcer@localhost:5432/abcerDB?schema=abcer"

PORT=3000

# reCAPTCHA — true desativa a validação (ambiente de desenvolvimento)
RECAPTCHA_BYPASS=true
RECAPTCHA_SECRET_KEY=

# URL base da aplicação (usada nos links de e-mail)
SITE_URL=http://localhost:3000

# E-mail (deixe vazio para imprimir o link no console em vez de enviar)
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=

# JWT RS512 — deixe vazio para ler de keys/private.pem e keys/public.pem
JWT_PRIVATE_KEY_PEM=
JWT_PUBLIC_KEY_PEM=
```

### 2. Gere as chaves RSA

```bash
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

---

## Iniciando o projeto

### Opção A — Desenvolvimento local

```bash
# 1. Instale as dependências
npm install

# 2. Suba o PostgreSQL via Docker
docker compose up postgres -d

# 3. Execute as migrations e gere o client Prisma
npx prisma migrate deploy
npx prisma generate

# 4. (Opcional) Popule o banco com dados de teste
npm run db:seed

# 5. Inicie o servidor em modo watch
npm run start:dev
```

A API estará disponível em `http://localhost:3000`.

### Opção B — Docker Compose completo

```bash
# Sobe PostgreSQL + API NestJS em containers
docker compose up --build
```

A API estará disponível em `http://localhost:3001`.

> **Atenção:** No modo Docker, as chaves RSA precisam existir em `keys/` antes do build, ou as variáveis `JWT_PRIVATE_KEY_PEM` / `JWT_PUBLIC_KEY_PEM` devem estar preenchidas no `docker-compose.yml`.

---

## Testes

```bash
# Testes unitários
npm run test

# Testes com cobertura
npm run test:cov

# Testes e2e
npm run test:e2e
```

---

## Build para produção

```bash
npm run build
npm run start:prod
```

---

## Estrutura do projeto

```
src/
├── common/          # Guards, filtros, decorators, serviços compartilhados
├── endereco/        # Módulo de endereço (estados, municípios, CEP)
├── usuario/         # Módulo de autenticação e usuário
├── socio/           # Módulo de sócio
├── unidade-consumidora/  # Módulo de UC
├── prisma/          # PrismaService e PrismaModule
└── main.ts
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```
