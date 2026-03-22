import 'dotenv/config';

import { Pool, PoolClient } from 'pg';

import { config } from '../utils/config';

// ------------------------------------------------------------
// Content shapes used by the three game types:
//
//   Quiz Arcade   – multiple_choice, true_false
//   Memory Match  – multiple_choice, matching
//   Answer Runner – multiple_choice, true_false
//
// multiple_choice content:
//   { choices: [{ id, text }], correct_answer: string }
//
// true_false content:
//   { correct_answer: boolean }
//
// matching content:
//   { pairs: [{ left, right }] }
// ------------------------------------------------------------

interface MultipleChoiceContent {
  choices: { id: string; text: string }[];
  correct_answer: string;
}

interface TrueFalseContent {
  correct_answer: boolean;
}

interface MatchingContent {
  pairs: { left: string; right: string }[];
}

interface QuestionRow {
  type: string;
  name: string;
  text: string;
  mark: number;
  content: MultipleChoiceContent | TrueFalseContent | MatchingContent;
}

const MULTIPLE_CHOICE_QUESTIONS: QuestionRow[] = [
  {
    type: 'multiple_choice',
    name: 'Capital of France',
    text: 'What is the capital city of France?',
    mark: 1,
    content: {
      choices: [
        { id: 'a', text: 'Berlin' },
        { id: 'b', text: 'Madrid' },
        { id: 'c', text: 'Paris' },
        { id: 'd', text: 'Rome' },
      ],
      correct_answer: 'c',
    },
  },
  {
    type: 'multiple_choice',
    name: 'Largest planet in the solar system',
    text: 'Which planet is the largest in our solar system?',
    mark: 1,
    content: {
      choices: [
        { id: 'a', text: 'Earth' },
        { id: 'b', text: 'Saturn' },
        { id: 'c', text: 'Neptune' },
        { id: 'd', text: 'Jupiter' },
      ],
      correct_answer: 'd',
    },
  },
  {
    type: 'multiple_choice',
    name: 'Chemical symbol for water',
    text: 'What is the chemical symbol for water?',
    mark: 1,
    content: {
      choices: [
        { id: 'a', text: 'O2' },
        { id: 'b', text: 'H2O' },
        { id: 'c', text: 'CO2' },
        { id: 'd', text: 'NaCl' },
      ],
      correct_answer: 'b',
    },
  },
  {
    type: 'multiple_choice',
    name: 'Author of Romeo and Juliet',
    text: 'Who wrote Romeo and Juliet?',
    mark: 1,
    content: {
      choices: [
        { id: 'a', text: 'Charles Dickens' },
        { id: 'b', text: 'Jane Austen' },
        { id: 'c', text: 'William Shakespeare' },
        { id: 'd', text: 'Mark Twain' },
      ],
      correct_answer: 'c',
    },
  },
  {
    type: 'multiple_choice',
    name: 'Number of continents',
    text: 'How many continents are there on Earth?',
    mark: 1,
    content: {
      choices: [
        { id: 'a', text: '5' },
        { id: 'b', text: '6' },
        { id: 'c', text: '7' },
        { id: 'd', text: '8' },
      ],
      correct_answer: 'c',
    },
  },
  {
    type: 'multiple_choice',
    name: 'Speed of light',
    text: 'What is the approximate speed of light in a vacuum?',
    mark: 2,
    content: {
      choices: [
        { id: 'a', text: '150,000 km/s' },
        { id: 'b', text: '300,000 km/s' },
        { id: 'c', text: '450,000 km/s' },
        { id: 'd', text: '600,000 km/s' },
      ],
      correct_answer: 'b',
    },
  },
];

const TRUE_FALSE_QUESTIONS: QuestionRow[] = [
  {
    type: 'true_false',
    name: 'The sun is a star',
    text: 'The sun is a star.',
    mark: 1,
    content: { correct_answer: true },
  },
  {
    type: 'true_false',
    name: 'Penguins live in the Arctic',
    text: 'Penguins naturally live in the Arctic.',
    mark: 1,
    content: { correct_answer: false },
  },
  {
    type: 'true_false',
    name: 'Humans have 206 bones',
    text: 'An adult human body has 206 bones.',
    mark: 1,
    content: { correct_answer: true },
  },
  {
    type: 'true_false',
    name: 'Sound travels faster than light',
    text: 'Sound travels faster than light.',
    mark: 1,
    content: { correct_answer: false },
  },
];

const MATCHING_QUESTIONS: QuestionRow[] = [
  {
    type: 'matching',
    name: 'Match countries to capitals',
    text: 'Match each country to its capital city.',
    mark: 2,
    content: {
      pairs: [
        { left: 'Japan', right: 'Tokyo' },
        { left: 'Australia', right: 'Canberra' },
        { left: 'Brazil', right: 'Brasília' },
        { left: 'Canada', right: 'Ottawa' },
      ],
    },
  },
  {
    type: 'matching',
    name: 'Match elements to symbols',
    text: 'Match each element to its chemical symbol.',
    mark: 2,
    content: {
      pairs: [
        { left: 'Gold', right: 'Au' },
        { left: 'Iron', right: 'Fe' },
        { left: 'Silver', right: 'Ag' },
        { left: 'Lead', right: 'Pb' },
      ],
    },
  },
  {
    type: 'matching',
    name: 'Match inventors to inventions',
    text: 'Match each inventor to their invention.',
    mark: 2,
    content: {
      pairs: [
        { left: 'Alexander Graham Bell', right: 'Telephone' },
        { left: 'Thomas Edison', right: 'Light bulb' },
        { left: 'Nikola Tesla', right: 'AC motor' },
        { left: 'Wright Brothers', right: 'Airplane' },
      ],
    },
  },
  {
    type: 'matching',
    name: 'Match planets to their position from the sun',
    text: 'Match each planet to its order from the sun.',
    mark: 2,
    content: {
      pairs: [
        { left: 'Mercury', right: '1st' },
        { left: 'Venus', right: '2nd' },
        { left: 'Earth', right: '3rd' },
        { left: 'Mars', right: '4th' },
      ],
    },
  },
];

const ALL_QUESTIONS = [
  ...MULTIPLE_CHOICE_QUESTIONS,
  ...TRUE_FALSE_QUESTIONS,
  ...MATCHING_QUESTIONS,
];

async function getOrCreateSeedUser(client: PoolClient): Promise<number> {
  // Prefer an existing user so we don't pollute the dev database unnecessarily
  const existing = await client.query<{ id: number }>(
    `SELECT id FROM users LIMIT 1`
  );

  const existingUser = existing.rows[0];
  if (existingUser !== undefined) {
    return existingUser.id;
  }

  // No users exist yet — insert a minimal seed user
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO users (email, role, is_active)
     VALUES ('seed@example.com', 'admin', true)
     RETURNING id`
  );
  const insertedUser = inserted.rows[0];
  if (insertedUser === undefined) {
    throw new Error('Failed to insert seed user');
  }
  return insertedUser.id;
}

async function main(): Promise<void> {
  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  });

  const client = await pool.connect();

  try {
    const ownerId = await getOrCreateSeedUser(client);

    await client.query('BEGIN');

    let insertedCount = 0;

    for (const q of ALL_QUESTIONS) {
      await client.query(
        `INSERT INTO questions
           (owner_id, item_bank_id, type, name, text, mark, status, content)
         VALUES ($1, NULL, $2, $3, $4, $5, 'published', $6)`,
        [ownerId, q.type, q.name, q.text, q.mark, JSON.stringify(q.content)]
      );
      insertedCount++;
    }

    await client.query('COMMIT');

    console.log(`Seeded ${insertedCount} questions successfully.`);
    console.log(
      `  ${MULTIPLE_CHOICE_QUESTIONS.length} multiple_choice  (Quiz Arcade, Memory Match, Answer Runner)`
    );
    console.log(
      `  ${TRUE_FALSE_QUESTIONS.length} true_false         (Quiz Arcade, Answer Runner)`
    );
    console.log(
      `  ${MATCHING_QUESTIONS.length} matching            (Memory Match)`
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Seed failed:', error);
  process.exit(1);
});
