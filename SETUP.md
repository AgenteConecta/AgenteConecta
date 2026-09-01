# Setup

## 1. Instalar dependências

```powershell
npm install
```

## 2. Variáveis de ambiente

Crie `.env.local` a partir de `.env.example`.

Nunca coloque `.env.local` no Git.

Defina os modelos apenas pelo ambiente:

```text
OPENAI_MODEL=
OPENAI_MODEL_FAST=
```

## 3. Supabase

Crie um projeto Supabase, preencha:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Depois aplique a migração em `supabase/migrations/001_initial_schema.sql`.

## 4. Chrome dedicado para Instagram

Use um perfil separado do Chrome:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --remote-debugging-address=127.0.0.1 `
  --user-data-dir="$PWD\.chrome-profile"
```

Mantenha o debug apenas em `127.0.0.1`.

## 5. Rodar o painel

```powershell
npm run dev
```

## 6. Evolution API

Preencha no `.env.local`:

```text
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
```

O nome da instância pode ter espaços e acentos; o sistema codifica esse valor ao chamar a API.
