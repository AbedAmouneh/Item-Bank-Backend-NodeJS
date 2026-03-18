export interface FixtureUser {
  email: string;
  role: string;
}

export function fixtureUsers(): FixtureUser[] {
  return [
    {
      email: 'fixture_admin@test.local',
      role: 'admin',
    },
    {
      email: 'fixture_user@test.local',
      role: 'user',
    },
  ];
}
