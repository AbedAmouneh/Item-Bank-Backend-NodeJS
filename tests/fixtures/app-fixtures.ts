/** Generic app fixture data (replace with your domain types) */
export interface FixtureAppCore {
  categoryId: number;
  itemIds: number[];
}

export function fixtureAppCore(): FixtureAppCore {
  return {
    categoryId: 9001,
    itemIds: [91001, 91002],
  };
}
