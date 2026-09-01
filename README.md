# Newtek Sales Engine

Sistema comercial autônomo para a Newtek Automação, construído como um monólito modular em Next.js, TypeScript strict, Supabase/PostgreSQL, OpenAI SDK, Playwright e Evolution API.

O ciclo operacional é:

`Observar -> Descobrir -> Qualificar -> Decidir -> Abordar -> Conversar -> Converter -> Medir -> Aprender -> Adaptar`

## O que já está implementado

- Painel PT-BR com visão geral, funis, lead quente, controles de segurança e métricas.
- Configuração comercial central em `config/business.json`.
- Migração Supabase com as tabelas centrais do CRM, jobs, mensagens, claims, ofertas, pedidos e credenciamento.
- Scoring técnico e comercial com explicação por contribuição.
- Deduplicação por Instagram, telefone, email, site e empresa.
- Primeira abordagem contextual sem preço prematuro.
- Detecção de opt-out para alimentar `do_not_contact`.
- Browser worker com CDP e allowlist restrita ao Instagram.
- Integração Evolution API com modo `dry_run`.
- Agente WhatsApp preparado para JSON estruturado validado por schema.
- Circuit breaker, master pause e proteção de orçamento.
- Testes unitários dos fluxos críticos do MVP.

## Comandos

```powershell
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

## Modos

- `simulation`: nenhuma integração externa.
- `dry_run`: integrações reais podem ser preparadas, mas envio final fica bloqueado.
- `pilot`: envio real com limite baixo e revisão operacional.
- `production`: limites normais configurados.

O padrão do projeto é `dry_run`.
