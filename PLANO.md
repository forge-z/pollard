# Pollard — planejamento inicial

## Objetivo

Construir uma redação automatizada pequena e autônoma para o Usinagem360,
priorizando qualidade editorial, confiabilidade, simplicidade e baixo custo.

O sistema produzirá até três notícias por dia, com preferência por conteúdo
nacional, sem inventar conteúdo quando não houver fontes suficientes ou
confiáveis.

## Escopo da primeira versão

O Pollard será composto por três aplicações Eve independentes:

| Aplicação | Responsabilidade | Pode publicar? |
| --- | --- | --- |
| Pollard Radar | Pesquisar RSS/SearXNG, consultar fontes originais, remover duplicatas e classificar candidatos | Não |
| Pollard Editor | Verificar fontes, redigir em pt-BR, revisar, categorizar e enviar conteúdo à API do Usinagem360 | Sim, inicialmente em `draft` |
| Pollard Ops | Verificar saúde dos serviços, falhas e execução dos agentes; alertar no Telegram | Não |

Cada aplicação terá agente, estado/memória, bot Telegram, schedules e somente
as ferramentas necessárias à sua função.

## Decisões iniciais

- `PUBLISH_MODE=draft` será o padrão; `publish` será habilitado somente após
  validação do fluxo.
- A publicação será idempotente para impedir artigos duplicados.
- DeepSeek será suportado desde a primeira versão por variáveis de ambiente,
  mantendo a configuração aberta a outro provider sem criar roteamento complexo.
- PostgreSQL será o único armazenamento persistente, com estados isolados por
  agente.
- Ops usará checks HTTP, checks de banco, timeout e retries limitados; não
  usará LLM para monitoramento.
- O deploy será feito por Docker/Coolify, com reinício independente dos três
  agentes e sem depender de cron do host, Kubernetes ou Vercel Cloud.
- As fontes editoriais prioritárias serão RSS, SearXNG e fonte original; Google
  News será apenas fallback.

## Ordem de execução

1. Confirmar a versão real do Eve e consultar sua documentação oficial para
   agentes, memória, Telegram e schedules.
2. Implementar e validar o Pollard Radar.
3. Implementar e validar o Pollard Editor em modo `draft`.
4. Integrar a API do Usinagem360 com escopo específico e proteção contra
   duplicação.
5. Integrar os três bots Telegram para status, alertas e comandos simples.
6. Implementar o Pollard Ops com checks técnicos e alertas.
7. Empacotar com Docker, `Dockerfile(s)`, `.env.example`, healthcheck e
   `README.md`.
8. Validar o deploy no Coolify e os reinícios independentes.
9. Só depois da validação, considerar `PUBLISH_MODE=publish`.

## Critérios de aceite iniciais

- Radar encontra candidatos dentro da janela padrão de 24 horas e não publica.
- Editor só produz conteúdo após verificar a fonte original e respeita as
  categorias `usinagem`, `industria`, `tecnologia` e `negocios`.
- O fluxo padrão cria rascunhos, não publicações automáticas.
- Uma mesma notícia não gera artigos duplicados mesmo após retry ou restart.
- Chaves e tokens entram somente por environment variables e não são versionados.
- Cada agente pode ser reiniciado sem exigir que os outros sejam reiniciados.
- O sistema tolera timeout de API, falha temporária do SearXNG, Telegram ou
  provider de IA com retries simples e limitados.
- Ops detecta indisponibilidade sem depender de geração de texto.
- O comportamento é verificável em Docker/Coolify sem scripts manuais de
  manutenção.

## Fora do escopo inicial

- Publicação automática antes da validação do modo `draft`.
- Agente generalista, agentes extras ou autorreparo complexo.
- Redis, filas complexas, vector database, Kubernetes e observabilidade externa.
- Acesso genérico a shell/servidor pelo Editor.
- Pesquisa editorial primária baseada em market reports ou press releases.

## Riscos e decisões pendentes

- Confirmar a versão do Eve e suas APIs reais antes de escrever código.
- Confirmar o contrato e o mecanismo de idempotência da API do Usinagem360.
- Definir fontes iniciais homologadas e regras práticas de duplicidade.
- Definir os valores operacionais de timeout, retry, schedules e retenção após
  a validação do fluxo mínimo.

## Decisões confirmadas no Eve

- Eve `0.54.3`, Node 24, `eve build && eve start`.
- Estado durável: `experimental.workflow.world = "@workflow/world-postgres"` (`5.0.0-beta.42`).
- Telegram: `telegramChannel` em `agent/channels/telegram.ts`, rota `POST /eve/v1/telegram`.
- Schedules: `defineSchedule` em `agent/schedules/`. Radar/Editor usam `markdown`; Ops usa `run` sem LLM.
- Ferramentas padrão desligadas com `defaultTools: false`.
- Healthcheck: `GET /eve/v1/health`.
- DeepSeek via `@ai-sdk/deepseek` em `defineAgent({ model })`, não pela AI Gateway.
