# Spec: Módulo Auth/Usuário

## Objetivo

Reimplementar em NestJS o módulo `UsuarioController` do backend Java ABCER com **fidelidade funcional total**: mesmos endpoints, mesma estrutura de resposta, mesmo mecanismo de sessão (JWT via cookie HttpOnly), mesmas regras de negócio.

**Usuário:** o Angular/React frontend já existente — não pode perceber diferença de comportamento.

**Sucesso:** o frontend Angular conectado ao NestJS funciona sem qualquer mudança no código Angular.

---

## Tech Stack

| Item | Tecnologia |
|---|---|
| Framework | NestJS 11 + TypeScript (nodenext) |
| JWT | `jose` ^6.2.3 (já instalado) — RS512 com RSA-4096 |
| Senhas | `bcrypt` ^5 + `@types/bcrypt` |
| Email | `nodemailer` ^6 + `@types/nodemailer` |
| ORM | Prisma 7 via `PrismaPg` adapter |
| DB | PostgreSQL 16 — schema `abcer` |
| Validação | `class-validator` + `class-transformer` (já instalado) |
| Testes | Jest 30 + `@nestjs/testing` |

---

## Endpoints

Todos sob o prefix global `/api`, controller base `usuario`.

### POST `/api/usuario/logar` — público

**Request body:**
```json
{ "email": "string", "senha": "string", "captchaResponse": "string" }
```

**Response 200:**
```json
{ "id": "email@exemplo.com", "nome": "Nome", "roles": ["USER"] }
```

**Cookies set na resposta:**
- `ABCER_JWT_TOKEN` — JWT RS512, HttpOnly, Secure (prod), SameSite=Strict, MaxAge=3600, Path=/
- `XSRF-TOKEN` — UUID aleatório, não HttpOnly, SameSite=Strict, Path=/

**Erros (400 + array):**
- `["Usuário e senha inválidos."]`
- `["Captcha inválido."]`

---

### POST `/api/usuario/logout` — público (idempotente)

**Body:** vazio  
**Response 200:** vazio  
**Efeito:** cookie `ABCER_JWT_TOKEN` com MaxAge=0 (expira imediatamente)

---

### GET `/api/usuario/isAuthenticated` — público

**Response 200:** `true` | `false`  
**Lógica:** retorna `true` se cookie `ABCER_JWT_TOKEN` está presente e não vazio. Não valida a assinatura do JWT.

---

### GET `/api/usuario/user-info` — autenticado

**Response 200:**
```json
{ "id": "email@exemplo.com", "nome": "Nome", "roles": ["USER"] }
```
**Response 401:** sem body (cookie ausente ou JWT inválido)

---

### POST `/api/usuario/enviarLinkNovaSenha` — público

**Formato:** form-data (não JSON)  
**Campos:** `email` (string), `captchaResponse` (string)

**Response 200:** vazio (mesmo se email não existir — anti-enumeração)

**Erros (400 + array):**
- `["Favor, informar o email."]`
- `["Captcha inválido."]`

**Efeito:** envia email HTML com link `{SITE_URL}/trocar-senha?token={uuid}` para o email (se usuário existir).

---

### POST `/api/usuario/trocarSenha` — público

**Formato:** form-data (não JSON)  
**Campos:** `token` (string), `senha` (string), `captchaResponse` (string)

**Response 200:** vazio

**Erros (400 + array):**
- `["Token inválido ou expirado."]`
- `["Captcha inválido."]`

---

## Schema do Banco

Novos modelos a adicionar em `prisma/schema.prisma`:

```prisma
model Usuario {
  id              Int                  @id @default(autoincrement())
  email           String               @unique
  senha           String
  nome            String
  telefone        String?
  dataNascimento  DateTime?            @map("data_nascimento") @db.Date
  usuarioAtivo    Boolean              @default(true) @map("usuario_ativo")
  roles           String[]             @default(["USER"])
  dataCriacao     DateTime             @default(now()) @map("data_criacao")
  dataAlteracao   DateTime             @updatedAt @map("data_alteracao")
  passwordToken   PasswordResetToken?

  @@map("usuario")
}

model PasswordResetToken {
  id             Int      @id @default(autoincrement())
  token          String   @unique
  dataExpiracao  DateTime @map("data_expiracao")
  usuarioId      Int      @unique @map("usuario_id")
  usuario        Usuario  @relation(fields: [usuarioId], references: [id])

  @@map("password_reset_token")
}
```

**Nota:** campo `socio` (FK) fica de fora até o módulo `socio` ser implementado.

---

## Estrutura de Arquivos

```
src/
  usuario/
    dto/
      logar.dto.ts           ← { email, senha, captchaResponse }
      jwt-principal.dto.ts   ← { id, nome, roles }
    usuario.controller.ts
    usuario.service.ts
    usuario.module.ts
    usuario.service.spec.ts

  common/
    guards/
      auth.guard.ts          ← valida cookie + renova JWT em cada req
    decorators/
      principal.decorator.ts ← extrai JwtPrincipal do request
    services/
      jwt.service.ts         ← assinar/verificar JWT (RS512, jose)
      recaptcha.service.ts   ← validar token reCAPTCHA v2 no Google
      email.service.ts       ← enviar emails via nodemailer

prisma/
  schema.prisma              ← adicionar Usuario + PasswordResetToken
  migrations/
    <ts>_add_usuario/migration.sql
```

---

## JWT

**Algoritmo:** RS512  
**Claims:**
```json
{
  "sub": "<email>",
  "nome": "<nome>",
  "roles": ["USER"],
  "iss": "abcer",
  "aud": "abcer",
  "iat": 0,
  "exp": 0,
  "nbf": 0,
  "jti": "<uuid>"
}
```
**TTL:** 3600s (1 hora)  
**not-before:** 90s antes de `iat` (janela de tolerância)  
**Chaves:** par RSA gerado na primeira inicialização, configurável via env `JWT_PRIVATE_KEY_PEM` e `JWT_PUBLIC_KEY_PEM`.  
**Renovação:** o `AuthGuard` gera novo JWT e reenvia o cookie a cada requisição autenticada bem-sucedida.

---

## reCAPTCHA

- Valida contra `https://www.google.com/recaptcha/api/siteverify`
- Secret key via env `RECAPTCHA_SECRET_KEY`
- Env `RECAPTCHA_BYPASS=true` → pula validação (dev/testes)

---

## Email

- SMTP configurável via `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
- Se `EMAIL_HOST` ausente → loga o link no console (dev mode)
- Template HTML fiel ao Java:
  ```html
  <h3>Sistema ABCER - Solicitação de Troca de Senha</h3>
  <p><b>Para trocar a senha, clique no link abaixo. Ele expira em uma hora.</b></p>
  <a href="{SITE_URL}/trocar-senha?token={uuid}">Trocar a Senha</a>
  <p>Caso não tenha solicitado a troca, favor, desconsiderar este email.</p>
  ```
- Env `SITE_URL` para compor o link

---

## Variáveis de Ambiente

Adicionar ao `.env`:
```env
JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\n..."
RECAPTCHA_SECRET_KEY=6Leh--...
RECAPTCHA_BYPASS=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@abcer.org.br
EMAIL_PASS=app-password
SITE_URL=http://localhost:4200
```

---

## Rotas Públicas (sem AuthGuard)

```
POST  /api/usuario/logar
POST  /api/usuario/logout
GET   /api/usuario/isAuthenticated
POST  /api/usuario/enviarLinkNovaSenha
POST  /api/usuario/trocarSenha
GET   /api/estado/todos
GET   /api/estado/cep/:cep
GET   /api/estado/:id/municipios
```

---

## Estilo de Código

Seguir o padrão do módulo `endereco` já implementado:

```typescript
// usuario.service.ts
@Injectable()
export class UsuarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly recaptchaService: RecaptchaService,
    private readonly emailService: EmailService,
  ) {}

  async logar(dto: LogarDto): Promise<JwtPrincipalDto> {
    await this.recaptchaService.validar(dto.captchaResponse);
    const usuario = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (!usuario || !usuario.usuarioAtivo || !(await bcrypt.compare(dto.senha, usuario.senha))) {
      throw new BusinessException(['Usuário e senha inválidos.']);
    }
    return { id: usuario.email, nome: usuario.nome, roles: usuario.roles };
  }
}
```

- Erros: sempre `throw new BusinessException([...])` — nunca `HttpException` direta
- Todos os serviços injetados via construtor
- Sem `any`, sem comentários óbvios

---

## Estratégia de Testes

**Framework:** Jest 30 (já configurado)  
**Localização:** `usuario.service.spec.ts` junto ao serviço  
**Mock:** mesmo padrão do `endereco` — mock do `PrismaService` + serviços externos

**Casos obrigatórios a cobrir:**

`UsuarioService`:
- `logar`: sucesso retorna JwtPrincipal
- `logar`: senha errada → BusinessException
- `logar`: usuário inativo → BusinessException
- `logar`: captcha inválido → BusinessException
- `logout`: sem efeito no service (apenas controller seta cookie)
- `enviarLinkNovaSenha`: email não encontrado → retorna sem erro (anti-enumeração)
- `enviarLinkNovaSenha`: email encontrado → cria token e envia email
- `trocarSenha`: token inválido → BusinessException
- `trocarSenha`: token expirado → BusinessException
- `trocarSenha`: sucesso → senha atualizada, token deletado

`JwtService`:
- `assinar` → JWT válido com claims corretos
- `verificar` → retorna JwtPrincipal
- `verificar` → lança erro com token expirado/inválido

---

## Boundaries

**Sempre:**
- Erros de auth como `BusinessException` (array de strings, HTTP 400)
- `401` para rotas autenticadas sem token válido (sem body)
- BCrypt para todas as senhas — nunca texto puro
- Renovar JWT em todo request autenticado
- Variáveis sensíveis (chaves RSA, SMTP) apenas em env

**Perguntar primeiro:**
- Adicionar novos campos à tabela `usuario`
- Mudar o nome do cookie `ABCER_JWT_TOKEN`
- Alterar claims do JWT
- Mudar estratégia de CSRF após definição inicial

**Nunca:**
- Retornar stack trace ou mensagem de erro interna ao cliente
- Confirmar/negar existência de email em `/enviarLinkNovaSenha`
- Logar senhas ou tokens JWT em logs

---

## Critérios de Aceite

- [ ] `POST /api/usuario/logar` com credenciais válidas retorna 200 + JwtPrincipal + cookies `ABCER_JWT_TOKEN` e `XSRF-TOKEN`
- [ ] Cookie `ABCER_JWT_TOKEN` é HttpOnly, SameSite=Strict, MaxAge=3600
- [ ] `POST /api/usuario/logout` apaga o cookie (MaxAge=0), retorna 200
- [ ] `GET /api/usuario/isAuthenticated` retorna `true` com cookie presente, `false` sem cookie
- [ ] `GET /api/usuario/user-info` retorna JwtPrincipal com JWT válido; 401 sem JWT
- [ ] `POST /api/usuario/enviarLinkNovaSenha` retorna 200 para email inexistente (anti-enumeração)
- [ ] `POST /api/usuario/trocarSenha` com token válido → senha atualizada; 400 para token expirado
- [ ] Todos os testes unitários passam (`npm test`)
- [ ] `npm run build` passa sem erros
- [ ] AuthGuard renova JWT (novo cookie) em cada request autenticado

---

## Questões Abertas

~~1. **CSRF real vs stub**~~ RESOLVIDO: Implementar igual ao Java. Login gera UUID, seta cookie `XSRF-TOKEN` (não HttpOnly). AuthGuard valida `X-XSRF-TOKEN` header == `XSRF-TOKEN` cookie em rotas autenticadas. Rotas públicas ignoram CSRF.

~~2. **Cadastro de usuário**~~ RESOLVIDO: Cadastro pertence ao módulo `socio` (cria socio + usuario juntos). Fora do escopo deste módulo.
