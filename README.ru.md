# Binnacle

_English version: [README.md](README.md). Этот файл — русский дубликат; обновляется вместе с `README.md`._

**Binnacle** — локальная provider-agnostic надстройка над AI-разработкой, которая хранит состояние проекта **вне чатов**, даёт свежим агентам компактный актуальный контекст, собирает telemetry по расходам и оставляет человека главным управляющим процессом.

> Нактоуз (binnacle) — тумба с компасом перед штурвалом. Он не рулит и не выбирает курс: он держит приборы там, где рулевой их видит. В этом всё техзадание.

## Что решаем

Современный AI-development быстро упирается не только в качество модели, но и в управление контекстом:

- длинные Product-сессии разрастаются и начинают дорого стоить;
- после compaction часть деталей теряется или искажается;
- новый Claude/Codex/GLM/Gemini заново исследует проект;
- разные агенты повторно читают одни и те же файлы;
- сложно понять, куда ушли токены, cache, tool calls и rework;
- при смене модели приходится вручную переносить контекст;
- параллельные агенты без контроля зависимостей создают merge-конфликты и дублируют работу.

Control Plane выносит состояние проекта в устойчивые источники: Git, Markdown-документацию, ADR, tracker и локальный reconstructable event/telemetry layer. Чат становится временным рабочим контекстом, а не памятью проекта.

## Основной принцип

> **Project knowledge и task state принадлежат проекту, а не конкретной модели, чату или coding harness.**

Claude Code, Codex, GLM, Gemini и будущие/local agents — сменяемые исполнители.

## Что входит в v1

- локальный daemon `binnd`;
- CLI `binn`;
- локальный MCP server;
- небольшой Web Dashboard на Nuxt;
- registry проектов;
- сущности Project / Task / AgentRun / Review;
- Product Snapshot и Daily Snapshot;
- checkpoint вместо conversation handoff;
- ingestion telemetry от поддерживаемых coding agents;
- GitHub/GitLab tracker adapters + local markdown fallback;
- audit/adopt существующего проекта;
- интеграция с Matt Pocock Skills;
- интеграция с Ponytail;
- Serena, Graphify, Context7 и ast-grep как context/coding capabilities;
- Obsidian как human-facing projection Project Brain;
- manual-first execution: система рекомендует, человек запускает.

## Что НЕ входит в v1

- автономная «виртуальная компания» агентов;
- автоматический запуск Architect/QA/Security/Reviewer;
- автоматический model routing;
- собственный Git/task tracker/CI;
- Kubernetes/SRE/incident platform;
- полноценный Release Captain subsystem;
- LiteLLM как обязательный gateway;
- team/server mode;
- сложный AI optimization advisor;
- обязательная зависимость проекта от Binnacle.

## Стек

- **TypeScript** — весь собственный application code;
- **Node.js 24 LTS** — runtime baseline;
- **pnpm** — package manager / workspace;
- **Nuxt** — Web Dashboard;
- локальная SQLite DB — projection/cache для v1;
- MCP — agent-facing API;
- OpenTelemetry — основной telemetry transport там, где поддерживается;
- Markdown/YAML/JSON — переносимые форматы project knowledge/config.

Python/Go/Rust в собственном core не используем. Внешние инструменты могут иметь свой runtime (например Serena/Graphify), но Binnacle их только интегрирует.

## Целевая структура репозитория

```text
binnacle/
├── apps/
│   ├── daemon/
│   ├── dashboard/
│   └── cli/
├── packages/
│   ├── core/
│   ├── mcp/
│   ├── telemetry/
│   └── adapters/
├── docs/
├── templates/
├── AGENTS.md
├── CLAUDE.md
└── CONTEXT.md
```

## Быстрый путь нового проекта

```text
idea / discussion
    ↓
initial Markdown docs
    ↓
binn init
    ↓
setup Matt Pocock Skills
    ↓
grill-with-docs
    ↓
to-spec
    ↓
to-tickets
    ↓
/product
    ↓
/task <id>
    ↓
Developer → Review → Merge
```

## Быстрый путь существующего проекта

```text
binn adopt .
    ↓
/audit
    ↓
review migration plan
    ↓
normalize knowledge/tracker/telemetry
    ↓
/product
```

## Документация

Начать читать в таком порядке:

1. `docs/00-scope.md`
2. `docs/01-architecture.md`
3. `docs/02-project-brain.md`
4. `docs/workflow/01-product-workflow.md`
5. `docs/workflow/02-development-workflow.md`
6. `docs/03-mcp-and-skills.md`
7. `docs/04-telemetry-dashboard.md`
8. `docs/05-mvp-plan.md`

Актуальные архитектурные решения зафиксированы в `docs/adr/`.
