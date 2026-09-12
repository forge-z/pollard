# Pollard

Redação automatizada pequena para o [Usinagem360](https://usinagem360.com.br), baseada no [Vercel Eve](https://eve.dev) e pensada para o homelab com Coolify.

Três aplicações Eve independentes:

| App | Função | Publica? |
| --- | --- | --- |
| **Radar** | RSS, SearXNG e fonte original. Filtra duplicatas e entrega candidatos. | Não |
| **Editor** | Verifica a fonte, escreve em pt-BR e envia à API do Usinagem360. | Sim, em `draft` por padrão |
| **Ops** | HTTP check, check de banco e alertas no Telegram. Sem LLM no monitoramento. | Não |

Prioridade: qualidade editorial → confiabilidade → simplicidade → baixo custo.

**Manual completo de uso e setup (pt-BR):** [MANUAL.md](./MANUAL.md)

## Requisitos

- Node.js 24
- PostgreSQL 16
- SearXNG na rede local (recomendado)
- Três bots Telegram
- Chave da [DeepSeek API](https://api.deepseek.com)

Eve usado nesta versão: `eve@0.54.3`, com estado durável em `@workflow/world-postgres@5.0.0-beta.42`.

## Desenvolvimento local

```bash
cp .env.example .env
npm install
docker compose up -d postgres
export DATABASE_URL=postgres://pollard:pollard@127.0.0.1:5432/pollard
node --experimental-strip-types scripts/migrate.ts
```

Cada agente sobe sozinho:

```bash
npm run dev -w @pollard/radar
npm run dev -w @pollard/editor
npm run dev -w @pollard/ops
```

`eve dev` não dispara cron. Para testar um schedule:

```bash
curl -X POST http://localhost:2000/eve/v1/dev/schedules/scan
curl -X POST http://localhost:2000/eve/v1/dev/schedules/write
curl -X POST http://localhost:2000/eve/v1/dev/schedules/health
```

Testes de código (sem LLM):

```bash
npm test
```

## Docker / Coolify

O `docker-compose.yml` sobe Postgres e os três agentes, cada um com healthcheck em `/eve/v1/health`. Reinícios ficam a cargo do Docker/Coolify. Não use cron do host.

Coolify: um serviço por agente, mesmo `Dockerfile`, build-arg `APP=radar|editor|ops`. Encaminhe `/eve/` e `/.well-known/workflow/` sem reescrever o caminho.

Cada agente precisa de um banco Workflow isolado (`pollard_radar`, `pollard_editor`, `pollard_ops`) e todos compartilham `pollard` para a fila editorial.

```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:3001/eve/v1/health
```

## Variáveis

Toda configuração entra por environment variables. Nada de chave no Git.

| Variável | Função |
| --- | --- |
| `PUBLISH_MODE` | `draft` (padrão) ou `publish` |
| `AI_PROVIDER` | `deepseek` (padrão) ou `openai-compatible` |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | Provider inicial |
| `DATABASE_URL` | Fila editorial compartilhada |
| `WORKFLOW_POSTGRES_URL` | Estado Eve daquele agente |
| `SEARXNG_URL` | Busca local |
| `RSS_FEEDS` | Lista opcional; há uma lista padrão no código |
| `USINAGEM360_API_URL` | API de publicação (WordPress REST por padrão) |
| `TELEGRAM_BOT_TOKEN` | Bot daquele container |
| `TELEGRAM_CHAT_ID` | Destino de status e alertas |
| `ROUTE_AUTH_BASIC_USER` / `PASSWORD` | Proteção de `/eve/v1` |

No compose, os bots usam prefixos `RADAR_`, `EDITOR_` e `OPS_`.

Webhook do Telegram, um por agente:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://radar.example.com/eve/v1/telegram","secret_token":"'"$TELEGRAM_WEBHOOK_SECRET_TOKEN"'","allowed_updates":["message","callback_query"]}'
```

## Comandos Telegram

- Radar: `/status`, `/scan`
- Editor: `/status`, `/pending`, `/write`
- Ops: `/status` (checks de código, sem modelo)

## Publicação

O Editor é o único que chama a API. A ferramenta `publish_article` é específica, idempotente e não abre shell. `PUBLISH_MODE=draft` cria rascunho. Só mude para `publish` depois de validar o fluxo.

Categorias: `usinagem`, `industria`, `tecnologia`, `negocios`.

## O que este sistema não faz

- Agente generalista ou autorreparo complexo
- Redis, fila extra, vector database, Kubernetes
- Acesso genérico ao servidor
- Inventar notícia quando a fonte falta
