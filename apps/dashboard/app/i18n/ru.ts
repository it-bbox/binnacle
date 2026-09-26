import type { Dictionary } from './en.ts';

/** The Russian dictionary. The domain terms stay English, as in `en.ts`. */
export const ru: Dictionary = {
  overview: 'Обзор',
  project: 'Проект',
  usage: 'Расход',
  attention: 'Внимание',
  projects: 'Проекты',
  menu: 'Страницы',
  projectRail: 'Зарегистрированные проекты',
  language: 'Язык',

  currentEpic: 'Текущий Epic',
  everyEpicDone: 'Все Epic завершены',
  noEpics: 'В roadmap нет ни одного Epic',
  notAvailable: 'Недоступно',
  noRoadmap: 'Roadmap не читается',
  noProject: 'Ни один проект не зарегистрирован.',

  runsRunning: { one: 'идёт # run', few: 'идут # run', many: 'идут # run', other: 'идут # run' },
  attentionItems: {
    one: '# пункт требует внимания',
    few: '# пункта требуют внимания',
    many: '# пунктов требуют внимания',
    other: '# пункта требуют внимания',
  },

  updated: (ago) => `обновлено ${ago}`,
  lastReply: (ago) => `последний ответ ${ago}`,
  connecting: 'подключение…',

  addProject: 'Добавить проект',
  addBody: 'В папке проекта выполните:',
  addNote: 'Binnacle покажет проект при следующем обновлении. С этой страницы ничего не регистрируется.',

  signin: 'Чтобы открыть панель, выполните:',
  loading: 'Подключение к демону…',
  daemonTitle: 'Демон Binnacle недоступен',
  daemonBody: 'Панель берёт все данные у локального демона. Запустите его, и страница переподключится сама.',
  retrying: 'Повторный запрос каждые 15 секунд.',
  failed: 'Демон ответил ошибкой:',

  copy: 'Скопировать',
  copied: 'Скопировано',
  copyFailed: 'Не удалось скопировать: выделите команду и скопируйте её вручную.',
};
