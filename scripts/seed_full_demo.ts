/**
 * seed_full_demo.ts
 *
 * Run from the project root:
 *   npx ts-node scripts/seed_full_demo.ts
 *
 * What this script does
 * ─────────────────────
 *  1. Applies the two pending migrations (assessments + assignments tables).
 *  2. Creates 7 item banks — one per course.
 *  3. Inserts 21 questions into each bank  (147 total).
 *  4. Creates 7 courses (3 Sarah, 3 James, 1 shared owned by OrgAdmin).
 *  5. Adds 3 activities per course  (mid-unit quiz, final exam, practice test).
 *  6. Enrols the correct learners:
 *       Sarah's courses  → Alice (12) + Bob (13)
 *       James's courses  → Charlie (14) + Bob (13)
 *       Shared course    → Alice (12) + Bob (13) + Charlie (14)
 *  7. Creates 1 Quiz, 1 Exam, and 1 Practice Test (assessment rows) per course.
 *  8. Links questions to each assessment via assessment_question_pool.
 *  9. Creates 1 written assignment per course.
 */

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ─── connection ────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString:
    process.env['DATABASE_URL'] ||
    'postgres://item_bank:item_bank_password@localhost:5432/item_bank',
});

// ─── constants ─────────────────────────────────────────────────────────────────
const TENANT_ID   = 1;
const SARAH_ID    = 10;
const JAMES_ID    = 11;
const ALICE_ID    = 12;
const BOB_ID      = 13;
const CHARLIE_ID  = 14;
const ORGADMIN_ID = 9;

// ─── helpers ───────────────────────────────────────────────────────────────────
function mc(
  question: string,
  a: string, b: string, c: string, d: string,
  correct: 'a' | 'b' | 'c' | 'd'
) {
  return {
    question,
    choices: [
      { id: 'a', text: a, isCorrect: correct === 'a' },
      { id: 'b', text: b, isCorrect: correct === 'b' },
      { id: 'c', text: c, isCorrect: correct === 'c' },
      { id: 'd', text: d, isCorrect: correct === 'd' },
    ],
  };
}
function tf(question: string, answer: boolean) {
  return { question, answer };
}
function sa(question: string, sampleAnswer: string) {
  return { question, sampleAnswer };
}
function essay(question: string, rubric: string) {
  return { question, rubric };
}

type QDef = {
  name: string;
  type: string;
  mark: number;
  difficulty: 'easy' | 'medium' | 'hard';
  content: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1.  SARAH — CREATIVE WRITING  (21 questions)
// ─────────────────────────────────────────────────────────────────────────────
const creativeWritingQs: QDef[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { name: 'First-person POV definition', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('Which pronoun is the clearest sign that a story is written in first person?',
      'He / She', 'They', 'I / We', 'You', 'c') },
  { name: 'Setting definition TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('A story\'s setting includes both the time period and the physical place where events happen.', true) },
  { name: 'Plot conflict identification', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('The central struggle that drives a story forward is called the:',
      'Theme', 'Conflict', 'Climax', 'Resolution', 'b') },
  { name: 'Narrative definition', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('A narrative is best described as:',
      'A list of facts', 'A poem with rhyme', 'A story with a sequence of events', 'A dictionary entry', 'c') },
  { name: 'Happy ending TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('All stories must have a happy ending to be considered complete.', false) },
  { name: 'Descriptive language purpose', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('Descriptive language primarily helps a reader:',
      'Finish reading faster', 'Visualise and feel the story world', 'Understand grammar rules', 'Count the characters', 'b') },
  { name: 'Story elements basic', type: 'short_answer', mark: 2, difficulty: 'easy',
    content: sa('Name three elements that are commonly found in most stories.',
      'Acceptable answers include: character, setting, plot, conflict, theme, climax, resolution, narrator.') },
  // ── Medium ────────────────────────────────────────────────────────────────
  { name: 'Rising action definition', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('In a story arc, what does "rising action" refer to?',
      'The very beginning of the story', 'Events building tension toward the climax',
      'The moment the conflict is resolved', 'The moral lesson at the end', 'b') },
  { name: 'Internal vs external conflict', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('Internal conflict is a struggle that takes place entirely within one character\'s mind or heart.', true) },
  { name: 'Show dont tell MC', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Which sentence best demonstrates "show, don\'t tell"?',
      'She was nervous.', 'Her hands trembled as she reached for the doorknob.',
      'The story says she felt anxious.', 'Nervousness is a common feeling.', 'b') },
  { name: 'Flashback definition', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('A flashback is a writing technique that:',
      'Jumps the story forward in time', 'Interrupts the present to revisit a past event',
      'Summarises the ending early', 'Describes the setting in detail', 'b') },
  { name: 'Protagonist vs antagonist', type: 'short_answer', mark: 2, difficulty: 'medium',
    content: sa('What is the difference between a protagonist and an antagonist?',
      'The protagonist is the main character the audience follows, usually trying to achieve a goal. The antagonist opposes the protagonist and creates conflict.') },
  { name: 'Purpose of dialogue', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Dialogue in a story primarily serves to:',
      'Fill pages with text', 'Reveal character personality and advance the plot',
      'Replace descriptions of setting', 'List events in order', 'b') },
  { name: 'Pacing definition TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('Pacing refers to the speed at which a story\'s events unfold for the reader.', true) },
  // ── Hard ──────────────────────────────────────────────────────────────────
  { name: 'Unreliable narrator', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('An unreliable narrator is one who:',
      'Always tells the truth in perfect detail', 'Cannot be fully trusted due to bias, limited knowledge, or deception',
      'Narrates from a third-person omniscient view', 'Speaks only in dialogue', 'b') },
  { name: 'Show dont tell essay', type: 'essay', mark: 4, difficulty: 'hard',
    content: essay(
      'Write a short paragraph (5–8 sentences) using "show, don\'t tell" to portray a character who is nervous before a performance.',
      'Rubric: Award up to 2 marks for sensory details showing physical nervousness (shaking, sweating, etc.), 1 mark for avoiding the word "nervous", 1 mark for clear scene and character.'
    ) },
  { name: 'Stream of consciousness', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Stream of consciousness writing is best described as:',
      'A bullet-pointed list of a character\'s actions', 'A continuous flow of a character\'s thoughts without clear structure or punctuation',
      'A third-person narrative with no dialogue', 'A chronological retelling of events', 'b') },
  { name: 'Dramatic irony TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('Dramatic irony occurs when the reader knows something important that one or more characters do not.', true) },
  { name: 'Narrative distance', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Narrative distance refers to:',
      'The physical distance between characters', 'How closely the narration is tied to a character\'s thoughts and feelings',
      'The length of a story', 'The gap between chapters', 'b') },
  { name: 'Metafiction definition', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Metafiction is a type of writing that:',
      'Only deals with facts and real events', 'Self-consciously draws attention to the fact that it is a fictional work',
      'Is always written in second person', 'Must be set in the future', 'b') },
  { name: 'Symbolism vs allegory', type: 'short_answer', mark: 3, difficulty: 'hard',
    content: sa(
      'Explain the difference between symbolism and allegory in narrative writing.',
      'Symbolism uses a specific object, character, or event to represent a broader concept (e.g., a dove symbolising peace). Allegory is a sustained narrative where the entire story works as an extended metaphor for real-world events or moral lessons (e.g., Animal Farm as an allegory for the Russian Revolution).'
    ) },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2.  SARAH — ENGLISH LITERATURE  (21 questions)
// ─────────────────────────────────────────────────────────────────────────────
const englishLiteratureQs: QDef[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { name: 'Theme definition MC', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('The theme of a literary work is best described as:',
      'The name of the main character', 'The central message or underlying idea the author wants to convey',
      'The place where the story is set', 'The first sentence of the story', 'b') },
  { name: 'Plot sequence TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('In a story\'s plot, the climax always comes before the rising action.', false) },
  { name: 'Protagonist definition', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('What term describes the main character of a story?',
      'Antagonist', 'Narrator', 'Protagonist', 'Foil', 'c') },
  { name: 'Genre identification', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('A story featuring dragons, magic, and invented worlds most likely belongs to which genre?',
      'Biography', 'Fantasy', 'Mystery', 'Historical fiction', 'b') },
  { name: 'Main idea vs theme TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('The main idea of a passage is always the same as its theme.', false) },
  { name: 'Vocabulary in context', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('When a reader uses context clues to determine word meaning, they look at:',
      'The dictionary first', 'The surrounding sentences and paragraph', 'The title only', 'The author\'s name', 'b') },
  { name: 'Authors purpose basic', type: 'short_answer', mark: 2, difficulty: 'easy',
    content: sa('List the three main purposes an author might have when writing a text.',
      'To inform (explain or teach), to persuade (convince the reader of something), and to entertain (engage and delight the reader).') },
  // ── Medium ────────────────────────────────────────────────────────────────
  { name: 'Comparing characters', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('A foil character is used in literature mainly to:',
      'Introduce a new setting', 'Highlight qualities of another character through contrast',
      'Provide comic relief only', 'Replace the protagonist mid-story', 'b') },
  { name: 'Simile vs metaphor', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Which sentence contains a simile?',
      'The classroom was a zoo.', 'Her laughter was music to his ears.',
      'He ran like the wind.', 'The stars danced above.', 'c') },
  { name: 'Inference definition TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('Making an inference means drawing a conclusion based on evidence from the text combined with your own knowledge.', true) },
  { name: 'Point of view effect', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('How does third-person limited point of view differ from third-person omniscient?',
      'Limited follows only one character\'s thoughts; omniscient knows all characters\' thoughts',
      'Limited uses "I"; omniscient uses "he/she"',
      'Limited is only for short stories; omniscient is for novels',
      'There is no difference', 'a') },
  { name: 'Text evidence short answer', type: 'short_answer', mark: 2, difficulty: 'medium',
    content: sa('Why is it important to support literary analysis claims with direct evidence from the text?',
      'Evidence grounds the analysis in what the author actually wrote rather than personal opinion, making the argument credible and verifiable.') },
  { name: 'Cause and effect', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('When an author shows a cause and its effect in a narrative, the purpose is usually to:',
      'List characters alphabetically', 'Show how events are connected and why things happen',
      'Provide dictionary definitions', 'Break the story into chapters', 'b') },
  { name: 'Authors craft TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('An author\'s use of vivid sensory details is part of their craft, intended to immerse the reader in the scene.', true) },
  // ── Hard ──────────────────────────────────────────────────────────────────
  { name: 'Literary criticism definition', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('A feminist literary criticism approach would primarily examine:',
      'The historical accuracy of the setting', 'Gender roles and the representation of women in the text',
      'The economic background of the author', 'The rhyme scheme of the poem', 'b') },
  { name: 'Extended symbolism', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('In literature, an extended symbol that runs throughout the entire text is called:',
      'A metaphor', 'A motif', 'Personification', 'Hyperbole', 'b') },
  { name: 'Satire purpose', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('The primary purpose of satire in literature is to:',
      'Retell historical events accurately', 'Critique society or human behaviour through irony and humour',
      'Teach the reader vocabulary', 'Describe nature in beautiful language', 'b') },
  { name: 'Allegory TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('In an allegory, characters and events systematically represent abstract ideas or real-world situations beyond the literal narrative.', true) },
  { name: 'Intertextuality', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Intertextuality refers to:',
      'The way a text references or relates to other texts', 'The author\'s use of the internet as a research tool',
      'The number of chapters in a novel', 'Writing dialogue between two texts', 'a') },
  { name: 'Textual ambiguity', type: 'short_answer', mark: 2, difficulty: 'hard',
    content: sa('What is textual ambiguity, and why might an author deliberately use it?',
      'Textual ambiguity occurs when a word, phrase, or passage can be interpreted in more than one valid way. Authors use it deliberately to encourage multiple readings, create mystery, or allow readers to bring their own meaning to the text.') },
  { name: 'Evaluating author argument essay', type: 'essay', mark: 4, difficulty: 'hard',
    content: essay(
      'Choose a theme from a text you have studied and explain how the author uses at least two literary devices to develop that theme. Use specific examples from the text.',
      'Rubric: 2 marks for identifying theme clearly; 1 mark per literary device (max 2) with specific textual evidence; deduct 1 mark if no textual evidence is provided.'
    ) },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3.  SARAH — GRAMMAR & LANGUAGE ARTS  (21 questions)
// ─────────────────────────────────────────────────────────────────────────────
const grammarQs: QDef[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { name: 'Noun definition', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('Which word in the sentence "The dog barked loudly" is a noun?',
      'The', 'barked', 'dog', 'loudly', 'c') },
  { name: 'Verb definition TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('A verb always describes an action or a state of being.', true) },
  { name: 'End punctuation', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('Which punctuation mark correctly ends a question?',
      'Period (.)', 'Exclamation mark (!)', 'Question mark (?)', 'Comma (,)', 'c') },
  { name: 'Common vs proper noun', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('Which of the following is a proper noun?',
      'city', 'dog', 'London', 'river', 'c') },
  { name: 'Regular verb past tense', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('What is the past tense of the regular verb "walk"?',
      'Walking', 'Walked', 'Walks', 'Will walk', 'b') },
  { name: 'Spelling rule TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('The rule "i before e except after c" applies to words like "believe" and "receive".', true) },
  { name: 'Subject-verb agreement', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('Which sentence shows correct subject-verb agreement?',
      'The cats runs fast.', 'The cat run fast.', 'The cat runs fast.', 'The cats run fastly.', 'c') },
  // ── Medium ────────────────────────────────────────────────────────────────
  { name: 'Compound sentence', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Which of the following is a compound sentence?',
      'She sang a song.', 'Although she was tired, she kept going.',
      'She sang and he danced.', 'Running through the park.', 'c') },
  { name: 'Subordinate clause TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('A subordinate clause cannot stand alone as a complete sentence.', true) },
  { name: 'Present perfect tense', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Which sentence uses the present perfect tense?',
      'I eat breakfast every day.', 'I was eating breakfast.',
      'I have eaten breakfast.', 'I will eat breakfast.', 'c') },
  { name: 'Pronoun reference', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('"Maria told Sofia that she had passed." What is the problem with this sentence?',
      'It has no verb', 'The pronoun "she" is ambiguous — it could refer to either Maria or Sofia',
      'There are too many nouns', 'The tense is wrong', 'b') },
  { name: 'Dangling modifier short answer', type: 'short_answer', mark: 2, difficulty: 'medium',
    content: sa('Identify and correct the dangling modifier in: "Running to catch the bus, the rain started."',
      'The modifier "Running to catch the bus" dangles because the rain cannot run. Correction: "Running to catch the bus, I was caught in the rain."') },
  { name: 'Oxford comma TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('The Oxford comma is placed before the final item in a list of three or more elements.', true) },
  { name: 'Parallel structure', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Which sentence shows correct parallel structure?',
      'She likes to swim, running, and dance.', 'She likes swimming, to run, and dancing.',
      'She likes swimming, running, and dancing.', 'She like swim, run, and dance.', 'c') },
  // ── Hard ──────────────────────────────────────────────────────────────────
  { name: 'Complex sentence construction', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Which sentence is a complex sentence?',
      'I ran and she walked.', 'Run!',
      'Because it was raining, we stayed indoors.', 'The cat sat.', 'c') },
  { name: 'Passive voice', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Which sentence is written in the passive voice?',
      'The chef cooked the meal.', 'The meal was cooked by the chef.',
      'They are cooking the meal.', 'The chef will cook the meal.', 'b') },
  { name: 'Subjunctive mood TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('The subjunctive mood is used to express wishes, hypothetical situations, or conditions contrary to fact.', true) },
  { name: 'Semicolon usage', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Which sentence uses a semicolon correctly?',
      'She loved art; but hated maths.', 'She loved art; she hated maths.',
      'She loved; art and hated maths.', 'She; loved art and hated maths.', 'b') },
  { name: 'Style consistency', type: 'short_answer', mark: 2, difficulty: 'hard',
    content: sa('Why is it important to maintain a consistent style and register throughout a piece of formal writing?',
      'Inconsistent style disrupts the reader\'s experience, undermines credibility, and can cause confusion. Formal writing should avoid slang, stay in the same tense, and use appropriate vocabulary throughout.') },
  { name: 'Rhetorical question', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('A rhetorical question is one that:',
      'Must always be answered by the reader', 'Is asked purely for effect and does not require an answer',
      'Is only used in scientific writing', 'Ends with an exclamation mark', 'b') },
  { name: 'Anaphora essay', type: 'essay', mark: 4, difficulty: 'hard',
    content: essay(
      'Write a short paragraph (5–8 sentences) on a topic of your choice that uses anaphora (deliberate repetition at the start of consecutive clauses) for rhetorical effect.',
      'Rubric: 2 marks for correct use of anaphora (at least 3 repeated phrases); 1 mark for coherent topic development; 1 mark for overall fluency and style.'
    ) },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4.  JAMES — INTRODUCTION TO ALGEBRA  (21 questions)
// ─────────────────────────────────────────────────────────────────────────────
const algebraQs: QDef[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { name: 'Evaluate simple expression', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('What is the value of 3x + 5 when x = 4?',
      '12', '17', '32', '14', 'b') },
  { name: 'Order of operations TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('According to the order of operations, multiplication is performed before addition.', true) },
  { name: 'One step equation', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('Solve for x: x + 9 = 14',
      'x = 23', 'x = 5', 'x = 9', 'x = 3', 'b') },
  { name: 'Commutative property', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('Which property is illustrated by: 3 + 7 = 7 + 3?',
      'Associative', 'Distributive', 'Commutative', 'Identity', 'c') },
  { name: 'Integer operations TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('The product of two negative integers is always a positive integer.', true) },
  { name: 'Variable definition', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('In algebra, a variable is:',
      'A fixed number', 'A letter representing an unknown quantity', 'A type of equation', 'A graph', 'b') },
  { name: 'Word expression writing', type: 'short_answer', mark: 2, difficulty: 'easy',
    content: sa('Write an algebraic expression for: "six more than three times a number n".',
      '3n + 6') },
  // ── Medium ────────────────────────────────────────────────────────────────
  { name: 'Two step equation', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Solve: 2x − 3 = 11',
      'x = 4', 'x = 7', 'x = 8', 'x = 14', 'b') },
  { name: 'Inequality TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('When you multiply or divide both sides of an inequality by a negative number, you must reverse the inequality sign.', true) },
  { name: 'Distributive property', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Expand: 4(x + 3)',
      '4x + 3', '4x + 12', 'x + 12', '4x + 7', 'b') },
  { name: 'Combine like terms', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Simplify: 5x + 2y − 3x + 4y',
      '2x + 6y', '8x + 6y', '2x + 2y', '8x − 2y', 'a') },
  { name: 'Ratio and proportion', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('If 3 pencils cost £1.50, how much do 7 pencils cost?',
      '£2.50', '£3.00', '£3.50', '£4.00', 'c') },
  { name: 'Percent equation', type: 'short_answer', mark: 2, difficulty: 'medium',
    content: sa('What is 35% of 200? Show your working.',
      '35% × 200 = 0.35 × 200 = 70') },
  { name: 'Algebraic word problem', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('A number doubled and then reduced by 5 equals 13. What is the number?',
      '4', '9', '8', '6', 'b') },
  // ── Hard ──────────────────────────────────────────────────────────────────
  { name: 'Simultaneous equations intro', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Which pair (x, y) satisfies both equations: x + y = 7 and x − y = 1?',
      '(3, 4)', '(4, 3)', '(5, 2)', '(6, 1)', 'b') },
  { name: 'Absolute value', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Solve: |2x − 4| = 10',
      'x = 7 or x = −3', 'x = 3 or x = 7', 'x = −7 or x = 3', 'x = 5 or x = −5', 'a') },
  { name: 'Quadratic pattern TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('The expression x² + 5x + 6 can be factored as (x + 2)(x + 3).', true) },
  { name: 'Function notation', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('If f(x) = 3x² − 2, what is f(−2)?',
      '−14', '10', '8', '14', 'b') },
  { name: 'Multi-step inequality', type: 'short_answer', mark: 3, difficulty: 'hard',
    content: sa('Solve and write the solution set: 3(x − 1) > 2x + 4. Show all steps.',
      '3x − 3 > 2x + 4 → x > 7. Solution set: x > 7 or (7, ∞)') },
  { name: 'Factoring simple expression', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Factor completely: 6x² − 9x',
      '3x(2x − 3)', '3(2x² − 3x)', '6x(x − 3)', '3x(2x + 3)', 'a') },
  { name: 'Polynomial intro essay', type: 'essay', mark: 4, difficulty: 'hard',
    content: essay(
      'Explain what a polynomial is, giving at least two examples. Describe the degree of a polynomial and explain why it matters.',
      'Rubric: 1 mark for correct definition; 1 mark per valid example (max 2); 1 mark for correct explanation of degree and its significance (highest exponent determines degree).'
    ) },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5.  JAMES — GEOMETRY  (21 questions)
// ─────────────────────────────────────────────────────────────────────────────
const geometryQs: QDef[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { name: 'Right angle definition', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('A right angle measures exactly:',
      '45°', '90°', '180°', '360°', 'b') },
  { name: 'Equilateral triangle TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('An equilateral triangle has all three sides and all three angles equal.', true) },
  { name: 'Pentagon sides', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('How many sides does a pentagon have?',
      '4', '6', '5', '8', 'c') },
  { name: 'Rectangle perimeter', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('What is the perimeter of a rectangle with length 8 cm and width 5 cm?',
      '13 cm', '40 cm', '26 cm', '16 cm', 'c') },
  { name: 'Area of rectangle', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('What is the area of a rectangle with length 9 m and width 4 m?',
      '26 m²', '36 m²', '13 m²', '72 m²', 'b') },
  { name: 'Coordinate quadrant TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('The point (−3, 5) is located in the second quadrant of the coordinate plane.', true) },
  { name: 'Parallel lines definition', type: 'short_answer', mark: 2, difficulty: 'easy',
    content: sa('What is the difference between parallel lines and perpendicular lines?',
      'Parallel lines run in the same direction and never intersect. Perpendicular lines intersect at a 90° right angle.') },
  // ── Medium ────────────────────────────────────────────────────────────────
  { name: 'Area of triangle', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('What is the area of a triangle with base 10 cm and height 6 cm?',
      '60 cm²', '30 cm²', '16 cm²', '20 cm²', 'b') },
  { name: 'Pythagorean theorem basic', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('In a right triangle with legs 3 and 4, the hypotenuse is 5.', true) },
  { name: 'Congruence vs similarity', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Two shapes are similar but not congruent. This means:',
      'They are identical in every way', 'They have the same shape but different sizes',
      'They have the same size but different shapes', 'They share no properties', 'b') },
  { name: 'Circumference formula', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('What is the circumference of a circle with radius 7 cm? (Use π ≈ 3.14)',
      '43.96 cm', '21.98 cm', '153.86 cm', '49 cm', 'a') },
  { name: 'Volume of rectangular prism', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('What is the volume of a box with length 5 cm, width 4 cm, and height 3 cm?',
      '47 cm³', '60 cm³', '24 cm³', '120 cm³', 'b') },
  { name: 'Supplementary angles short answer', type: 'short_answer', mark: 2, difficulty: 'medium',
    content: sa('Two supplementary angles are in the ratio 2:3. Find each angle.',
      '2x + 3x = 180° → 5x = 180° → x = 36°. The angles are 72° and 108°.') },
  { name: 'Vertical angles TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('Vertical angles are always equal in measure.', true) },
  // ── Hard ──────────────────────────────────────────────────────────────────
  { name: 'Pythagorean 3D', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('A box measures 3 cm × 4 cm × 12 cm. What is the length of the space diagonal?',
      '13 cm', '√169 cm = 13 cm', '19 cm', '169 cm', 'b') },
  { name: 'Circle theorem TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('The angle subtended by a diameter at any point on the circumference of a circle is always 90°.', true) },
  { name: 'Surface area complex', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('What is the total surface area of a cube with side length 4 cm?',
      '16 cm²', '64 cm²', '96 cm²', '48 cm²', 'c') },
  { name: 'Transformation types', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Which transformation preserves the size and shape of a figure but changes its orientation?',
      'Dilation', 'Translation', 'Reflection', 'None of the above', 'c') },
  { name: 'Coordinate proof short answer', type: 'short_answer', mark: 3, difficulty: 'hard',
    content: sa(
      'Using coordinates, prove that the midpoint of the segment joining A(2, 4) and B(8, 10) lies on the line y = x + 2.',
      'Midpoint M = ((2+8)/2, (4+10)/2) = (5, 7). Check: y = x + 2 → 7 = 5 + 2 = 7. ✓ The midpoint lies on the line.'
    ) },
  { name: 'Similarity and scale essay', type: 'essay', mark: 4, difficulty: 'hard',
    content: essay(
      'Explain the concept of similarity in geometry and describe how scale factors are used. Give a real-world example where similarity is applied.',
      'Rubric: 1 mark for correct definition of similarity; 1 mark for explanation of scale factor; 1 mark for correct real-world example (maps, models, photography, architecture, etc.); 1 mark for clarity of explanation.'
    ) },
  { name: 'Proof by contradiction TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('A proof by contradiction starts by assuming the opposite of what you want to prove, then shows that assumption leads to a logical impossibility.', true) },
];

// ─────────────────────────────────────────────────────────────────────────────
// 6.  JAMES — PRE-CALCULUS  (21 questions)
// ─────────────────────────────────────────────────────────────────────────────
const preCalcQs: QDef[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { name: 'Domain and range basic', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('For the function f(x) = √x, which values of x are in the domain?',
      'All real numbers', 'Only positive numbers', 'x ≥ 0', 'x > 0 only', 'c') },
  { name: 'Function notation TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('f(3) means "f multiplied by 3" in function notation.', false) },
  { name: 'Evaluate a function', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('If g(x) = 2x + 1, what is g(5)?',
      '10', '11', '6', '12', 'b') },
  { name: 'Slope of a line', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('What is the slope of the line passing through (1, 2) and (3, 8)?',
      '2', '3', '6', '4', 'b') },
  { name: 'y-intercept', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('In the equation y = 4x − 7, what is the y-intercept?',
      '4', '7', '−7', '0', 'c') },
  { name: 'Sine definition', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('In a right triangle, sin(θ) is defined as:',
      'adjacent ÷ hypotenuse', 'opposite ÷ hypotenuse', 'opposite ÷ adjacent', 'hypotenuse ÷ opposite', 'b') },
  { name: 'Interval notation short answer', type: 'short_answer', mark: 2, difficulty: 'easy',
    content: sa('Write the set of all x such that −2 ≤ x < 5 in interval notation.',
      '[−2, 5)') },
  // ── Medium ────────────────────────────────────────────────────────────────
  { name: 'Inverse function', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('If f(x) = 3x − 6, what is f⁻¹(x)?',
      '(x + 6) / 3', '(x − 6) / 3', '3x + 6', '(x / 3) − 6', 'a') },
  { name: 'Quadratic vertex TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('The vertex of the parabola y = (x − 3)² + 4 is at the point (3, 4).', true) },
  { name: 'Complete the square', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Which is equivalent to x² + 6x + 5 after completing the square?',
      '(x + 3)² − 4', '(x + 3)² + 5', '(x + 6)² − 31', '(x + 2)² + 1', 'a') },
  { name: 'Logarithm definition', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('log₂(8) equals:',
      '4', '3', '2', '16', 'b') },
  { name: 'Exponential growth TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('In an exponential function y = a · bˣ, if b > 1 the function represents growth; if 0 < b < 1 it represents decay.', true) },
  { name: 'Unit circle short answer', type: 'short_answer', mark: 2, difficulty: 'medium',
    content: sa('State the coordinates of the point on the unit circle that corresponds to an angle of 90° (π/2 radians).',
      '(0, 1)') },
  { name: 'Cosine value', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('What is cos(60°)?',
      '1', '√3/2', '1/2', '0', 'c') },
  // ── Hard ──────────────────────────────────────────────────────────────────
  { name: 'Composite function', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('If f(x) = x² and g(x) = x + 1, what is (f ∘ g)(2)?',
      '5', '9', '8', '6', 'b') },
  { name: 'Rational function asymptote TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('The function f(x) = 1/(x − 2) has a vertical asymptote at x = 2.', true) },
  { name: 'Polynomial division', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Divide (x² − 5x + 6) by (x − 2). The quotient is:',
      'x − 3', 'x + 3', 'x − 3 remainder 0', 'Both A and C are correct', 'd') },
  { name: 'Logarithm equation', type: 'short_answer', mark: 3, difficulty: 'hard',
    content: sa('Solve: log₃(x) = 4. Show your working.',
      'log₃(x) = 4 means 3⁴ = x, so x = 81.') },
  { name: 'Trig identity', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Which of the following is a Pythagorean identity?',
      'sin(x) + cos(x) = 1', 'sin²(x) + cos²(x) = 1', 'tan(x) = sin(x) + cos(x)', 'sin(x) = cos(x)', 'b') },
  { name: 'Conic section TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('The equation x²/9 + y²/4 = 1 represents an ellipse.', true) },
  { name: 'Parametric equations essay', type: 'essay', mark: 4, difficulty: 'hard',
    content: essay(
      'Explain what parametric equations are and describe one situation where they are more useful than a standard Cartesian equation.',
      'Rubric: 2 marks for a clear, accurate definition with a correct example (e.g., x = t, y = t²); 2 marks for a valid use-case (e.g., projectile motion, animation paths, cycloids) with explanation of why parametric form is better.'
    ) },
];

// ─────────────────────────────────────────────────────────────────────────────
// 7.  SHARED — CRITICAL THINKING  (21 questions, owned by OrgAdmin)
// ─────────────────────────────────────────────────────────────────────────────
const criticalThinkingQs: QDef[] = [
  // ── Easy ──────────────────────────────────────────────────────────────────
  { name: 'Premise and conclusion', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('In an argument, the conclusion is:',
      'The first sentence stated', 'The claim that the premises are meant to support',
      'Always true', 'The same as a fact', 'b') },
  { name: 'Fact vs opinion TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('"The Eiffel Tower is 330 metres tall" is a fact, while "The Eiffel Tower is beautiful" is an opinion.', true) },
  { name: 'Valid argument definition', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('A valid argument is one where:',
      'All the premises are true', 'If the premises are true, the conclusion must be true',
      'The conclusion is always popular', 'It has more than two premises', 'b') },
  { name: 'Logical AND TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('In logic, "P AND Q" is only true when both P and Q are true.', true) },
  { name: 'Hidden assumption', type: 'multiple_choice', mark: 1, difficulty: 'easy',
    content: mc('The hidden assumption in "All teenagers are irresponsible, so you shouldn\'t hire teens" is:',
      'Teenagers don\'t want to work', 'Irresponsible people make bad employees',
      'All employers are adults', 'Hiring is always about responsibility', 'b') },
  { name: 'Reliable source TF', type: 'true_false', mark: 1, difficulty: 'easy',
    content: tf('A peer-reviewed academic journal is generally considered a more reliable source than an anonymous social media post.', true) },
  { name: 'Deductive vs inductive', type: 'short_answer', mark: 2, difficulty: 'easy',
    content: sa('What is the key difference between deductive and inductive reasoning?',
      'Deductive reasoning moves from general principles to specific conclusions (the conclusion is certain if premises are true). Inductive reasoning moves from specific observations to general conclusions (the conclusion is probable, not certain).') },
  // ── Medium ────────────────────────────────────────────────────────────────
  { name: 'Ad hominem fallacy', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('Which statement is an example of an ad hominem fallacy?',
      '"Your argument has a logical flaw in step three."',
      '"You\'re wrong because you failed your exams."',
      '"The data shows a 15% decline."',
      '"We should consider both sides of this issue."', 'b') },
  { name: 'False dichotomy TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('A false dichotomy presents only two options when in reality more options exist.', true) },
  { name: 'Correlation vs causation', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('"Ice cream sales and shark attacks both increase in summer, therefore ice cream causes shark attacks." This is an example of:',
      'Valid scientific reasoning', 'Confusing correlation with causation',
      'Inductive reasoning', 'A sound argument', 'b') },
  { name: 'Source credibility', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('When evaluating a source\'s credibility, which question is most important?',
      '"Does the title sound impressive?"', '"Does the author have relevant expertise and is the work peer-reviewed?"',
      '"Is the website colourful?"', '"Is the text written in formal English?"', 'b') },
  { name: 'Counterargument short answer', type: 'short_answer', mark: 2, difficulty: 'medium',
    content: sa('Why is it important to address counterarguments when making a persuasive case?',
      'Addressing counterarguments shows intellectual honesty, strengthens your position by showing you have considered opposing views, and makes your overall argument more persuasive and credible.') },
  { name: 'Confirmation bias TF', type: 'true_false', mark: 1, difficulty: 'medium',
    content: tf('Confirmation bias is the tendency to search for and favour information that confirms pre-existing beliefs.', true) },
  { name: 'Statistical reasoning', type: 'multiple_choice', mark: 1, difficulty: 'medium',
    content: mc('A survey says "9 out of 10 dentists recommend this toothpaste." What key piece of information is missing?',
      'The type of toothpaste', 'The total number of dentists surveyed and how they were selected',
      'The price of the toothpaste', 'The country where the survey was conducted', 'b') },
  // ── Hard ──────────────────────────────────────────────────────────────────
  { name: 'Argument mapping', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('What is the main purpose of argument mapping?',
      'Drawing pictures to illustrate a story', 'Visually representing the structure of an argument to clarify relationships between claims and evidence',
      'Making a geographical map of where arguments occur', 'Writing arguments in bullet points only', 'b') },
  { name: 'Modus ponens', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Given: "If it rains, the ground gets wet" and "It is raining", what can we conclude using modus ponens?',
      'It will rain tomorrow', 'The ground is wet', 'The ground is dry', 'We cannot conclude anything', 'b') },
  { name: 'Modus tollens TF', type: 'true_false', mark: 1, difficulty: 'hard',
    content: tf('Modus tollens is the valid argument form: "If P then Q; not Q; therefore not P."', true) },
  { name: 'Rhetorical appeals', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('An argument that appeals to the audience\'s emotions rather than logic is primarily using:',
      'Ethos', 'Logos', 'Pathos', 'Kairos', 'c') },
  { name: 'Thought experiment short answer', type: 'short_answer', mark: 3, difficulty: 'hard',
    content: sa(
      'Briefly describe the Trolley Problem and explain what philosophical question it is designed to explore.',
      'The Trolley Problem: A runaway trolley is heading toward five people tied to the tracks. You can pull a lever to divert it to a side track where only one person is tied. It explores the tension between consequentialist ethics (save more lives by acting) and deontological ethics (acting makes you morally responsible for the one death). It questions whether causing harm is morally equivalent to allowing harm.'
    ) },
  { name: 'Scientific method', type: 'multiple_choice', mark: 1, difficulty: 'hard',
    content: mc('Which step of the scientific method involves creating a testable statement that predicts the outcome of an experiment?',
      'Observation', 'Analysis', 'Hypothesis', 'Conclusion', 'c') },
  { name: 'Ethical reasoning essay', type: 'essay', mark: 4, difficulty: 'hard',
    content: essay(
      'Describe a real or hypothetical ethical dilemma and analyse it using both consequentialist and deontological frameworks. Which framework leads you to a clearer answer, and why?',
      'Rubric: 1 mark for clear ethical dilemma; 1 mark for correct consequentialist analysis; 1 mark for correct deontological analysis; 1 mark for justified personal conclusion.'
    ) },
];

// ─────────────────────────────────────────────────────────────────────────────
// BANK DEFINITIONS — one per course
// ─────────────────────────────────────────────────────────────────────────────
type BankDef = {
  name: string;
  description: string;
  ownerId: number;
  questions: QDef[];
};

const bankDefs: BankDef[] = [
  { name: 'Creative Writing Question Bank', description: 'Story craft, narrative techniques, and writer\'s voice', ownerId: SARAH_ID, questions: creativeWritingQs },
  { name: 'English Literature Question Bank', description: 'Literary analysis, themes, and critical reading', ownerId: SARAH_ID, questions: englishLiteratureQs },
  { name: 'Grammar & Language Arts Question Bank', description: 'Punctuation, sentence structure, and rhetorical style', ownerId: SARAH_ID, questions: grammarQs },
  { name: 'Introduction to Algebra Question Bank', description: 'Expressions, equations, inequalities, and functions', ownerId: JAMES_ID, questions: algebraQs },
  { name: 'Geometry Question Bank', description: 'Shapes, angles, proofs, and spatial reasoning', ownerId: JAMES_ID, questions: geometryQs },
  { name: 'Pre-Calculus Question Bank', description: 'Functions, trigonometry, logarithms, and conic sections', ownerId: JAMES_ID, questions: preCalcQs },
  { name: 'Critical Thinking Question Bank', description: 'Logic, argumentation, fallacies, and ethical reasoning', ownerId: ORGADMIN_ID, questions: criticalThinkingQs },
];

// ─────────────────────────────────────────────────────────────────────────────
// COURSE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
type CourseDef = {
  title: string;
  description: string;
  ownerId: number;
  bankIndex: number;  // index into bankDefs
  learnerIds: number[];
};

const courseDefs: CourseDef[] = [
  {
    title: 'Creative Writing — Grade 7',
    description: 'Develop your creative voice through narrative craft, character building, and imaginative storytelling.',
    ownerId: SARAH_ID,
    bankIndex: 0,
    learnerIds: [ALICE_ID, BOB_ID],
  },
  {
    title: 'English Literature — Grade 7',
    description: 'Explore and analyse literary texts, themes, and the craft of great authors.',
    ownerId: SARAH_ID,
    bankIndex: 1,
    learnerIds: [ALICE_ID, BOB_ID],
  },
  {
    title: 'Grammar & Language Arts — Grade 7',
    description: 'Master the mechanics of language: grammar, style, punctuation, and rhetoric.',
    ownerId: SARAH_ID,
    bankIndex: 2,
    learnerIds: [ALICE_ID, BOB_ID],
  },
  {
    title: 'Introduction to Algebra',
    description: 'Build a solid foundation in algebraic thinking: expressions, equations, and functions.',
    ownerId: JAMES_ID,
    bankIndex: 3,
    learnerIds: [CHARLIE_ID, BOB_ID],
  },
  {
    title: 'Geometry',
    description: 'Understand shapes, measurements, transformations, and formal geometric reasoning.',
    ownerId: JAMES_ID,
    bankIndex: 4,
    learnerIds: [CHARLIE_ID, BOB_ID],
  },
  {
    title: 'Pre-Calculus',
    description: 'Prepare for calculus by mastering functions, trigonometry, and advanced algebra.',
    ownerId: JAMES_ID,
    bankIndex: 5,
    learnerIds: [CHARLIE_ID, BOB_ID],
  },
  {
    title: 'Introduction to Critical Thinking',
    description: 'Sharpen your reasoning skills: logic, argument analysis, fallacies, and ethical thinking.',
    ownerId: ORGADMIN_ID,
    bankIndex: 6,
    learnerIds: [ALICE_ID, BOB_ID, CHARLIE_ID],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION
// ─────────────────────────────────────────────────────────────────────────────
async function applyMigrations(client: PoolClient) {
  console.log('\n📦 Checking pending migrations…');

  // Check if assessments table exists
  const assessCheck = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'assessments'
     ) AS exists`
  );

  if (!assessCheck.rows[0]?.exists) {
    console.log('  Applying add_assessments.sql…');
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/add_assessments.sql'), 'utf8'
    );
    await client.query(sql);
    console.log('  ✅ add_assessments.sql applied');
  } else {
    console.log('  ✅ assessments table already exists');
  }

  // Check if assignments table exists
  const assignCheck = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'assignments'
     ) AS exists`
  );

  if (!assignCheck.rows[0]?.exists) {
    console.log('  Applying add_assignments.sql…');
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/add_assignments.sql'), 'utf8'
    );
    await client.query(sql);
    console.log('  ✅ add_assignments.sql applied');
  } else {
    console.log('  ✅ assignments table already exists');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ITEM BANKS
// ─────────────────────────────────────────────────────────────────────────────
async function createItemBanks(client: PoolClient): Promise<number[]> {
  console.log('\n🏦 Creating item banks…');
  const ids: number[] = [];
  for (const bank of bankDefs) {
    const res = await client.query<{ id: number }>(
      `INSERT INTO item_banks (name, description, owner_id, tenant_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [bank.name, bank.description, bank.ownerId, TENANT_ID]
    );
    const id = res.rows[0]!.id;
    ids.push(id);
    console.log(`  ✅ Bank #${id}: "${bank.name}"`);
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE QUESTIONS  (21 per bank)
// ─────────────────────────────────────────────────────────────────────────────
async function createQuestions(client: PoolClient, bankIds: number[]): Promise<number[][]> {
  console.log('\n❓ Creating questions (21 per bank = 147 total)…');
  const allIds: number[][] = [];
  for (let b = 0; b < bankDefs.length; b++) {
    const bank = bankDefs[b]!;
    const bankId = bankIds[b]!;
    const qIds: number[] = [];
    for (const q of bank.questions) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO questions (owner_id, name, type, text, mark, item_bank_id, content, tenant_id)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7)
         RETURNING id`,
        [
          bank.ownerId,
          q.name,
          q.type,
          q.mark,
          bankId,
          JSON.stringify(q.content),
          TENANT_ID,
        ]
      );
      qIds.push(res.rows[0]!.id);
    }
    console.log(`  ✅ ${qIds.length} questions in "${bank.name}"`);
    allIds.push(qIds);
  }
  return allIds;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE COURSES
// ─────────────────────────────────────────────────────────────────────────────
async function createCourses(client: PoolClient): Promise<number[]> {
  console.log('\n📚 Creating courses…');
  const ids: number[] = [];
  for (const course of courseDefs) {
    const res = await client.query<{ id: number }>(
      `INSERT INTO courses (title, description, status, created_by, tenant_id)
       VALUES ($1, $2, 'published', $3, $4)
       RETURNING id`,
      [course.title, course.description, course.ownerId, TENANT_ID]
    );
    const id = res.rows[0]!.id;
    ids.push(id);
    console.log(`  ✅ Course #${id}: "${course.title}"`);
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ACTIVITIES per course
// ─────────────────────────────────────────────────────────────────────────────
async function createActivities(client: PoolClient, courseIds: number[]) {
  console.log('\n🎯 Creating activities per course…');
  for (let i = 0; i < courseDefs.length; i++) {
    const courseId = courseIds[i]!;
    const courseDef = courseDefs[i]!;

    // Activity 1: Mid-Unit Quiz
    await client.query(
      `INSERT INTO activities (course_id, type, title, description, position, settings, tenant_id)
       VALUES ($1, 'quiz', $2, $3, 0, $4, $5)`,
      [
        courseId,
        `${courseDef.title} — Mid-Unit Quiz`,
        'A short 7-question quiz covering the first half of the course material.',
        JSON.stringify({ question_count: 7, time_limit_mins: 20, passing_score: 70 }),
        TENANT_ID,
      ]
    );

    // Activity 2: Practice Test
    await client.query(
      `INSERT INTO activities (course_id, type, title, description, position, settings, tenant_id)
       VALUES ($1, 'practice_quiz', $2, $3, 1, $4, $5)`,
      [
        courseId,
        `${courseDef.title} — Practice Test`,
        'An ungraded 21-question practice run using the full question bank.',
        JSON.stringify({ question_count: 21, time_limit_mins: 0, ungraded: true }),
        TENANT_ID,
      ]
    );

    // Activity 3: Final Exam
    await client.query(
      `INSERT INTO activities (course_id, type, title, description, position, settings, tenant_id)
       VALUES ($1, 'quiz', $2, $3, 2, $4, $5)`,
      [
        courseId,
        `${courseDef.title} — Final Exam`,
        'A comprehensive 15-question exam covering all course material.',
        JSON.stringify({ question_count: 15, time_limit_mins: 60, passing_score: 60, randomize: true }),
        TENANT_ID,
      ]
    );

    console.log(`  ✅ 3 activities for course #${courseId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENROL LEARNERS
// ─────────────────────────────────────────────────────────────────────────────
async function enrollLearners(client: PoolClient, courseIds: number[]) {
  console.log('\n👩‍🎓 Enrolling learners…');
  for (let i = 0; i < courseDefs.length; i++) {
    const courseId = courseIds[i]!;
    const course = courseDefs[i]!;
    for (const learnerId of course.learnerIds) {
      await client.query(
        `INSERT INTO course_assignments (course_id, user_id, assigned_by, tenant_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (course_id, user_id) DO NOTHING`,
        [courseId, learnerId, course.ownerId, TENANT_ID]
      );
    }
    console.log(`  ✅ Course #${courseId}: enrolled ${course.learnerIds.join(', ')}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ASSESSMENTS + POOL
// ─────────────────────────────────────────────────────────────────────────────
async function createAssessments(
  client: PoolClient,
  courseIds: number[],
  questionIds: number[][]
) {
  console.log('\n📝 Creating assessments (quiz + exam per course)…');

  for (let i = 0; i < courseDefs.length; i++) {
    const courseId = courseIds[i]!;
    const course = courseDefs[i]!;
    const qIds = questionIds[i]!;  // 21 question IDs for this course

    // Quiz: first 7 questions (easy difficulty)
    const quizRes = await client.query<{ id: number }>(
      `INSERT INTO assessments
         (tenant_id, course_id, created_by, title, description, type,
          time_limit_mins, max_attempts, passing_score_percent, question_count,
          randomize_questions, anti_cheat_enabled, status)
       VALUES ($1, $2, $3, $4, $5, 'quiz', 20, 2, 70, 7, false, false, 'published')
       RETURNING id`,
      [
        TENANT_ID, courseId, course.ownerId,
        `${course.title} — Mid-Unit Quiz`,
        'A 7-question quiz covering the first section of the course.',
      ]
    );
    const quizId = quizRes.rows[0]!.id;

    for (const qId of qIds.slice(0, 7)) {
      await client.query(
        `INSERT INTO assessment_question_pool (assessment_id, question_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [quizId, qId]
      );
    }

    // Exam: questions 1–15 (mix of all difficulties)
    const examRes = await client.query<{ id: number }>(
      `INSERT INTO assessments
         (tenant_id, course_id, created_by, title, description, type,
          time_limit_mins, max_attempts, passing_score_percent, question_count,
          randomize_questions, anti_cheat_enabled, status)
       VALUES ($1, $2, $3, $4, $5, 'exam', 60, 1, 60, 15, true, false, 'published')
       RETURNING id`,
      [
        TENANT_ID, courseId, course.ownerId,
        `${course.title} — Final Exam`,
        'A comprehensive 15-question final exam covering all course material.',
      ]
    );
    const examId = examRes.rows[0]!.id;

    for (const qId of qIds.slice(0, 15)) {
      await client.query(
        `INSERT INTO assessment_question_pool (assessment_id, question_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [examId, qId]
      );
    }

    // Practice Test: all 21 questions
    const practiceRes = await client.query<{ id: number }>(
      `INSERT INTO assessments
         (tenant_id, course_id, created_by, title, description, type,
          time_limit_mins, max_attempts, passing_score_percent, question_count,
          randomize_questions, anti_cheat_enabled, status)
       VALUES ($1, $2, $3, $4, $5, 'quiz', 0, 999, 0, 21, false, false, 'published')
       RETURNING id`,
      [
        TENANT_ID, courseId, course.ownerId,
        `${course.title} — Practice Test`,
        'Ungraded practice run through all 21 questions. Take as many times as needed.',
      ]
    );
    const practiceId = practiceRes.rows[0]!.id;

    for (const qId of qIds) {
      await client.query(
        `INSERT INTO assessment_question_pool (assessment_id, question_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [practiceId, qId]
      );
    }

    console.log(`  ✅ Course #${courseId}: quiz #${quizId}, exam #${examId}, practice #${practiceId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

// Assignment instructions per course (parallel to courseDefs order)
const assignmentDefs = [
  {
    title: 'Short Story Assignment',
    instructions: 'Write a short story (400–600 words) that demonstrates three narrative techniques covered in this course: a clear story arc (rising action, climax, resolution), at least one piece of dialogue, and one use of "show, don\'t tell". Include a brief author\'s note explaining your choices.',
    max_score: 40,
  },
  {
    title: 'Literary Analysis Essay',
    instructions: 'Choose a short story or poem you have read this term. Write a 3-paragraph literary analysis that: (1) identifies the central theme, (2) analyses two literary devices the author uses to develop it, and (3) evaluates how effectively the author communicates their message. Use direct quotations as evidence.',
    max_score: 40,
  },
  {
    title: 'Grammar Editing Task',
    instructions: 'You will be given a passage containing 10 deliberate grammar, punctuation, and style errors. Identify and correct each error, explaining the rule that applies. Then rewrite two sentences from the passage to improve their style while preserving their meaning.',
    max_score: 30,
  },
  {
    title: 'Algebra Problem Set',
    instructions: 'Complete the following problem set: (1) Solve 5 multi-step equations, showing all working. (2) Write and solve an algebraic inequality for a real-world scenario of your choice. (3) Create and solve a system of two equations with two variables. Present your work neatly with full annotations.',
    max_score: 30,
  },
  {
    title: 'Geometry Portfolio',
    instructions: 'Create a geometry portfolio containing: (1) A labelled diagram illustrating at least 4 different angle relationships. (2) Calculations for the area and perimeter of 3 composite shapes. (3) A written proof of the Pythagorean theorem using at least one diagram. (4) A real-world application: measure and calculate the area of a room in your home.',
    max_score: 40,
  },
  {
    title: 'Functions Investigation',
    instructions: 'Investigate the behaviour of three different function families (linear, quadratic, and exponential). For each: (1) Write the general form of the function. (2) Plot two examples on a graph. (3) Describe how changing each parameter affects the shape of the graph. Write a 1-page summary of your findings.',
    max_score: 40,
  },
  {
    title: 'Argument Analysis Report',
    instructions: 'Find a newspaper opinion article or editorial online. Write a 400-word report that: (1) Identifies the author\'s main claim and supporting premises. (2) Evaluates the quality of the evidence. (3) Identifies at least one logical fallacy or weakness. (4) Suggests one way the argument could be strengthened. Attach or paste the original article.',
    max_score: 40,
  },
];

async function createAssignments(client: PoolClient, courseIds: number[]) {
  console.log('\n📋 Creating assignments…');

  // Calculate due dates: 4 weeks from now
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 28);

  for (let i = 0; i < courseDefs.length; i++) {
    const courseId = courseIds[i]!;
    const course = courseDefs[i]!;
    const assignDef = assignmentDefs[i]!;

    const res = await client.query<{ id: number }>(
      `INSERT INTO assignments (tenant_id, course_id, created_by, title, instructions, max_score, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'published')
       RETURNING id`,
      [
        TENANT_ID, courseId, course.ownerId,
        assignDef.title, assignDef.instructions, assignDef.max_score,
        dueDate.toISOString(),
      ]
    );
    const assignId = res.rows[0]!.id;

    // Assign to each learner in the course
    for (const learnerId of course.learnerIds) {
      await client.query(
        `INSERT INTO assignment_user_assignments (assignment_id, user_id, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [assignId, learnerId, course.ownerId]
      );
    }

    console.log(`  ✅ Assignment #${assignId}: "${assignDef.title}" → Course #${courseId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Item Bank — Full Demo Seed Script');
  console.log('═══════════════════════════════════════════════════');

  const client = await pool.connect();
  try {
    await applyMigrations(client);
    const bankIds = await createItemBanks(client);
    const questionIds = await createQuestions(client, bankIds);
    const courseIds = await createCourses(client);
    await createActivities(client, courseIds);
    await enrollLearners(client, courseIds);
    await createAssessments(client, courseIds, questionIds);
    await createAssignments(client, courseIds);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  ✅ All demo data seeded successfully!');
    console.log('');
    console.log('  Summary:');
    console.log(`    • 7 item banks created`);
    console.log(`    • 147 questions (21 per bank)`);
    console.log(`    • 7 courses (Sarah: 3, James: 3, Shared: 1)`);
    console.log(`    • 21 activities (3 per course)`);
    console.log(`    • 21 assessments (quiz + exam + practice per course)`);
    console.log(`    • 7 assignments (1 per course)`);
    console.log(`    • Learner enrolments:`);
    console.log(`        Sarah's courses → Alice + Bob`);
    console.log(`        James's courses → Charlie + Bob`);
    console.log(`        Shared course   → Alice + Bob + Charlie`);
    console.log('═══════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
