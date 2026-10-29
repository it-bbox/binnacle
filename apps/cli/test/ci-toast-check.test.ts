import assert from 'node:assert/strict';
import { test } from 'node:test';

/** Claude-code-mod/07, criterion 5: fails on purpose, so that CI on `main` turns red for the mod's toast; reverted next. */
test('fails on purpose for the CI toast check', () => {
  assert.fail('deliberately red: claude-code-mod/07, criterion 5');
});
