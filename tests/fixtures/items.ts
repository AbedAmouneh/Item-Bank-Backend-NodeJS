/** Generic entity fixture (replace with your domain types) */
export interface FixtureItem {
  code: string;
  name: string;
  category_id: string;
}

export function fixtureItems(): FixtureItem[] {
  return [
    {
      code: 'fx-10001',
      name: 'Fixture Item A',
      category_id: '9001',
    },
    {
      code: 'fx-10002',
      name: 'Fixture Item B',
      category_id: '9001',
    },
  ];
}
