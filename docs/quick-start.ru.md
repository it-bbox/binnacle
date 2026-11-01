# Быстрый старт

Binnacle — это один локальный демон и набор навыков для агентов. Установите его, запустите, затем настройте проект через `binn init`.

## Установка

```bash
npm i -g @it-bbox/binnacle
binn daemon start
```

`binn daemon start` отдаёт dashboard на `http://127.0.0.1:7717` по умолчанию; с выключенным автозапуском он берёт другой свободный порт из `BINNACLE_PORT`. Для разового запуска без установки — `npx -p @it-bbox/binnacle binn`.

## Новый проект

1. `git init` — создать репозиторий.
2. `binn init` — один план всего, что он настраивает, подтверждённый один раз.
3. `/binnacle:roadmap` — видение и эпики.
4. `/binnacle:product` — первая продуктовая сессия.

Дальше каждый эпик идёт `/grill-with-docs` → `/to-spec` → `/to-tickets`, а каждый тикет — `/binnacle:task run <ticket>`, в отдельной сессии. В harness, отличном от Claude Code, каждое `/binnacle:<action>` — это `binnacle-<action>`: см. [Работа из другого harness](operations/06-other-harnesses.ru.md).

## Существующий проект

1. `binn audit` — находки только для чтения; он ничего не пишет.
2. `binn init` — тот же один план.
3. `/binnacle:roadmap` — эпики, предложенные по коду, истории и документам.
4. `/binnacle:product` — первая продуктовая сессия.

Ничего не перемещается и не переписывается без вашего «да».

## Куда дальше

- [Новый проект: каждый шаг](operations/01-new-project.ru.md)
- [Существующий проект: каждый шаг](operations/02-existing-project-adopt.ru.md)
- [Чек-лист установки](operations/05-installation-checklist.ru.md)
- [Контейнеры и мод для Claude Code](containers-and-mod.ru.md)
