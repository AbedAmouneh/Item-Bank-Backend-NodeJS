/**
 * STUB CONTROLLER — for browser-testing Batch 2 frontend only.
 *
 * This returns hardcoded fixture data so the learn UI can be exercised
 * without the real Batch 5A backend endpoints.
 * Remove (or replace) this entire file when the real learn controller is built.
 */

import { FastifyReply } from 'fastify';

import { HttpWrapper } from '../../platform/http';
import { AuthenticatedRequest } from '../../platform/http/middlewares/auth';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const DASHBOARD_DATA = {
  courses: [
    {
      id: 1,
      title: 'Introduction to Item Banking',
      description: 'Learn the fundamentals of building robust item banks.',
      thumbnail_url: null,
      progress_percent: 40,
      status: 'in_progress',
      due_date: '2026-04-15',
      module_count: 5,
      modules_completed: 2,
      exam_id: 1,
    },
    {
      id: 2,
      title: 'Advanced Question Design',
      description: null,
      thumbnail_url: null,
      progress_percent: 0,
      status: 'not_started',
      due_date: null,
      module_count: 3,
      modules_completed: 0,
      exam_id: null,
    },
    {
      id: 3,
      title: 'Assessment Fundamentals',
      description: 'Core principles of educational assessment.',
      thumbnail_url: null,
      progress_percent: 100,
      status: 'completed',
      due_date: '2026-03-01',
      module_count: 4,
      modules_completed: 4,
      exam_id: null,
    },
  ],
  exams: [
    {
      id: 1,
      title: 'Item Banking Certification Exam',
      time_limit_mins: 60,
      question_count: 40,
      max_attempts: 3,
      attempts_used: 1,
      passing_score_percent: 70,
      last_score: 58,
      last_passed: false,
      due_date: '2026-04-20',
      status: 'in_progress',
    },
    {
      id: 2,
      title: 'Psychometrics Basics Quiz',
      time_limit_mins: null,
      question_count: 20,
      max_attempts: 2,
      attempts_used: 0,
      passing_score_percent: 80,
      last_score: null,
      last_passed: null,
      due_date: null,
      status: 'not_started',
    },
    {
      id: 3,
      title: 'Completed Certification Exam',
      time_limit_mins: 30,
      question_count: 15,
      max_attempts: 2,
      attempts_used: 1,
      passing_score_percent: 75,
      last_score: 87,
      last_passed: true,
      due_date: null,
      status: 'completed',
    },
  ],
  assignments: [
    {
      id: 1,
      title: 'Item Bank Portfolio Submission',
      due_date: '2026-04-10',
      submitted_at: null,
      graded_at: null,
      score: null,
      max_score: 100,
      status: 'not_submitted',
    },
    {
      id: 2,
      title: 'Question Design Draft',
      due_date: '2026-03-20',
      submitted_at: '2026-03-19T14:30:00Z',
      graded_at: '2026-03-21T09:00:00Z',
      score: 88,
      max_score: 100,
      status: 'graded',
    },
  ],
};

const moduleHtml = (n: number): string =>
  `<h2>Module ${n}</h2><p>This is the content for module ${n}. ` +
  `It covers key concepts and provides hands-on practice exercises. ` +
  `Work through each section carefully before marking this module complete.</p>` +
  `<ul><li>Concept overview</li><li>Worked examples</li><li>Practice exercise</li></ul>`;

// ---------------------------------------------------------------------------
// Exam fixture data
// ---------------------------------------------------------------------------

const ASSESSMENT_BRIEF = {
  id: 1,
  title: 'Item Banking Certification Exam',
  description: 'Test your knowledge of item banking fundamentals and best practices.',
  time_limit_mins: 30,
  question_count: 3,
  passing_score_percent: 70,
  max_attempts: 3,
  attempts_used: 1,
  attempts_remaining: 2,
  anti_cheat_enabled: false,
};

const EXAM_QUESTIONS = [
  {
    id: 1,
    position: 1,
    type: 'multiple_choice',
    points: 10,
    content: {
      text: 'Which of the following best describes the purpose of an item bank?',
      choices: [
        { id: 'a', text: 'A place to store physical test papers' },
        { id: 'b', text: 'A repository of reusable assessment questions with metadata' },
        { id: 'c', text: 'A grading system for multiple-choice questions' },
        { id: 'd', text: 'A database of student records' },
      ],
    },
  },
  {
    id: 2,
    position: 2,
    type: 'true_false',
    points: 5,
    content: {
      text: 'Distractors in a multiple-choice question should be clearly wrong to make grading easier.',
    },
  },
  {
    id: 3,
    position: 3,
    type: 'short_answer',
    points: 10,
    content: {
      text: 'Briefly describe one advantage of using an item bank over creating new questions for every assessment.',
    },
  },
];

const ATTEMPT_RESULT = {
  attempt_id: 101,
  assessment_id: 1,
  score_percent: 75,
  passed: true,
  correct_count: 2,
  total_count: 3,
  time_taken_seconds: 480,
  attempt_number: 2,
  attempts_remaining: 1,
  questions: [
    {
      id: 1,
      position: 1,
      type: 'multiple_choice',
      content: {
        text: 'Which of the following best describes the purpose of an item bank?',
        choices: [
          { id: 'a', text: 'A place to store physical test papers' },
          { id: 'b', text: 'A repository of reusable assessment questions with metadata' },
          { id: 'c', text: 'A grading system for multiple-choice questions' },
          { id: 'd', text: 'A database of student records' },
        ],
        explanation: 'An item bank is a repository that stores assessment questions with detailed metadata, allowing them to be reused across multiple assessments.',
      },
      learner_answer: { type: 'multiple_choice', value: 'b' },
      correct_answer: { type: 'multiple_choice', value: 'b' },
      is_correct: true,
      points_awarded: 10,
      points_possible: 10,
    },
    {
      id: 2,
      position: 2,
      type: 'true_false',
      content: {
        text: 'Distractors in a multiple-choice question should be clearly wrong to make grading easier.',
        explanation: 'Effective distractors should be plausible to learners with misconceptions, not obviously wrong. Clearly wrong distractors reduce the diagnostic value of the question.',
      },
      learner_answer: { type: 'true_false', value: 'false' },
      correct_answer: { type: 'true_false', value: 'false' },
      is_correct: true,
      points_awarded: 5,
      points_possible: 5,
    },
    {
      id: 3,
      position: 3,
      type: 'short_answer',
      content: {
        text: 'Briefly describe one advantage of using an item bank over creating new questions for every assessment.',
        explanation: 'Item banks save time by allowing question reuse, enable statistical analysis of question performance over time, and support consistency across assessments.',
      },
      learner_answer: { type: 'short_answer', value: 'It saves time and allows reuse of validated questions.' },
      correct_answer: { type: 'short_answer', value: 'Reuse of validated questions saves time and ensures consistent quality.' },
      is_correct: false,
      points_awarded: 0,
      points_possible: 10,
    },
  ],
};

const COURSE_1 = {
  id: 1,
  title: 'Introduction to Item Banking',
  description: 'Learn the fundamentals of building robust item banks.',
  thumbnail_url: null,
  progress_percent: 40,
  status: 'in_progress',
  due_date: '2026-04-15',
  module_count: 5,
  modules_completed: 2,
  exam_id: 1,
  modules: [
    { id: 101, title: 'What is an Item Bank?',    position: 1, content: moduleHtml(1), completed: true,  locked: false },
    { id: 102, title: 'Item Types and Formats',   position: 2, content: moduleHtml(2), completed: true,  locked: false },
    { id: 103, title: 'Writing Effective Stems',  position: 3, content: moduleHtml(3), completed: false, locked: false },
    { id: 104, title: 'Distractor Design',        position: 4, content: moduleHtml(4), completed: false, locked: true  },
    { id: 105, title: 'Review and Validation',    position: 5, content: moduleHtml(5), completed: false, locked: true  },
  ],
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function getAssessmentBrief(
  _request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send({ success: true, data: ASSESSMENT_BRIEF });
}

async function startAttempt(
  _request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const session = {
    attempt_id: 101,
    assessment_id: 1,
    deadline_at: deadline,
    questions: EXAM_QUESTIONS,
  };
  await reply.status(201).send({ success: true, data: session });
}

async function saveAnswer(
  _request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send({ success: true, data: { ok: true } });
}

async function submitAttempt(
  _request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send({ success: true, data: ATTEMPT_RESULT });
}

async function getAttemptResult(
  _request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send({ success: true, data: ATTEMPT_RESULT });
}

async function logViolation(
  _request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send({ success: true, data: { ok: true } });
}

async function getDashboard(
  _request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send({ success: true, data: DASHBOARD_DATA });
}

async function getLearnerCourse(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params as { id: string };
  if (parseInt(id, 10) === 1) {
    await reply.status(200).send({ success: true, data: COURSE_1 });
    return;
  }
  await reply.status(404).send({ success: false, error: { message: 'Course not found' } });
}

async function completeModule(
  _request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.status(200).send({ success: true, data: { ok: true } });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function learnStubRoutes(http: HttpWrapper): Promise<void> {
  // Batch 2 — course player
  await http.get('/learn/dashboard', getDashboard);
  await http.get('/learn/courses/:id', getLearnerCourse);
  await http.post('/learn/courses/:id/modules/:moduleId/complete', completeModule);

  // Batch 3 — exam flow
  await http.get('/learn/assessments/:id/brief', getAssessmentBrief);
  await http.post('/learn/assessments/:id/attempts', startAttempt);
  await http.put('/learn/attempts/:id/answers/:questionId', saveAnswer);
  await http.post('/learn/attempts/:id/submit', submitAttempt);
  await http.get('/learn/attempts/:id/result', getAttemptResult);
  await http.post('/learn/attempts/:id/violations', logViolation);
}
