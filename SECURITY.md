# Security

## Segredos

Nunca versionar:

- `.env`
- `.env.local`
- `config/business.json`
- `.chrome-profile`
- `screenshots`
- `traces`
- `tokens`
- `cookies`

## OpenAI

A chave da OpenAI deve ficar apenas em arquivo local ignorado ou variável de ambiente. Se uma chave for exposta em texto claro, rotacione a chave no painel da OpenAI.

## Claims

A IA só pode afirmar claims com `status = verified`. Claims pendentes, bloqueados ou expirados não devem aparecer em mensagens comerciais.

## Instagram

Não implementar evasão, spoofing, CAPTCHA solver, API privada ou bypass de restrições. Pausar a prospecção quando houver sessão perdida, restrição, erro anormal, opt-out elevado ou comportamento inesperado.

## Incidentes

1. Acionar `Master pause`.
2. Preservar logs e eventos.
3. Identificar canal afetado.
4. Corrigir credenciais, webhooks ou jobs.
5. Retomar primeiro em `dry_run` ou `pilot`.
