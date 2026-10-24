/**
 * Text bound for a terminal, with every character that could rewrite the screen or reorder a line shown as its
 * `\u{…}` escape (spec `hygiene-after-v1`, *One sanitizer in core*): the C0 controls but tab and newline, DEL, the C1
 * controls, and the bidi controls U+061C, U+200E–U+200F, U+202A–U+202E and U+2066–U+2069. Escaped, never dropped, so
 * that a person sees their file holds one. JSON output does not use it: a script reads a value as it is.
 */
const UNSAFE = /[\0-\x08\x0b-\x1f\x7f-\x9f؜‎‏‪-‮⁦-⁩]/g;

export const terminalText = (text: string): string => text.replace(UNSAFE, (character) => `\\u{${character.codePointAt(0)!.toString(16)}}`);
