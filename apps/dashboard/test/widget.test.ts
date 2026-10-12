import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFolded, readLevel, storeFolded, storeLevel } from '../app/widget.ts';

/**
 * A widget's level, *Brief* or *Full* (`docs/specs/dashboard-redesign/spec.md`, *A widget with
 * two levels*): kept in the browser's storage per page and widget, *Brief* when nothing is
 * stored or the storage refuses. The storage is passed in, as the page passes `localStorage`.
 */

/** A storage that keeps what it is given, as `localStorage` does across a reload. */
function memory(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

const refusing = (): Storage => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

describe("a widget's level", () => {
  it('is Brief when nothing is stored', () => {
    const storage = memory();
    assert.equal(readLevel('overview', 'ready', () => storage), 'brief');
  });

  it('survives a reload, per page and widget', () => {
    const storage = memory();
    storeLevel('overview', 'ready', 'full', () => storage);
    assert.equal(readLevel('overview', 'ready', () => storage), 'full');
    assert.equal(readLevel('overview', 'running', () => storage), 'brief', 'another widget keeps its own');
    assert.equal(readLevel('attention', 'ready', () => storage), 'brief', 'another page keeps its own');
    storeLevel('overview', 'ready', 'brief', () => storage);
    assert.equal(readLevel('overview', 'ready', () => storage), 'brief');
  });

  it('is Brief when the stored value names no level', () => {
    const storage = memory();
    storeLevel('overview', 'ready', 'full', () => storage);
    storage.setItem(storage.key(0)!, 'everything');
    assert.equal(readLevel('overview', 'ready', () => storage), 'brief');
  });

  it('is Brief when the storage throws, and choosing one does not throw', () => {
    assert.equal(readLevel('overview', 'ready', refusing), 'brief');
    const throwing = { ...memory(), getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } } as Storage;
    assert.equal(readLevel('overview', 'ready', () => throwing), 'brief');
    assert.doesNotThrow(() => storeLevel('overview', 'ready', 'full', refusing));
    assert.doesNotThrow(() => storeLevel('overview', 'ready', 'full', () => throwing));
  });
});

describe("the Project page's epics column, folded or not", () => {
  it('is unfolded when nothing is stored or the storage refuses', () => {
    assert.equal(readFolded('project', 'epics', () => memory()), false);
    assert.equal(readFolded('project', 'epics', refusing), false);
    assert.doesNotThrow(() => storeFolded('project', 'epics', true, refusing));
  });

  it('survives a reload, apart from the widget level', () => {
    const storage = memory();
    storeFolded('project', 'epics', true, () => storage);
    assert.equal(readFolded('project', 'epics', () => storage), true);
    assert.equal(readLevel('project', 'epics', () => storage), 'brief', 'folding leaves the level alone');
    storeFolded('project', 'epics', false, () => storage);
    assert.equal(readFolded('project', 'epics', () => storage), false);
  });
});
