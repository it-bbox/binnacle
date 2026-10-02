// Preloaded with `node --import` so that a test can run `binn init` with stdin reading as a terminal:
// a pseudo-terminal would need a native module. Only `isTTY` is claimed; the input is still the test's pipe.
Object.defineProperty(process.stdin, 'isTTY', { value: true });
