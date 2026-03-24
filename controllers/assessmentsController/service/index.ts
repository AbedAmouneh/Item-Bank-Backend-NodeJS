// controllers/assessmentsController/service/index.ts
import { createChildLogger } from '../../../utils/logger';
import { AssessmentsRepository } from '../repository';
import type {
  AddToPoolInput,
  Assessment,
  AssessmentPoolQuestion,
  Attempt,
  AttemptAnswer,
  CreateAssessmentInput,
  ListAssessmentsQuery,
  UpdateAssessmentInput,
} from '../models';

const log = createChildLogger('assessments-service');

// ─── Custom errors ───────────────────────────────────────────────────────────
// Handlers check `instanceof` to decide which HTTP status code to return.

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class MaxAttemptsError extends Error {
  constructor() {
    super('Maximum number of attempts reached');
    this.name = 'MaxAttemptsError';
  }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────
// scoreAnswer is a pure function: given a question type, its stored content
// (correct answers), and the learner's answer, return whether it is correct
// and how many points to award.
//
// Auto-gradable types: true_false, multiple_choice, numerical.
// All other types (essay, short_answer, etc.) return isCorrect=null and 0 pts,
// flagging them for manual review.

const AUTO_GRADABLE = new Set(['true_false', 'multiple_choice', 'numerical']);

interface ScoreResult {
  isCorrect: boolean | null;
  pointsAwarded: number;
}

export function scoreAnswer(
  questionType: string,
  content: Record<string, unknown>,
  answer: Record<string, unknown>,
): ScoreResult {
  if (!AUTO_GRADABLE.has(questionType)) {
    return { isCorrect: null, pointsAwarded: 0 };
  }

  switch (questionType) {
    case 'true_false': {
      const correct = content['correct_answer'];
      const given = answer['value'];
      const isCorrect = correct === given;
      return { isCorrect, pointsAwarded: isCorrect ? 1 : 0 };
    }

    case 'multiple_choice': {
      const correct = content['correct_answer'];
      const given = answer['selected'];
      let isCorrect = false;
      if (Array.isArray(correct) && Array.isArray(given)) {
        // multi-select: order-insensitive comparison
        isCorrect =
          correct.length === given.length &&
          [...correct].map(String).sort().join(',') ===
            [...(given as unknown[])].map(String).sort().join(',');
      } else {
        isCorrect = String(correct) === String(given);
      }
      return { isCorrect, pointsAwarded: isCorrect ? 1 : 0 };
    }

    case 'numerical': {
      const correct = Number(content['correct_answer']);
      const tolerance = Number(content['tolerance'] ?? 0);
      const given = Number(answer['value']);
      if (isNaN(given)) return { isCorrect: false, pointsAwarded: 0 };
      const isCorrect = Math.abs(given - correct) <= tolerance;
      return { isCorrect, pointsAwarded: isCorrect ? 1 : 0 };
    }

    default:
      return { isCorrect: null, pointsAwarded: 0 };
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AssessmentsService {
  private repository: AssessmentsRepository;

  constructor() {
    this.repository = new AssessmentsRepository();
  }

  async listAssessments(
    tenantId: number,
    query: ListAssessmentsQuery,
  ): Promise<{ items: Assessment[]; total: number; page: number; limit: number }> {
    log.info({ tenantId }, 'listAssessments');
    return this.repository.findAll(tenantId, query);
  }

  async getAssessment(id: number, tenantId: number): Promise<Assessment> {
    const assessment = await this.repository.findById(id, tenantId);
    if (!assessment) throw new NotFoundError('Assessment');
    return assessment;
  }

  async createAssessment(
    data: CreateAssessmentInput,
    createdBy: number,
    tenantId: number,
  ): Promise<Assessment> {
    log.info({ tenantId, createdBy }, 'createAssessment');
    return this.repository.create(data, createdBy, tenantId);
  }

  async updateAssessment(
    id: number,
    data: UpdateAssessmentInput,
    tenantId: number,
  ): Promise<Assessment> {
    const assessment = await this.repository.update(id, data, tenantId);
    if (!assessment) throw new NotFoundError('Assessment');
    return assessment;
  }

  async archiveAssessment(id: number, tenantId: number): Promise<void> {
    const found = await this.repository.archive(id, tenantId);
    if (!found) throw new NotFoundError('Assessment');
  }

  async getPool(assessmentId: number, tenantId: number): Promise<AssessmentPoolQuestion[]> {
    const assessment = await this.repository.findById(assessmentId, tenantId);
    if (!assessment) throw new NotFoundError('Assessment');
    return this.repository.getPool(assessmentId, tenantId);
  }

  async addToPool(
    assessmentId: number,
    input: AddToPoolInput,
    tenantId: number,
  ): Promise<void> {
    const assessment = await this.repository.findById(assessmentId, tenantId);
    if (!assessment) throw new NotFoundError('Assessment');
    await this.repository.addToPool(assessmentId, input.question_ids);
  }

  async removeFromPool(
    assessmentId: number,
    questionId: number,
    tenantId: number,
  ): Promise<void> {
    const assessment = await this.repository.findById(assessmentId, tenantId);
    if (!assessment) throw new NotFoundError('Assessment');
    const removed = await this.repository.removeFromPool(assessmentId, questionId);
    if (!removed) throw new NotFoundError('Question in pool');
  }

  async startAttempt(
    assessmentId: number,
    userId: number,
    tenantId: number,
  ): Promise<Attempt> {
    const assessment = await this.repository.findById(assessmentId, tenantId);
    if (!assessment) throw new NotFoundError('Assessment');
    if (assessment.status !== 'published') {
      throw new ConflictError('Assessment is not published');
    }

    const attemptCount = await this.repository.countAttempts(assessmentId, userId);
    if (attemptCount >= assessment.max_attempts) throw new MaxAttemptsError();

    const deadlineAt = assessment.time_limit_mins
      ? new Date(Date.now() + assessment.time_limit_mins * 60 * 1000)
      : null;

    const attempt = await this.repository.createAttempt(
      assessmentId,
      userId,
      tenantId,
      attemptCount + 1,
      deadlineAt,
    );

    const questionIds = await this.repository.drawQuestions(
      assessmentId,
      assessment.question_count,
      assessment.randomize_questions,
    );
    await this.repository.insertAttemptQuestions(attempt.id, questionIds);

    log.info({ attemptId: attempt.id, userId, questionCount: questionIds.length }, 'Attempt started');
    return attempt;
  }

  async saveAnswer(
    attemptId: number,
    userId: number,
    tenantId: number,
    questionId: number,
    answer: Record<string, unknown>,
  ): Promise<void> {
    const attempt = await this.repository.getAttempt(attemptId, userId, tenantId);
    if (!attempt) throw new NotFoundError('Attempt');
    if (attempt.status !== 'in_progress') {
      throw new ConflictError('Attempt is not in progress');
    }
    const inAttempt = await this.repository.isQuestionInAttempt(attemptId, questionId);
    if (!inAttempt) throw new NotFoundError('Question in attempt');
    await this.repository.upsertAnswer(attemptId, questionId, answer);
  }

  async submitAttempt(
    attemptId: number,
    userId: number,
    tenantId: number,
  ): Promise<Attempt> {
    const attempt = await this.repository.getAttempt(attemptId, userId, tenantId);
    if (!attempt) throw new NotFoundError('Attempt');
    if (attempt.status !== 'in_progress') {
      throw new ConflictError('Attempt is not in progress');
    }

    const assessment = await this.repository.findById(attempt.assessment_id, tenantId);
    if (!assessment) throw new NotFoundError('Assessment');

    const questions = await this.repository.getAttemptQuestionsWithContent(attemptId);
    const existingAnswers = await this.repository.getAttemptAnswers(attemptId);
    const answerMap = new Map(existingAnswers.map(a => [a.question_id, a]));

    let totalPoints = 0;
    let earnedPoints = 0;

    const scores: Array<{
      questionId: number;
      isCorrect: boolean | null;
      pointsAwarded: number;
    }> = [];

    for (const q of questions) {
      totalPoints += 1; // 1 point per question
      const existingAnswer = answerMap.get(q.question_id);
      const answerData = existingAnswer?.answer ?? {};
      const scored = scoreAnswer(q.type, q.content, answerData);
      earnedPoints += scored.pointsAwarded;
      scores.push({ questionId: q.question_id, ...scored });
    }

    const scorePercent = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = scorePercent >= parseFloat(assessment.passing_score_percent);

    return this.repository.finalizeAttempt(attemptId, scores, scorePercent, passed);
  }

  async getResult(
    attemptId: number,
    userId: number,
    tenantId: number,
  ): Promise<{
    attempt: Attempt;
    answers: AttemptAnswer[];
    total_questions: number;
  }> {
    const result = await this.repository.getAttemptResult(attemptId, userId, tenantId);
    if (!result) throw new NotFoundError('Attempt');
    if (result.attempt.status !== 'submitted') {
      throw new ConflictError('Attempt has not been submitted yet');
    }
    return result;
  }

  async logViolation(
    attemptId: number,
    userId: number,
    tenantId: number,
    violationType: string,
  ): Promise<void> {
    const attempt = await this.repository.getAttempt(attemptId, userId, tenantId);
    if (!attempt) throw new NotFoundError('Attempt');
    await this.repository.logViolation(attemptId, violationType);
  }
}
