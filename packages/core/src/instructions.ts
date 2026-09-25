/**
 * Agent instruction files as the sets an agent actually reads: a file that imports another,
 * as a `CLAUDE.md` holding `@AGENTS.md` does, is one set with it, not two. `files` maps each
 * file present, by its name at the repository root, to its text. Each set lists the
 * importing file first. Pure, so that `binn init` and epic 6's audit read the same way.
 * ponytail: imports are followed one level deep, which is all two root files can have; a
 * chain across more files would need a transitive closure.
 */
export function instructionSets(files: Record<string, string>): string[][] {
  const names = Object.keys(files);
  const imports = (from: string, to: string): boolean => from !== to && importsFile(files[from]!, to);
  const importedByAnother = (name: string): boolean => names.some((other) => imports(other, name));

  const placed = new Set<string>();
  const sets: string[][] = [];
  // Importers first, so that each imported file joins its importer's set.
  for (const name of [...names.filter((name) => !importedByAnother(name)), ...names]) {
    if (placed.has(name)) continue;
    const set = [name, ...names.filter((other) => !placed.has(other) && imports(name, other))];
    for (const member of set) placed.add(member);
    sets.push(set);
  }
  return sets;
}

/** Claude Code's import syntax, `@name` or `@./name`, outside code blocks and inline code, where it is not an import. */
function importsFile(text: string, name: string): boolean {
  const prose = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)@(?:\\./)?${escaped}(?=\\s|$)`, 'm').test(prose);
}
