export interface MigrationFile {
  fileName: string;
  version: string;
  sql: string;
}

export function extractCreatedTables(sql: string): string[] {
  const tables = new Set<string>();
  const regex =
    /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let match: RegExpExecArray | null;

  match = regex.exec(sql);
  while (match) {
    if (match[1]) {
      tables.add(match[1].toLowerCase());
    }
    match = regex.exec(sql);
  }

  return [...tables];
}

export function extractDependencies(sql: string): string[] {
  const dependencies = new Set<string>();
  const regex =
    /\b(?:REFERENCES|FROM|JOIN)\s+(?:ONLY\s+)?(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let match: RegExpExecArray | null;

  match = regex.exec(sql);
  while (match) {
    if (match[1]) {
      dependencies.add(match[1].toLowerCase());
    }
    match = regex.exec(sql);
  }

  return [...dependencies];
}

export function orderMigrationFiles(files: MigrationFile[]): MigrationFile[] {
  const filesByName = new Map<string, MigrationFile>();
  const tableToFile = new Map<string, string>();

  for (const file of files) {
    filesByName.set(file.fileName, file);
    const createdTables = extractCreatedTables(file.sql);
    for (const table of createdTables) {
      if (!tableToFile.has(table)) {
        tableToFile.set(table, file.fileName);
      }
    }
  }

  const dependencies = new Map<string, Set<string>>();

  for (const file of files) {
    dependencies.set(file.fileName, new Set());
  }

  for (const file of files) {
    const referencedTables = extractDependencies(file.sql);

    for (const table of referencedTables) {
      const sourceFile = tableToFile.get(table);
      if (sourceFile && sourceFile !== file.fileName) {
        dependencies.get(file.fileName)?.add(sourceFile);
      }
    }
  }

  if (dependencies.has('triggers.sql')) {
    const triggerDeps = dependencies.get('triggers.sql');
    for (const file of files) {
      if (file.fileName !== 'triggers.sql') {
        triggerDeps?.add(file.fileName);
      }
    }
  }

  const remaining = new Set(files.map(file => file.fileName));
  const ordered: MigrationFile[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter(fileName => {
        const fileDeps = dependencies.get(fileName) || new Set();
        return [...fileDeps].every(dep => !remaining.has(dep));
      })
      .sort((a, b) => a.localeCompare(b));

    if (ready.length === 0) {
      const unresolved = [...remaining].sort((a, b) => a.localeCompare(b));
      throw new Error(
        `Unable to resolve migration order due to cyclic or unresolved dependencies: ${unresolved.join(', ')}`
      );
    }

    for (const fileName of ready) {
      remaining.delete(fileName);
      const file = filesByName.get(fileName);
      if (file) {
        ordered.push(file);
      }
    }
  }

  return ordered;
}
