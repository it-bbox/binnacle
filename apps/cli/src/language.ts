import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGES, personLanguage, type Language } from '@binnacle/core';

/** The person's language for this run, read once, by the locale rule `@binnacle/core` keeps for `binn` and the mod. */
export const LANGUAGE = personLanguage(process.env);

/** An answer to the language question, or `--language`'s value: `en` or `ru` in any case; null for anything else. */
export function parseLanguage(text: string): Language | null {
  const language = text.trim().toLowerCase();
  return (LANGUAGES as string[]).includes(language) ? (language as Language) : null;
}

/**
 * The repository language `binn init` proposes (ADR-0045): the root `README.md`'s, Russian when
 * Cyrillic letters outnumber Latin ones outside code blocks and inline code, English otherwise;
 * with no README, the person's. Only a proposal, which the person confirms, so letters are counted
 * rather than a language detected.
 */
export function proposeLanguage(root: string): { language: Language; source: 'readme' | 'locale' } {
  let readme: string;
  try {
    readme = readFileSync(join(root, 'README.md'), 'utf8');
  } catch {
    return { language: LANGUAGE, source: 'locale' };
  }
  const prose = readme
    // A fenced block, to its closing fence, which carries no info string, or to the end of the file.
    .replace(/^ {0,3}(`{3,}|~{3,})[^]*?(^ {0,3}\1[`~]*[ \t]*$|(?![^]))/gm, '')
    .replace(/`[^`\n]*`/g, '');
  const count = (letters: RegExp): number => prose.match(letters)?.length ?? 0;
  return { language: count(/\p{Script=Cyrillic}/gu) > count(/\p{Script=Latin}/gu) ? 'ru' : 'en', source: 'readme' };
}
