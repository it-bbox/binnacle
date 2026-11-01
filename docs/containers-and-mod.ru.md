# Контейнеры и мод для Claude Code

Два необязательных пути: запустить Binnacle внутри контейнера, в котором уже живёт ваше приложение, и положить состояние Binnacle рядом с чатом в Claude Code. Ни один из них не нужен самому Binnacle.

## В контейнере

Binnacle идёт туда, где работает harness, поэтому каждый контейнер приложения получает свой Binnacle: свой демон, home, токен и dashboard для единственного проекта в нём. Без контейнера достаточно `binn init` и навыков. Полные шаги, включая feature для dev container и правила портов, — в [Binnacle в контейнере](operations/07-containers.ru.md).

## Мод для Claude Code

`binnacle-mod` — необязательный плагин Claude Code из того же пакета: строка статуса с задачей сессии, токенами, контекстом и лимитами использования, полоса *Waiting for you*, панель, открываемая своей командой, и всплывающие уведомления — всё читается из демона. Он ничего не пишет и ничего не показывает без демона.

`binn init` спрашивает, устанавливать ли его, — по умолчанию нет, и только там, где найден Claude Code 2.1.308 или новее. Чтобы установить его позже, отключить или удалить:

```bash
claude plugin install binnacle-mod@binnacle --scope user
claude plugin disable binnacle-mod
claude plugin enable binnacle-mod
claude plugin uninstall binnacle-mod
```

Что спрашивает и пишет `binn init` — в [чек-листе установки](operations/05-installation-checklist.ru.md#мод-binnacle-для-claude-code).
