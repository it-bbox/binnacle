#!/usr/bin/env node
import { resolveHome, resolvePort } from './home.ts';
import { DaemonAlreadyRunningError, startDaemon } from './server.ts';

try {
  const daemon = await startDaemon({ home: resolveHome(), port: resolvePort() });
  const { host, port, pid, version } = daemon.runtime;
  console.log(`binnd listening on http://${host}:${port} (pid ${pid}, version ${version})`);

  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    daemon.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error);
        process.exit(1);
      },
    );
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error(error instanceof DaemonAlreadyRunningError ? error.message : error);
  process.exit(1);
}
