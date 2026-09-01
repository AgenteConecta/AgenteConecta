# Architecture

O projeto é um monólito modular.

## Camadas

- `config/`: dados comerciais editáveis da operação.
- `src/app/`: painel Next.js em PT-BR.
- `src/features/leads`: deduplicação e identidade de leads.
- `src/features/scoring`: lead score, commercial value score, awareness e geografia.
- `src/features/conversations`: primeira abordagem, opt-out e schema de decisão.
- `src/features/funnels`: funis de treinamento e credenciamento.
- `src/features/jobs`: fila persistente e recuperação.
- `src/features/safety`: master pause, circuit breaker e bloqueios operacionais.
- `src/features/experiments`: atribuição A/B determinística.
- `src/features/agents`: agentes comerciais preparados para prompts versionáveis.
- `src/integrations`: OpenAI, Supabase, Instagram browser/CDP, Meta futuro e Evolution API.
- `supabase/migrations`: PostgreSQL do CRM.

## Decisões da IA

O LLM deve retornar JSON validado por schema. A aplicação registra justificativas operacionais curtas, sem armazenar raciocínio privado.

## Channel owner

Cada lead possui um único dono de canal por vez: `browser`, `meta_api`, `whatsapp`, `human` ou `none`. O banco inclui `acquire_channel_lock` para garantir transição transacional.
