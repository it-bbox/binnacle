import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * Binnacle's dev container feature (dev-container spec, *The dev container feature*): its files agree with each other
 * and with the daemon's variables, so that a renamed option or variable fails here. `devcontainer.live.ts` builds it.
 */

const FEATURE = new URL('../../devcontainer-feature/src/binnacle/', import.meta.url);

interface Feature {
  id: string;
  version: string;
  options: Record<string, { type: string; default: string }>;
  containerEnv: Record<string, string>;
  mounts: { source: string; target: string; type: string }[];
  postStartCommand: string;
  installsAfter: string[];
}

const feature = JSON.parse(readFileSync(new URL('devcontainer-feature.json', FEATURE), 'utf8')) as Feature;
const install = readFileSync(new URL('install.sh', FEATURE), 'utf8');

test('the feature is binnacle, with its version and hostPort options and their defaults, after the Node feature', () => {
  assert.equal(feature.id, 'binnacle');
  assert.match(feature.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(Object.keys(feature.options).sort(), ['hostPort', 'version']);
  assert.deepEqual([feature.options.version?.type, feature.options.version?.default], ['string', 'latest']);
  assert.deepEqual([feature.options.hostPort?.type, feature.options.hostPort?.default], ['string', '7717']);
  assert.deepEqual(feature.installsAfter, ['ghcr.io/devcontainers/features/node']);
});

test("the daemon binds every interface, with its home on a volume of the container's own", () => {
  assert.equal(feature.containerEnv.BINNACLE_HOST, '0.0.0.0');
  assert.equal(feature.mounts.length, 1);
  const [mount] = feature.mounts;
  assert.equal(mount?.type, 'volume');
  assert.match(mount?.source ?? '', /\$\{devcontainerId\}/);
  assert.equal(feature.containerEnv.BINNACLE_HOME, mount?.target);
  // install.sh hands that directory to the container's user, so the volume starts out theirs.
  assert.ok(install.includes(`HOME_DIR=${mount?.target}\n`), 'install.sh prepares the mount target');
  // The feature publishes no port and mounts no harness home: the developer's devcontainer.json does both.
  assert.doesNotMatch(JSON.stringify(feature), /appPort|forwardPorts|\.claude/);
});

test('postStartCommand runs the start command install.sh writes, which starts the daemon with the allowed hosts', () => {
  const start = install.match(/^START=(\S+)$/m)?.[1];
  assert.ok(start, 'install.sh names its start command');
  assert.equal(feature.postStartCommand, start);
  assert.match(install, /^binn daemon start$/m);
  assert.match(install, /^export BINNACLE_ALLOWED_HOSTS=127\.0\.0\.1:\$HOSTPORT,localhost:\$HOSTPORT$/m);
});

test('install.sh reads both options, checks for Node 24 and installs @it-bbox/binnacle', () => {
  assert.match(install, /^#!\/bin\/sh\n/);
  assert.match(install, /\$\{VERSION:-latest\}/);
  assert.match(install, /\$\{HOSTPORT:-7717\}/);
  assert.match(install, /-lt 24/);
  assert.match(install, /^npm install -g "@it-bbox\/binnacle@\$VERSION"$/m);
});
