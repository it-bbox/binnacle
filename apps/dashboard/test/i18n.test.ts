import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pairMessage, ROLES, TASK_STATES } from '@binnacle/core';
import { compactNumber, daemonSaid, DICTIONARIES, duration, LANGUAGES, plural, secondsAgo, startingLanguage } from '../app/i18n/index.ts';
import { ROADMAP_STATUSES } from '../../../packages/core/src/roadmap.ts';
import { NO_FORGE } from '../../daemon/src/ci.ts';
import { trackerUnavailable } from '../../daemon/src/snapshot.ts';

/**
 * The dashboard's own dictionary (ADR-0033): which language the page starts in, and how a
 * count and a relative time read in it; that its Russian says the domain's terms in Russian
 * (ADR-0045), and that what the daemon says is worded by core from its code and params. The
 * pages themselves are checked in a browser (spec `human-output`, *Testing Decisions*); a
 * missing Russian key fails the typecheck.
 */

/** Every text a dictionary holds: its strings, its plural forms, and what its functions write from sample values. */
function texts(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return [...texts(value('a/01', 1, 'x')), ...texts(value('a/01, a/02', 2, 'x'))];
  if (value !== null && typeof value === 'object') return Object.values(value).flatMap(texts);
  return [];
}

describe('the starting language', () => {
  it('is the stored choice when there is one', () => {
    assert.equal(startingLanguage('en', ['ru-RU']), 'en');
    assert.equal(startingLanguage('ru', ['en-US']), 'ru');
  });

  it('is Russian when the browser prefers Russian, and English otherwise', () => {
    assert.equal(startingLanguage(null, ['ru-RU', 'en-US']), 'ru');
    assert.equal(startingLanguage(null, ['ru']), 'ru');
    assert.equal(startingLanguage(null, ['en-US', 'ru-RU']), 'en');
    assert.equal(startingLanguage(null, ['de-DE']), 'en');
    assert.equal(startingLanguage(null, []), 'en');
    assert.equal(startingLanguage('fr', ['ru']), 'ru', 'a stored value that names no language is ignored');
  });
});

describe('the language choice', () => {
  it('lists every dictionary the dashboard has, each by its own name', () => {
    assert.deepEqual(LANGUAGES, [
      { value: 'en', label: 'English' },
      { value: 'ru', label: 'Русский' },
    ]);
  });
});

describe('a count', () => {
  const runs = { one: '# run', few: '# runs (few)', many: '# runs (many)', other: '# runs' };

  it('takes the plural form Intl.PluralRules gives in the language, with the number formatted in it', () => {
    assert.equal(plural('en', 1, runs), '1 run');
    assert.equal(plural('en', 3, runs), '3 runs');
    assert.equal(plural('ru', 1, runs), '1 run');
    assert.equal(plural('ru', 21, runs), '21 run');
    assert.equal(plural('ru', 3, runs), '3 runs (few)');
    assert.equal(plural('ru', 5, runs), '5 runs (many)');
    assert.equal(plural('ru', 11, runs), '11 runs (many)');
    assert.equal(plural('en', 12_345, runs), '12,345 runs');
    assert.equal(plural('ru', 12_345, runs), '12 345 runs (many)');
  });

  it('falls back to the other form when the language needs one the entry does not give', () => {
    assert.equal(plural('ru', 5, { one: '# run', other: '# runs' }), '5 runs');
  });
});

describe('a relative time', () => {
  it('reads in seconds under a minute and in minutes after, in the language', () => {
    assert.equal(secondsAgo('en', 5), '5 sec. ago');
    assert.equal(secondsAgo('ru', 5), '5 сек. назад');
    assert.equal(secondsAgo('en', 0), 'now');
    assert.equal(secondsAgo('en', 150), '2 min. ago');
    assert.equal(secondsAgo('ru', 150), '2 мин. назад');
  });

  it('reads in hours under a day and in days after, as a run found days ago does', () => {
    assert.equal(secondsAgo('en', 5 * 3600), '5 hr. ago');
    assert.equal(secondsAgo('en', 3 * 86_400 + 60), '3 days ago');
    assert.equal(secondsAgo('ru', 3 * 86_400), '3 дн. назад');
  });
});

describe('a duration', () => {
  it('reads in the largest whole unit up to days, in the language, as a run that has been going', () => {
    assert.equal(duration('en', 7), '7 sec');
    assert.equal(duration('ru', 7), '7 с');
    assert.equal(duration('en', 15 * 60 + 40), '15 min');
    assert.equal(duration('ru', 15 * 60), '15 мин');
    assert.equal(duration('en', 2 * 3600 + 59 * 60), '2 hr');
    assert.equal(duration('ru', 3 * 86_400), '3 дн.');
    assert.equal(duration('en', -3), '0 sec', 'a start a little ahead of this clock reads as none');
  });
});

describe('the board card', () => {
  it('gives a running card its time and its latest activity', () => {
    const { ru, en } = DICTIONARIES;
    assert.equal(`${ru.runningFor(duration('ru', 15 * 60))} · ${ru.activeAgo(secondsAgo('ru', 7))}`, 'идёт 15 мин · активность 7 сек. назад');
    assert.equal(`${en.runningFor(duration('en', 15 * 60))} · ${en.activeAgo(secondsAgo('en', 7))}`, 'running 15 min · active 7 sec. ago');
  });
});

describe('a compact number', () => {
  it('reads short under a bar, in the language', () => {
    assert.equal(compactNumber('en', 5_306_279), '5.3M');
    assert.equal(compactNumber('ru', 5_306_279), '5,3\u00a0млн');
    assert.equal(compactNumber('en', 12_466), '12.5K');
    assert.equal(compactNumber('en', 950), '950');
  });
});

describe('what the daemon says', () => {
  it('is worded by core from its code and params, with no code in the text', () => {
    const item = { code: 'review.missing', message: 'a/01 (x.md) is DONE, and its ticket records no Review.', params: { task: 'a/01', ticket: 'x.md' } };
    assert.deepEqual(daemonSaid('ru', item), { text: 'Задача a/01 (x.md) готова, но в её тикете нет ревью в ## Comments.', english: false });
    assert.deepEqual(daemonSaid('en', item), { text: item.message, english: false });
    assert.doesNotMatch(daemonSaid('ru', item).text, /review\.missing/);
  });

  it('is a reason as the daemon gives it, with its code, in Russian', () => {
    assert.deepEqual(daemonSaid('ru', { reason: NO_FORGE, code: 'ci.no_forge' }), {
      text: 'CI читать неоткуда: трекер — не GitHub и не GitLab, и Git remote на GitHub или GitLab нет.',
      english: false,
    });
    assert.equal(daemonSaid('ru', { reason: 'There is no graph.', code: 'graph.unavailable', params: { kind: 'none' } }).text, 'Графа нет.');
    assert.equal(daemonSaid('en', { reason: NO_FORGE, code: 'ci.no_forge' }).text, NO_FORGE);
  });

  it('is the daemon’s own English, marked, without a code core words', () => {
    assert.deepEqual(daemonSaid('ru', { reason: 'Autostart cannot be read: EACCES' }), { text: 'Autostart cannot be read: EACCES', english: true });
    assert.deepEqual(daemonSaid('ru', { code: 'nothing.known', message: 'As written.' }), { text: 'As written.', english: true });
  });

  it('carries the tracker’s own code when one reason says why the tracker cannot be read, and none for several', () => {
    const one = { code: 'tracker.unavailable', message: 'This project declares no tracker.provider.', params: { kind: 'provider' } };
    assert.equal(daemonSaid('ru', trackerUnavailable([one])).text, 'Этот проект не задаёт tracker.provider.');
    assert.equal(daemonSaid('ru', trackerUnavailable([])).text, 'Трекер не читается.');
    assert.equal(daemonSaid('ru', trackerUnavailable([one, one])).english, true);
  });

  it("of a pair's risk are core's wording of its kind and params, as the Overview shows them, and the daemon's own in English", () => {
    const pair = { kind: 'shared' as const, params: { modules: 'nuxt.config.ts' }, reason: 'Both touch nuxt.config.ts.' };
    assert.deepEqual(daemonSaid('ru', pairMessage(pair)), { text: 'Обе затрагивают nuxt.config.ts.', english: false });
    assert.deepEqual(daemonSaid('en', pairMessage(pair)), { text: 'Both touch nuxt.config.ts.', english: false });
  });

});

describe('the Parallel limit on the Settings page', () => {
  it('reads the limit with its mode, and says when it is the default, in both languages', () => {
    const { en, ru } = DICTIONARIES;
    assert.equal(en.parallelNow(en.limitValue('3', 'number'), 'machine'), 'Now 3.');
    assert.equal(en.parallelNow(en.limitValue('2', 'number'), 'default'), 'Now 2, the default.');
    assert.equal(en.parallelNow(en.limitValue('4', 'auto'), 'machine'), 'Now auto, up to 4.');
    assert.equal(ru.parallelNow(ru.limitValue('3', 'number'), 'machine'), 'Сейчас 3.');
    assert.equal(ru.parallelNow(ru.limitValue('2', 'number'), 'default'), 'Сейчас 2, по умолчанию.');
    assert.equal(ru.parallelNow(ru.limitValue('4', 'auto'), 'machine'), 'Сейчас авто, до 4.');
    // An unwritten manifest key reads the limit the snapshot uses, auto included.
    assert.equal(en.limitUsed(en.limitValue('4', 'auto')), 'not written: auto, up to 4 is used');
    for (const dictionary of [en, ru]) assert.match(dictionary.parallelOverride('5'), /5 .*automation\.max_parallel_development_tasks/);
  });
});

describe('the context-pressure thresholds on the Settings page', () => {
  it('read the default, saying when it is Binnacle’s own, and name the setting a manifest overrides them with, in both languages', () => {
    const { en, ru } = DICTIONARIES;
    assert.equal(en.pressureNow('150,000', 'default'), "Default 150,000, Binnacle's own.");
    assert.equal(en.pressureNow('200,000', 'machine'), 'Default 200,000.');
    assert.equal(ru.pressureNow('150 000', 'default'), 'По умолчанию 150 000, встроенное значение Binnacle.');
    assert.equal(ru.pressureNow('200 000', 'machine'), 'По умолчанию 200 000.');
    for (const dictionary of [en, ru]) {
      assert.match(dictionary.pressureOverrides, /telemetry\.context_pressure\.tokens/);
      assert.match(dictionary.pressureRemove('claude-opus-5-5'), /claude-opus-5-5$/);
    }
  });
});

describe('the informer beside the Parallel limit', () => {
  it('counts the runs active at a usage limit, in both languages', () => {
    const { en, ru } = DICTIONARIES;
    assert.equal(plural('en', 1, en.activeThen), '1 run active then');
    assert.equal(plural('en', 3, en.activeThen), '3 runs active then');
    assert.equal(plural('ru', 1, ru.activeThen), 'тогда был активен 1 запуск');
    assert.equal(plural('ru', 3, ru.activeThen), 'тогда были активны 3 запуска');
    assert.equal(plural('ru', 5, ru.activeThen), 'тогда были активны 5 запусков');
    assert.equal(en.notReporting('gemini-cli'), 'Not reporting usage limits: gemini-cli.');
    assert.equal(ru.notReporting('gemini-cli'), 'Не сообщают об исчерпании лимитов: gemini-cli.');
  });
});

describe('the Russian dictionary', () => {
  /** The terms epic 6 kept English in both languages, and the other domain terms a Russian page once showed in English. */
  const ENGLISH = /\b(Tasks?|Epics?|Next action|Suggested step|Backlog|Ready|In progress|Done|Review|Unmet dependency|runs?|roadmap|Product|Harness|Autopilot|Checkpoint|Spec)\b/;

  it('holds none of the terms epic 6 kept English', () => {
    const english = texts(DICTIONARIES.ru).filter((text) => ENGLISH.test(text));
    assert.deepEqual(english, []);
  });

  it('says every Task state, roadmap status and role in Russian, as CONTEXT.md lists them', () => {
    const { ru } = DICTIONARIES;
    for (const state of TASK_STATES) assert.match(ru.states[state] ?? '', /^[а-яё ]+$/, state);
    for (const status of ROADMAP_STATUSES) assert.match(ru.roadmapStatuses[status] ?? '', /^[а-яё ]+$/, status);
    for (const role of ROLES) assert.ok(ru.taskRoles[role] !== undefined, role);
    assert.equal(ru.states.READY_FOR_REVIEW, 'на ревью');
    assert.equal(ru.roadmapStatuses['not started'], 'не начат');
    assert.equal(ru.taskRoles.QA, 'тестировщик');
    assert.equal(ru.ciStates.none, 'нет проверок');
  });
});

describe('the marks of calculation', () => {
  it('are one word beside the value, and an unknown is no data, in both languages', () => {
    const { en, ru } = DICTIONARIES;
    assert.deepEqual([en.estimate, en.fromActivity, en.noData], ['estimate', 'from activity', 'no data']);
    assert.deepEqual([ru.estimate, ru.fromActivity, ru.noData], ['оценка', 'по активности', 'нет данных']);
  });

  it('take the place of the longer provenance notes', () => {
    for (const dictionary of Object.values(DICTIONARIES)) {
      assert.deepEqual(
        texts(dictionary).filter((text) => /Binnacle['’]s (calculation|reading)|(Расчёт|расчёт|Вывод|вывод) Binnacle/.test(text)),
        [],
      );
    }
  });
});
