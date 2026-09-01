# Operations

## Rotina diária

1. Confirmar que o modo está em `dry_run`, `pilot` ou `production`.
2. Verificar `Master pause`.
3. Revisar leads quentes.
4. Conferir opt-outs e solicitações de revisão humana.
5. Validar jobs em erro ou dead letter.
6. Acompanhar custo OpenAI.
7. Comparar resultado por região, segmento e experimento.

## Envio de Instagram

O browser worker só navega em `instagram.com` e `www.instagram.com`.

Em `dry_run`, o envio é bloqueado e o job registra o resultado.

Smoke test real exige autorização explícita do operador.

## Follow-up

Follow-ups consideram perfil, etapa, histórico e interesse. O limite padrão é configurável por `MAX_FOLLOWUPS`.

## Lead quente

Um lead deve aparecer como prioridade quando `commercial_value_score` ultrapassa o limite configurado e há sinais como projeto ativo, cliente, kit, representação ou uso de concorrente.
