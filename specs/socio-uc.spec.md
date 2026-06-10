# Spec: Módulos Socio + UnidadeConsumidora

> Fonte primária: specs SDD em `site-specs/specify/abcer-analysis/specs/`
> Consolidação de três contextos: `cadastro-socio`, `gestao-socio`, `gestao-uc`

---

## Objetivo

Reimplementar em NestJS os módulos `SocioController` e `UnidadeConsumidoraController` do backend Java ABCER com fidelidade total de contrato: mesmos endpoints, mesmas mensagens de erro (incluindo typos), mesmo comportamento de upload de arquivo, mesma lógica de paginação.

---

## Tech Stack

| Item | Detalhe |
|---|---|
| Upload | `multer` disk storage via `@nestjs/platform-express` (já instalado) |
| Transação | `prisma.$transaction([...])` para atomicidade |
| Auth | `AuthGuard` existente — mas retorna **403** (não 401) nesses módulos |
| Arquivo | `fs.unlink` para remoção; diretório `uploads/` como volume Docker |
| Parsing DTO | `JSON.parse(req.body.socioDTO)` — campo é JSON string no FormData |

---

## Endpoints — Socio

Base: `/api/socio`

### POST `/api/socio/incluir` — público
- **Content-Type:** `multipart/form-data`
- **Campos:**
  - `captchaResponse` (string)
  - `fileDocumento` (File, max 2MB)
  - `fileUC` (File, max 2MB)
  - `socioDTO` (string JSON)
- **Resposta 200:** `SocioDTO` + cookie `ABCER_JWT_TOKEN` + `XSRF-TOKEN`
- **Erros 400 (acumulados):**
  - `"Captcha inválido."` — falha imediata
  - `"Número do Cliente já cadastrado!"` — por UC
  - `"E-mail já cadastrado! Favor, usar a opção Entrar!"`
  - `"CPF/CNPJ já cadastrado! Favor, usar a opção Entrar!"`
  - `"Documento, RG ou CNH, obrigatório."`
  - `"Última fatura da conta de energia obrigatória."`
- **Ordem exata de validação:**
  1. Captcha (falha imediata)
  2. Acumula: numeroCliente duplicado, email duplicado, cpfCnpj duplicado
  3. Se qualquer erro → lança tudo junto
  4. Arquivo documento ausente → erro
  5. Persiste usuário + sócio (transação)
  6. Arquivo fatura ausente → erro
  7. Persiste UCs
  8. Auto-login → seta cookies JWT + CSRF

### GET `/api/socio/logado` — autenticado (USER, ADMIN), retorna 403 sem auth
- **Resposta 200:** `SocioDTO` completo (com UCs e endereços)
- **Sem auth:** 403
- **Lógica:** email do JWT → `findByEmail(email)` → SocioDTO

### PUT `/api/socio` — autenticado (USER, ADMIN), retorna 403 sem auth
- **Content-Type:** `multipart/form-data`
- **Campos:**
  - `fileDocumento` (File — novo arquivo ou `File([], '')` para manter)
  - `socioDTOString` (string JSON)
- **Comportamento `fileDocumento`:**
  - `originalname != ""` → remove arquivo anterior do disco, salva novo
  - `originalname == ""` → mantém `documentoFullPath` atual
  - sem documento no banco + sem arquivo → erro (validação no frontend, backend não valida)
- **Regras:** senha fornecida → BCrypt + auto-login + novo JWT; senha vazia → não altera senha
- **Resposta 200:** `SocioDTO` atualizado

### GET `/api/socio/todos` — público
- **Params:** `?pagina=0&tamanho=10`
- **Resposta 200:** `Page<SocioDTO>`

### DELETE `/api/socio/:idSocio` — autenticado (qualquer role), retorna 403 sem auth
- **Resposta 200:** `SocioDTO` removido

---

## Endpoints — UnidadeConsumidora

Base: `/api/unidadeConsumidora`

### GET `/api/unidadeConsumidora/todosPaginados` — autenticado, 403 sem auth
- **Params:** `?pagina=0&tamanho=10`
- **Resposta 200:** `Page<UnidadeConsumidoraDTO>` — **somente UCs do sócio logado**

### GET `/api/unidadeConsumidora/:id` — autenticado, 403 sem auth
- **Resposta 200:** `UnidadeConsumidoraDTO`

### POST `/api/unidadeConsumidora/salvar` — autenticado, 403 sem auth
- **Content-Type:** `multipart/form-data`
- **Campos:**
  - `file` (File — fatura)
  - `ucDTOString` (string JSON)
- **Lógica:** `id == null || id == 0` → cria; `id > 0` → edita (substitui fatura anterior)
- **Erros:**
  - `"Número do Cliente obrigatório."`
  - `"Número da Unidade Consumidora obrigatório."`
  - `"Número da Unidade Consmidora já cadastrado."` *(typo preservado: sem 'u')*
- **Resposta 200:** `UnidadeConsumidoraDTO`

### DELETE `/api/unidadeConsumidora/:idUC` — autenticado, 403 sem auth
- **Resposta 200:** sem body
- **Proteção:** se sócio tem apenas 1 UC → `400 ["Exclusão não permitida. Enquanto sócio, você deve ter pelo menos uma unidade consumidora."]`

### GET `/api/unidadeConsumidora/:id/fatura` — autenticado, 403 sem auth
- **Resposta 200:** arquivo binário (PDF/imagem)
- **Header:** `Content-Disposition: attachment; filename="..."`

---

## DTOs

### SocioDTO (request e response)
```typescript
{
  id?: number
  nome: string
  telefone: string        // apenas dígitos
  email: string
  cpfCnpj: string         // apenas dígitos
  tipoPessoa: number      // 0 = PESSOA_FISICA, 1 = PESSOA_JURIDICA
  tipoSocio: number       // 0 = FUNDADOR, 1 = NORMAL
  concordouEstatuto: boolean
  documentoFullPath?: string
  endereco: {
    logradouro: string
    numero: number
    complemento?: string
    bairro: string
    cep: string           // apenas dígitos
    municipio: { id: number }
  }
  unidadesConsumidoras: UnidadeConsumidoraDTO[]
  usuario: {
    id?: number
    nome: string
    email: string
    telefone?: string
    dataNascimento?: string
    senha?: string        // plain text na request; nunca retornado
    usuarioAtivo?: boolean
    roles?: string[]
  }
}
```

### UnidadeConsumidoraDTO
```typescript
{
  id?: number
  numeroCliente: string
  numeroUc: string
  faturaFullPath?: string
  endereco: {
    logradouro: string
    numero: number
    complemento?: string
    bairro: string
    cep: string
    municipio: { id: number, nome?: string, idEstado?: number, nomeEstado?: string }
  }
}
```

### Page<T>
```typescript
{
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}
```

---

## Schema Prisma — novos modelos

```prisma
model Socio {
  id                Int      @id @default(autoincrement())
  cpfCnpj           String   @map("cpf_cnpj")
  nome              String
  telefone          String?
  email             String
  documentoFullPath String?  @map("documento_full_path")
  tipoPessoa        Int      @map("tipo_pessoa")
  tipoSocio         Int      @map("tipo_socio")
  concordouEstatuto Boolean  @map("concordou_estatuto")
  endLogradouro     String?  @map("logradouro")
  endNumero         Int?     @map("numero")
  endComplemento    String?  @map("complemento")
  endBairro         String?  @map("bairro")
  endCep            String?  @map("cep")
  endMunicipioId    Int?     @map("municipio_id")
  dataCriacao       DateTime @default(now()) @map("data_criacao")
  dataAlteracao     DateTime @updatedAt @map("data_alteracao")
  usuario           Usuario?
  unidadesConsumidoras UnidadeConsumidora[]
  @@map("socio")
}

model UnidadeConsumidora {
  id             Int      @id @default(autoincrement())
  numeroCliente  String   @map("numero_cliente")
  numeroUc       String   @map("numero_uc")
  faturaFullPath String?  @map("fatura_full_path")
  socioId        Int      @map("socio_id")
  socio          Socio    @relation(fields: [socioId], references: [id])
  endLogradouro  String?  @map("logradouro")
  endNumero      Int?     @map("numero")
  endComplemento String?  @map("complemento")
  endBairro      String?  @map("bairro")
  endCep         String?  @map("cep")
  endMunicipioId Int?     @map("municipio_id")
  dataCriacao    DateTime @default(now()) @map("data_criacao")
  dataAlteracao  DateTime @updatedAt @map("data_alteracao")
  @@map("unidade_consumidora")
}
```

Atualizar `Usuario`:
```prisma
// adicionar em model Usuario:
socioId Int?     @unique @map("socio")
socio   Socio?   @relation(fields: [socioId], references: [id])
```

---

## Estrutura de Arquivos

```
src/
  socio/
    dto/
      socio.dto.ts
      page.dto.ts
    socio.controller.ts
    socio.service.ts
    socio.module.ts
    socio.service.spec.ts

  unidade-consumidora/
    dto/
      uc.dto.ts
    uc.controller.ts
    uc.service.ts
    uc.module.ts
    uc.service.spec.ts

  common/
    services/
      arquivo.service.ts   ← upload/remoção de arquivos no disco
    guards/
      auth403.guard.ts     ← igual AuthGuard mas lança ForbiddenException (403)
```

---

## ArquivoService

```typescript
// Salva arquivo em uploads/{cpfCnpj}/{timestamp}-{originalname}
// Retorna o path relativo armazenado no banco
uploadFile(cpfCnpj: string, file: Express.Multer.File): string

// Remove arquivo do disco (ignora se não existir)
removerArquivo(path: string): void
```

Configuração multer: `dest: 'uploads/'`, limite 2MB por arquivo.

---

## Auth403Guard

Mesmo comportamento do `AuthGuard` existente, mas lança `ForbiddenException` (HTTP 403) em vez de `UnauthorizedException` (401). Renova JWT + CSRF em cada request autenticado (igual ao pai).

---

## Docker

Adicionar volume `uploads` ao docker-compose e Dockerfile:
```yaml
# docker-compose.yml
volumes:
  - uploads_data:/app/uploads
```

```dockerfile
# Dockerfile production — já existe o CMD node dist/src/main.js
# Apenas garantir que uploads/ existe
RUN mkdir -p /app/uploads
```

---

## Variáveis de Ambiente

Nenhuma nova. `RECAPTCHA_BYPASS=true` já está no docker-compose.

---

## Boundaries

**Sempre:**
- Preservar typos exatos das mensagens de erro (ex: "Consmidora" sem 'u')
- `tipoPessoa` e `tipoSocio` armazenados como inteiros (0, 1)
- Senha nunca retornada no SocioDTO
- Transação atômica no cadastro (usuario + socio + UCs)
- 403 (não 401) para rotas protegidas sem autenticação

**Perguntar primeiro:**
- Alterar estrutura do Page<T>
- Adicionar campos ao SocioDTO
- Mudar nomes de campos do FormData

**Nunca:**
- Corrigir o typo "Consmidora" — o frontend Angular espera essa string exata
- Retornar senha em qualquer resposta

---

## Critérios de Aceite

- [ ] `POST /socio/incluir` com dados válidos → 200 + SocioDTO + cookie JWT ativo
- [ ] `GET /usuario/isAuthenticated` retorna `true` após cadastro
- [ ] Email duplicado → `400 ["E-mail já cadastrado! Favor, usar a opção Entrar!"]`
- [ ] CPF/CNPJ duplicado → `400 ["CPF/CNPJ já cadastrado! Favor, usar a opção Entrar!"]`
- [ ] Email + CPF duplicados → ambas as mensagens no mesmo array 400
- [ ] Sem fileDocumento → `400 ["Documento, RG ou CNH, obrigatório."]`
- [ ] Sem fileUC → `400 ["Última fatura da conta de energia obrigatória."]`
- [ ] `GET /socio/logado` retorna SocioDTO completo com UCs para usuário autenticado
- [ ] `GET /socio/logado` sem auth → 403
- [ ] `PUT /socio` com novo fileDocumento → substitui arquivo anterior
- [ ] `PUT /socio` sem arquivo (`originalname == ""`) → mantém documento anterior
- [ ] `PUT /socio` com nova senha → senha atualizada + JWT renovado
- [ ] `GET /socio/todos?pagina=0&tamanho=5` → resposta com schema Page<T>
- [ ] `GET /unidadeConsumidora/todosPaginados` → apenas UCs do sócio logado
- [ ] `POST /unidadeConsumidora/salvar` com `id=null` → cria nova UC
- [ ] `POST /unidadeConsumidora/salvar` com `id>0` → edita UC
- [ ] `DELETE /unidadeConsumidora/{id}` com 1 UC → `400 ["Exclusão não permitida..."]`
- [ ] `GET /unidadeConsumidora/{id}/fatura` → arquivo binário com Content-Disposition
- [ ] Todos os testes unitários passam
- [ ] `npm run build` sem erros
