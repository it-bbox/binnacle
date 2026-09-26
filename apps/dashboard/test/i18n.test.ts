import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compactNumber, plural, secondsAgo, startingLanguage } from '../app/i18n/index.ts';

/**
 * The dashboard's own dictionary (ADR-0033): which language the page starts in, and how a
 * count and a relative time read in it. The pages themselves are not automated (the spec's
 * *Testing Decisions*); a missing Russian key fails the typecheck.
 */

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

describe('a compact number', () => {
  it('reads short under a bar, in the language', () => {
    assert.equal(compactNumber('en', 5_306_279), '5.3M');
    assert.equal(compactNumber('ru', 5_306_279), '5,3\u00a0млн');
    assert.equal(compactNumber('en', 12_466), '12.5K');
    assert.equal(compactNumber('en', 950), '950');
  });
});
