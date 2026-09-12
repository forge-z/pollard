# Manual de uso e setup — Pollard

Este manual descreve como instalar, configurar e operar o Pollard no homelab,
com deploy pelo Coolify.

O Pollard é uma redação automatizada pequena para o Usinagem360. Ele encontra
notícias, transforma as melhores em texto jornalístico em português brasileiro
e publica rascunhos pela API do site. A prioridade é qualidade editorial,
depois confiabilidade, simplicidade e baixo custo.

## 1. O que o Pollard faz

Três aplicações Eve independentes, cada uma com o próprio agente, estado,
Telegram, schedule e conjunto mínimo de ferramentas:

```text
RADAR    encontra as notícias.
EDITOR   transforma as notícias em conteúdo.
OPS      garante que tudo continua funcionando.
```

| Aplicação | Responsabilidade | Publica? |
| --- | --- | --- |
| Pollard Radar | Lê RSS, consulta SearXNG, acessa a fonte original, remove duplicatas e classifica candidatos | Não |
| Pollard Editor | Verifica a fonte, escreve em pt-BR, escolhe categoria e envia à API do Usinagem360 | Sim, em `draft` por padrão |
| Pollard Ops | Faz checks HTTP e de banco e envia alertas no Telegram | Não |

O Radar nunca publica. O Editor é o único agente com acesso à API do
Usinagem360. O Ops não usa modelo de linguagem para monitorar: usa HTTP check,
check de banco, timeout e retry.

Meta operacional: até 3 notícias por dia, com preferência por conteúdo
nacional. Se não houver fonte suficiente ou confiável, o sistema não inventa
matéria.

## 2. Arquitetura

```text
                Telegram
           /       |        \
      Radar     Editor      Ops
           \       |        /
            PostgreSQL
           /    |     \     \
     editorial  radar  editor  ops
     (fila)     (Eve)  (Eve)   (Eve)

Radar  →  RSS, SearXNG, fonte original
Editor →  API do Usinagem360 (rascunho)
Ops    →  /eve/v1/health dos outros serviços
```

- Cada agente tem o próprio banco Workflow (`pollard_radar`, `pollard_editor`,
  `pollard_ops`). Isso isola o estado do Eve.
- Os três compartilham o banco `pollard` só para a fila editorial
  (candidatos, publicações, heartbeats).
- O deploy é Docker. O Coolify cuida de restart. Não use cron do host,
  Kubernetes nem Vercel Cloud.

Versões desta primeira versão:

- Eve `0.54.3`
- Node.js 24
- PostgreSQL 16
- `@workflow/world-postgres` `5.0.0-beta.42`
- DeepSeek via `@ai-sdk/deepseek`

## 3. O que você precisa antes

| Item | Para quê |
| --- | --- |
| Homelab com Docker e Coolify | Rodar e reiniciar os três agentes |
| PostgreSQL 16 | Estado do Eve e fila editorial |
| SearXNG na rede local | Busca sem depender de buscador comercial |
| Chave da [DeepSeek API](https://platform.deepseek.com) | Modelo do Radar e do Editor |
| Três bots no Telegram | Status, comandos e alertas |
| Credenciais da API do Usinagem360 | Só o Editor publica |
| Domínios HTTPS | Webhook do Telegram e proxy do Eve |

Opcional, mas recomendado: um usuário Basic Auth para proteger `/eve/v1`.

## 4. Setup rápido com Docker Compose

Este é o caminho mais simples para validar o sistema no homelab.

### 4.1 Preparar o ambiente

```bash
git clone https://github.com/forge-z/pollard.git
cd pollard
cp .env.example .env
```

Edite o `.env` e preencha pelo menos:

- `POSTGRES_PASSWORD`
- `DEEPSEEK_API_KEY`
- `SEARXNG_URL`
- `USINAGEM360_API_URL` e credenciais
- tokens e chat IDs dos três bots
- `ROUTE_AUTH_BASIC_PASSWORD`

Nunca coloque chave no Git. O arquivo `.env` já está no `.gitignore`.

### 4.2 Subir os serviços

```bash
docker compose up -d --build
```

Isso sobe:

| Serviço | Porta no host | Healthcheck |
| --- | --- | --- |
| postgres | `127.0.0.1:5432` | `pg_isready` |
| radar | `3001` | `GET /eve/v1/health` |
| editor | `3002` | `GET /eve/v1/health` |
| ops | `3003` | `GET /eve/v1/health` |

Na primeira subida o entrypoint:

1. espera o Postgres;
2. cria o schema editorial em `pollard`;
3. faz o bootstrap do Workflow no banco daquele agente;
4. inicia `eve start --host 0.0.0.0`.

### 4.3 Conferir se está no ar

```bash
curl -fsS http://127.0.0.1:3001/eve/v1/health
curl -fsS http://127.0.0.1:3002/eve/v1/health
curl -fsS http://127.0.0.1:3003/eve/v1/health
```

Resposta esperada: JSON com `"ok": true`.

Reinicie um agente sem mexer nos outros:

```bash
docker compose restart radar
docker compose restart editor
docker compose restart ops
```

## 5. Setup no Coolify

Crie **três aplicações** no mesmo projeto Coolify, uma por agente. Elas devem
poder ser atualizadas e reiniciadas de forma independente.

Use o mesmo repositório e o mesmo `Dockerfile`. A diferença é o build-arg:

| Aplicação Coolify | Build-arg | Valor |
| --- | --- | --- |
| Pollard Radar | `APP` | `radar` |
| Pollard Editor | `APP` | `editor` |
| Pollard Ops | `APP` | `ops` |

### 5.1 Proxy

O Eve precisa de dois prefixos, **sem reescrever o caminho**:

- `/eve/` — health, sessões, Telegram, ferramentas
- `/.well-known/workflow/` — callbacks do Workflow

Se o proxy só encaminhar `/eve/`, a sessão começa e trava no callback.

Aponte um hostname por agente, por exemplo:

```text
https://radar.seudominio.tld
https://editor.seudominio.tld
https://ops.seudominio.tld
```

Healthcheck do Coolify: `GET /eve/v1/health`.

### 5.2 Bancos

Crie quatro bancos no Postgres:

```text
pollard           fila editorial compartilhada
pollard_radar     estado Eve do Radar
pollard_editor    estado Eve do Editor
pollard_ops       estado Eve do Ops
```

No compose local o script `docker/postgres/init.sh` cria os três bancos
Workflow automaticamente. No Postgres gerenciado do Coolify, crie-os à mão.

Cada serviço recebe:

- `DATABASE_URL` → `postgres://.../pollard`
- `WORKFLOW_POSTGRES_URL` → o banco Workflow daquele agente

Se a senha tiver caracteres especiais (`@`, `#`, `/`, `%`), faça URL-encode
dela na connection string.

### 5.3 Variáveis por serviço no Coolify

Comuns aos três:

```text
NODE_ENV=production
PORT=3000
POLLARD_APP=radar|editor|ops
POLLARD_AGENT=radar|editor|ops
DATABASE_URL=postgres://usuario:senha@host:5432/pollard
WORKFLOW_POSTGRES_URL=postgres://usuario:senha@host:5432/pollard_<agente>
WORKFLOW_TARGET_WORLD=@workflow/world-postgres
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
ROUTE_AUTH_BASIC_USER=pollard
ROUTE_AUTH_BASIC_PASSWORD=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET_TOKEN=...
TELEGRAM_BOT_USERNAME=...
TELEGRAM_CHAT_ID=...
```

Só no Radar:

```text
SEARXNG_URL=http://searxng:8080
RSS_FEEDS=
```

Só no Editor:

```text
PUBLISH_MODE=draft
USINAGEM360_API_URL=https://usinagem360.com.br
USINAGEM360_API_KIND=wordpress
USINAGEM360_API_USER=...
USINAGEM360_API_PASSWORD=...
```

Só no Ops:

```text
RADAR_HEALTH_URL=https://radar.seudominio.tld
EDITOR_HEALTH_URL=https://editor.seudominio.tld
SEARXNG_URL=http://searxng:8080
USINAGEM360_API_URL=https://usinagem360.com.br
```

No `docker-compose.yml` os bots usam prefixos `RADAR_`, `EDITOR_` e `OPS_`,
porque os três serviços leem o mesmo arquivo. No Coolify, cada app tem o
próprio ambiente: use os nomes sem prefixo (`TELEGRAM_BOT_TOKEN`, etc.).

## 6. Telegram

Crie **três bots** no [@BotFather](https://t.me/BotFather):

```text
Pollard Radar
Pollard Editor
Pollard Ops
```

Anote o token e o username de cada um (sem `@`).

Envie uma mensagem para o bot, depois descubra o `chat_id`:

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates"
```

Use esse `chat_id` em `TELEGRAM_CHAT_ID` para status e alertas.

### 6.1 Registrar o webhook

O Eve **não** chama `setWebhook`. Faça isso uma vez por bot, depois do
hostname HTTPS estar no ar:

```bash
# Radar
curl -X POST "https://api.telegram.org/bot$RADAR_TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://radar.seudominio.tld/eve/v1/telegram","secret_token":"'"$RADAR_TELEGRAM_WEBHOOK_SECRET_TOKEN"'","allowed_updates":["message","callback_query"]}'

# Editor
curl -X POST "https://api.telegram.org/bot$EDITOR_TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://editor.seudominio.tld/eve/v1/telegram","secret_token":"'"$EDITOR_TELEGRAM_WEBHOOK_SECRET_TOKEN"'","allowed_updates":["message","callback_query"]}'

# Ops
curl -X POST "https://api.telegram.org/bot$OPS_TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://ops.seudominio.tld/eve/v1/telegram","secret_token":"'"$OPS_TELEGRAM_WEBHOOK_SECRET_TOKEN"'","allowed_updates":["message","callback_query"]}'
```

O `secret_token` precisa ser o mesmo valor de `TELEGRAM_WEBHOOK_SECRET_TOKEN`
daquele container.

O Telegram não é painel administrativo do servidor. Não há comando para
shell, Docker, Coolify ou banco.

### 6.2 Comandos

**Radar**

| Comando | Efeito |
| --- | --- |
| `/help` | Lista os comandos |
| `/status` | Mostra candidatos novos ou na fila |
| `/scan` | Dispara uma busca editorial agora |

**Editor**

| Comando | Efeito |
| --- | --- |
| `/help` | Lista os comandos |
| `/status` ou `/pending` | Cota do dia e fila do Radar |
| `/write` | Processa a fila agora |

**Ops**

| Comando | Efeito |
| --- | --- |
| `/help` | Lista os comandos |
| `/status` ou `/health` | Checks HTTP, banco e heartbeats (sem LLM) |

O Ops também alerta sozinho quando um check falha. O mesmo alerta não se
repete a cada 10 minutos: há uma janela de silêncio de 30 minutos por
conjunto de falhas.

## 7. Rotina editorial

O relógio dos schedules é UTC. Os padrões cobrem manhã, tarde e noite no
horário de Brasília (UTC−3):

| Agente | Cron padrão | Horário em Brasília |
| --- | --- | --- |
| Radar | `0 14,18,23 * * *` | 11h, 15h e 20h |
| Editor | `30 14,18,23 * * *` | 11h30, 15h30 e 20h30 |
| Ops | `*/10 * * * *` | a cada 10 minutos |

`eve start` dispara esses crons. Não configure cron no host.

Fluxo do dia:

1. O Radar busca RSS, depois SearXNG, e só usa Google News se não restar
   candidato útil.
2. Fontes de market report e press release (`prnewswire`, `globenewswire`,
   `businesswire`, etc.) são descartadas no código.
3. Duplicatas caem por URL canônica ou título normalizado.
4. O Radar só encaminha o que for relevante e verificável.
5. O Editor lê a fonte original, escreve a matéria e chama
   `publish_article`.
6. Com `PUBLISH_MODE=draft`, o Usinagem360 recebe rascunho, não post no ar.
7. No máximo 3 peças por dia (`DAILY_ARTICLE_LIMIT`).

Categorias permitidas:

```text
usinagem
industria
tecnologia
negocios
```

O texto deve parecer escrito por um jornalista de indústria: claro, técnico
quando necessário, sem clickbait, sem exagero e sem fato inventado.

## 8. Publicação no Usinagem360

Só o Editor fala com a API. Não há ferramenta de shell nem acesso genérico
ao servidor.

Padrão: WordPress REST.

```text
POST {USINAGEM360_API_URL}/wp-json/wp/v2/posts
Authorization: Basic usuario:application-password
```

Variáveis:

| Variável | Uso |
| --- | --- |
| `USINAGEM360_API_URL` | Base do site, sem barra final obrigatória |
| `USINAGEM360_API_KIND` | `wordpress` (padrão) ou `generic` |
| `USINAGEM360_API_USER` | Usuário com permissão de criar posts |
| `USINAGEM360_API_PASSWORD` | Application Password do WordPress |
| `USINAGEM360_API_TOKEN` | Alternativa Bearer, se a API exigir |
| `PUBLISH_MODE` | `draft` ou `publish` |

A publicação é idempotente: a mesma notícia (URL + título) não gera dois
posts, mesmo depois de retry ou restart do container.

Deixe `PUBLISH_MODE=draft` até validar título, texto, categoria e fonte no
painel do Usinagem360. Só então mude para `publish` e reinicie o Editor.

Se a API do site não for WordPress REST, use:

```text
USINAGEM360_API_KIND=generic
USINAGEM360_API_URL=https://seu-endpoint/articles
```

O Editor envia JSON com `title`, `content`, `excerpt`, `category`,
`source_url`, `status` e `idempotency_key`.

## 9. Inteligência artificial

O provider entra por variável de ambiente. DeepSeek funciona desde a
primeira versão.

```text
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Para outro endpoint compatível com OpenAI:

```text
AI_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_BASE_URL=https://seu-proxy/v1
OPENAI_COMPATIBLE_MODEL=...
```

Não há roteamento complexo de modelos. RSS, HTML, duplicata, healthcheck e
publicação são código, não LLM.

O Ops precisa da mesma variável de modelo só porque o Eve exige um
`defineAgent`. O monitoramento em si não chama a API de IA.

## 10. Variáveis de ambiente

Referência completa. Valores vazios significam “não configurado”.

### 10.1 Sistema

| Variável | Padrão | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `POLLARD_APP` | `radar` | no Docker | Qual app o container executa |
| `POLLARD_AGENT` | `radar` | não | Nome lógico do agente |
| `NODE_ENV` | — | produção: `production` | Liga Basic Auth no canal HTTP |
| `PORT` | `3000` | não | Porta do Eve |
| `PUBLISH_MODE` | `draft` | não | `draft` ou `publish` |
| `DAILY_ARTICLE_LIMIT` | `3` | não | Teto diário de peças |
| `RESEARCH_WINDOW_HOURS` | `24` | não | Janela de pesquisa |
| `HTTP_TIMEOUT_MS` | `15000` | não | Timeout HTTP |
| `HTTP_RETRIES` | `2` | não | Retries simples |

### 10.2 Banco

| Variável | Padrão | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | — | sim | Banco da fila editorial |
| `WORKFLOW_POSTGRES_URL` | — | produção: sim | Estado durável do Eve |
| `WORKFLOW_TARGET_WORLD` | `@workflow/world-postgres` | produção: sim | Mundo Workflow |
| `WORKFLOW_POSTGRES_JOB_PREFIX` | — | não | Prefixo da fila Graphile |

### 10.3 IA

| Variável | Padrão | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `AI_PROVIDER` | `deepseek` | não | `deepseek` ou `openai-compatible` |
| `DEEPSEEK_API_KEY` | — | se DeepSeek | Chave da API |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | não | Modelo |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | não | Endpoint |
| `OPENAI_COMPATIBLE_*` | — | se o provider for esse | Proxy OpenAI-compatible |
| `MODEL_CONTEXT_WINDOW_TOKENS` | `128000` | não | Janela de contexto |

### 10.4 Pesquisa

| Variável | Padrão | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `SEARXNG_URL` | — | recomendada | Instância SearXNG |
| `RSS_FEEDS` | lista interna | não | URLs separadas por vírgula ou quebra de linha |
| `GOOGLE_NEWS_QUERY` | usinagem/CNC/manufatura | não | Fallback, não fonte primária |

### 10.5 Usinagem360 e HTTP

| Variável | Padrão | Obrigatória | Descrição |
| --- | --- | --- | --- |
| `USINAGEM360_API_*` | WordPress | no Editor | Ver seção 8 |
| `ROUTE_AUTH_BASIC_USER` | — | produção: sim | Basic Auth de `/eve/v1` |
| `ROUTE_AUTH_BASIC_PASSWORD` | — | produção: sim | Senha do Basic Auth |

Sem usuário e senha em produção, o canal HTTP fica fechado (`placeholderAuth`).
`GET /eve/v1/health` continua público.

### 10.6 Telegram

No Coolify, por container:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET_TOKEN
TELEGRAM_BOT_USERNAME
TELEGRAM_CHAT_ID
```

No `docker-compose.yml`:

```text
RADAR_TELEGRAM_*
EDITOR_TELEGRAM_*
OPS_TELEGRAM_*
```

### 10.7 Ops

| Variável | Descrição |
| --- | --- |
| `RADAR_HEALTH_URL` | Base do Radar, sem `/eve/v1/health` |
| `EDITOR_HEALTH_URL` | Base do Editor |
| `SEARXNG_URL` | Check extra do buscador |
| `USINAGEM360_API_URL` | Check extra da API |

## 11. Desenvolvimento local

Requisito: Node.js 24.

```bash
cp .env.example .env
npm install
docker compose up -d postgres
export DATABASE_URL=postgres://pollard:SUA_SENHA@127.0.0.1:5432/pollard
node --experimental-strip-types scripts/migrate.ts
```

Subir um agente:

```bash
npm run dev -w @pollard/radar
npm run dev -w @pollard/editor
npm run dev -w @pollard/ops
```

`eve dev` **não** dispara cron. Para forçar um schedule em desenvolvimento:

```bash
curl -X POST http://localhost:2000/eve/v1/dev/schedules/scan
curl -X POST http://localhost:2000/eve/v1/dev/schedules/write
curl -X POST http://localhost:2000/eve/v1/dev/schedules/health
```

Essa rota de dispatch existe só no `eve dev`. Em produção ela não é montada.

Testes de código, sem chamar LLM:

```bash
npm test
```

Build de produção:

```bash
npm run build -w @pollard/radar
npm run build -w @pollard/editor
npm run build -w @pollard/ops
```

## 12. Checklist de primeiro uso

1. Postgres no ar, quatro bancos criados.
2. `.env` preenchido; nenhuma chave no Git.
3. `PUBLISH_MODE=draft`.
4. DeepSeek respondendo.
5. SearXNG acessível pela rede dos containers.
6. Três bots com webhook HTTPS registrado.
7. `/eve/v1/health` dos três agentes retorna ok.
8. `/status` no Ops mostra checks verdes.
9. `/scan` no Radar encontra candidatos ou explica a falta de fonte.
10. `/write` no Editor cria rascunho, nunca post no ar.
11. Restart de um container não derruba os outros e não duplica artigo.
12. Só depois disso, se o rascunho estiver bom, habilite `publish`.

## 13. Problemas comuns

**Healthcheck falha depois do deploy.**  
O Eve ainda pode estar no bootstrap do Postgres. Espere o `start_period`
(40s) ou veja o log do entrypoint.

**Telegram não responde.**  
Confira token, `secret_token`, hostname HTTPS e se o webhook aponta para
`/eve/v1/telegram`. O Eve não registra webhook sozinho.

**Radar não acha nada.**  
Confira `SEARXNG_URL` e se os RSS padrão ainda respondem. Sem fonte
confiável, o correto é não produzir matéria.

**Editor recusa publicar.**  
Cota diária esgotada, candidato já processado, ou
`USINAGEM360_API_URL`/credenciais ausentes. Em `draft`, o post deve
aparecer como rascunho no CMS.

**Sessão do Eve trava.**  
O proxy provavelmente não encaminha `/.well-known/workflow/`.

**Agentes compartilham estado do Eve.**  
Cada um precisa do próprio `WORKFLOW_POSTGRES_URL`. `DATABASE_URL` é o
único banco compartilhado.

**Falha temporária de SearXNG, Telegram ou DeepSeek.**  
Há retry simples e limitado. O Ops alerta se o serviço continuar fora.
O Docker/Coolify reinicia o container; não há autorreparo complexo.

## 14. O que o Pollard não faz

- Agente generalista ou ferramentas que não sejam da função
- Redis, fila extra, vector database ou observabilidade externa
- Kubernetes
- Cron no host
- Acesso administrativo ao servidor pelo Telegram
- Publicação automática no ar antes de validar o modo `draft`
- Inventar notícia, número ou declaração

Se Docker ou Coolify já resolve o problema, deixe Docker ou Coolify
resolver.

## 15. Onde está cada coisa no repositório

```text
apps/radar      aplicação Eve do Radar
apps/editor     aplicação Eve do Editor
apps/ops        aplicação Eve do Ops
packages/core   RSS, SearXNG, duplicata, API, healthcheck
docker-compose.yml
Dockerfile      um arquivo, build-arg APP=radar|editor|ops
.env.example    modelo de configuração
scripts/migrate.ts
```

O plano inicial está em `PLANO.md`. Este manual é a referência de operação.
