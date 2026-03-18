export function parseFixtureName(argv: string[]): string {
  const fixtureFlag = argv.find(arg => arg.startsWith('--fixture='));
  if (fixtureFlag) {
    return fixtureFlag.split('=')[1] || 'baseline';
  }

  const fixtureIndex = argv.indexOf('--fixture');
  if (fixtureIndex !== -1) {
    return argv[fixtureIndex + 1] || 'baseline';
  }

  return 'baseline';
}
