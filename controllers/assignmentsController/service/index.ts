// controllers/assignmentsController/service/index.ts
import { createChildLogger } from '../../../utils/logger';
import { scoreAnswer } from '../../assessmentsController/service';
import {
  AssignmentDetail,
  AssignmentSubmission,
  AssignUsersInput,
  CreateAssignmentInput,
  GradeSubmissionInput,
  ListAssignmentsQuery,
  SaveSubmissionInput,
  SubmissionDetail,
  UpdateAssignmentInput,
} from '../models';
import { AssignmentsRepository } from '../repository';

const log = createChildLogger('assignments-service');

// ─── Errors ──────────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AssignmentsService {
  private repository: AssignmentsRepository;

  constructor() {
    this.repository = new AssignmentsRepository();
  }

  async listAssignments(
    tenantId: number,
    userId: number,
    roles: string[],
    query: ListAssignmentsQuery,
  ): Promise<{ items: AssignmentDetail[]; total: number; page: number; limit: number }> {
    log.info({ tenantId, userId }, 'listAssignments');
    return this.repository.findAll(tenantId, userId, roles, query) as unknown as Promise<{ items: AssignmentDetail[]; total: number; page: number; limit: number }>;
  }

  async getAssignment(id: number, tenantId: number): Promise<AssignmentDetail> {
    const assignment = await this.repository.findById(id, tenantId);
    if (!assignment) throw new NotFoundError('Assignment');
    return assignment;
  }

  async createAssignment(
    data: CreateAssignmentInput,
    createdBy: number,
    tenantId: number,
  ): Promise<AssignmentDetail> {
    log.info({ tenantId, createdBy }, 'createAssignment');
    return this.repository.create(data, createdBy, tenantId);
  }

  async updateAssignment(
    id: number,
    data: UpdateAssignmentInput,
    tenantId: number,
  ): Promise<AssignmentDetail> {
    const result = await this.repository.update(id, data, tenantId);
    if (!result) throw new NotFoundError('Assignment');
    return result;
  }

  async deleteAssignment(id: number, tenantId: number): Promise<void> {
    const archived = await this.repository.archive(id, tenantId);
    if (!archived) throw new NotFoundError('Assignment');
  }

  async assignUsers(
    assignmentId: number,
    data: AssignUsersInput,
    assignedBy: number,
    tenantId: number,
  ): Promise<void> {
    const assignment = await this.repository.findById(assignmentId, tenantId);
    if (!assignment) throw new NotFoundError('Assignment');
    log.info({ assignmentId, count: data.user_ids.length }, 'assignUsers');
    await this.repository.assignUsers(assignmentId, data.user_ids, assignedBy);
  }

  async unassignUser(assignmentId: number, userId: number, _tenantId: number): Promise<void> {
    const removed = await this.repository.unassignUser(assignmentId, userId);
    if (!removed) throw new NotFoundError('User assignment');
  }

  async listSubmissions(
    assignmentId: number,
    userId: number,
    roles: string[],
    tenantId: number,
  ): Promise<AssignmentSubmission[]> {
    const assignment = await this.repository.findById(assignmentId, tenantId);
    if (!assignment) throw new NotFoundError('Assignment');
    return this.repository.findSubmissions(assignmentId, tenantId, userId, roles);
  }

  async getSubmission(
    subId: number,
    assignmentId: number,
    userId: number,
    roles: string[],
    tenantId: number,
  ): Promise<SubmissionDetail> {
    const submission = await this.repository.findSubmissionById(subId, assignmentId, tenantId);
    if (!submission) throw new NotFoundError('Submission');
    const isLearner = !roles.includes('teacher') && !roles.includes('org_admin');
    if (isLearner && submission.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }
    return submission;
  }

  async saveOrSubmit(
    assignmentId: number,
    userId: number,
    tenantId: number,
    data: SaveSubmissionInput,
  ): Promise<SubmissionDetail> {
    const assignment = await this.repository.findById(assignmentId, tenantId);
    if (!assignment) throw new NotFoundError('Assignment');

    const existing = await this.repository.findSubmissionByUser(assignmentId, userId);
    if (data.action === 'submit' && existing && existing.status !== 'draft') {
      throw new ConflictError('Submission already submitted');
    }

    const status = data.action === 'submit' ? 'submitted' : 'draft';
    const submittedAt = data.action === 'submit' ? new Date() : null;
    const submission = await this.repository.upsertSubmission(assignmentId, userId, tenantId, status, submittedAt);

    // Build map of question components for auto-grading on submit
    const questionComponents = assignment.components.filter(
      (c) => c.type === 'question' && c.question_id !== null,
    );
    const questionIds = questionComponents.map((c) => c.question_id as number);
    const questions = await this.repository.findQuestionsByIds(questionIds);
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const componentToQuestion = new Map(
      questionComponents.map((c) => [c.id, c.question_id as number]),
    );

    for (const response of data.responses) {
      let isCorrect: boolean | null = null;

      if (data.action === 'submit') {
        const questionId = componentToQuestion.get(response.component_id);
        if (questionId !== undefined && response.question_answer !== undefined) {
          const question = questionMap.get(questionId);
          if (question) {
            const scored = scoreAnswer(question.type, question.content, response.question_answer);
            isCorrect = scored.isCorrect;
          }
        }
      }

      const responseData: {
        text_answer?: string;
        file_url?: string;
        url_answer?: string;
        question_answer?: Record<string, unknown>;
        is_correct?: boolean | null;
      } = { is_correct: isCorrect };
      if (response.text_answer !== undefined) responseData.text_answer = response.text_answer;
      if (response.file_url !== undefined) responseData.file_url = response.file_url;
      if (response.url_answer !== undefined) responseData.url_answer = response.url_answer;
      if (response.question_answer !== undefined) responseData.question_answer = response.question_answer;
      await this.repository.upsertResponse(submission.id, response.component_id, responseData);
    }

    log.info({ submissionId: submission.id, action: data.action }, 'saveOrSubmit');
    const detail = await this.repository.findSubmissionById(submission.id, assignmentId, tenantId);
    if (!detail) throw new Error('Failed to retrieve submission');
    return detail;
  }

  async gradeSubmission(
    subId: number,
    assignmentId: number,
    gradedBy: number,
    tenantId: number,
    data: GradeSubmissionInput,
  ): Promise<SubmissionDetail> {
    const submission = await this.repository.findSubmissionById(subId, assignmentId, tenantId);
    if (!submission) throw new NotFoundError('Submission');
    if (submission.status === 'draft') {
      throw new ConflictError('Cannot grade a draft submission');
    }

    const grade = await this.repository.upsertGrade(subId, gradedBy, data.overall_feedback);
    for (const cg of data.component_grades) {
      await this.repository.upsertComponentGrade(grade.id, cg.component_id, cg.points_awarded, cg.comment);
    }

    const totalScore = data.component_grades.reduce((sum, cg) => sum + cg.points_awarded, 0);
    await this.repository.updateSubmissionScore(subId, totalScore);

    log.info({ submissionId: subId, totalScore, gradedBy }, 'gradeSubmission');
    const detail = await this.repository.findSubmissionById(subId, assignmentId, tenantId);
    if (!detail) throw new Error('Failed to retrieve submission after grading');
    return detail;
  }
}
