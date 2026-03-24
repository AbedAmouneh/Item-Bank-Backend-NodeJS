import { createChildLogger } from '../../../utils/logger';
import { Question, QuestionListQuery } from '../models';
import {
  CreateQuestionRequest,
  QuestionsRepository,
  UpdateQuestionRequest,
} from '../repository';

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

const log = createChildLogger('questions-service');

export class QuestionsService {
  private repository: QuestionsRepository;

  constructor() {
    this.repository = new QuestionsRepository();
  }

  async findAll(
    query: QuestionListQuery,
    userId: number,
    roles: string[],
    tenantId: number
  ): Promise<{ items: Question[]; total: number; page: number; limit: number }> {
    log.info({ userId, roles }, 'findAll questions');
    const result = await this.repository.findAll(query, userId, roles, tenantId);
    log.info({ total: result.total, page: result.page }, 'findAll complete');
    return result;
  }

  async findById(
    id: number,
    userId: number,
    roles: string[],
    tenantId: number
  ): Promise<Question | null> {
    log.info({ id, userId, roles }, 'findById question');
    const result = await this.repository.findById(id, userId, roles, tenantId);
    log.info({ id, found: result !== null }, 'findById complete');
    return result;
  }

  async create(
    data: CreateQuestionRequest,
    userId: number,
    roles: string[],
    tenantId: number
  ): Promise<Question> {
    log.info({ userId, roles }, 'create question');

    if (data.item_bank_id !== undefined) {
      await this.repository.checkItemBankAccess(data.item_bank_id, userId, roles);
    }

    const result = await this.repository.create(data, userId, tenantId);
    log.info({ id: result.id }, 'question created');
    return result;
  }

  async update(
    id: number,
    data: UpdateQuestionRequest,
    userId: number,
    roles: string[],
    tenantId: number
  ): Promise<Question> {
    log.info({ id, userId, roles }, 'update question');

    const existing = await this.repository.findById(id, userId, roles, tenantId);
    if (!existing) throw new Error('Question not found or access denied');

    if (existing.status === 'published' && !roles.includes('org_admin')) {
      throw new PermissionError('Only admins can update published questions');
    }

    const result = await this.repository.update(id, data, userId, roles, tenantId);
    log.info({ id }, 'question updated');
    return result;
  }

  async delete(id: number, userId: number, roles: string[], tenantId: number): Promise<void> {
    log.info({ id, userId, roles }, 'delete question');
    await this.repository.delete(id, userId, roles, tenantId);
    log.info({ id }, 'question deleted');
  }

  async submitForReview(id: number, userId: number): Promise<Question> {
    log.info({ id, userId }, 'submit question for review');
    const result = await this.repository.submitForReview(id, userId);
    log.info({ id }, 'question submitted for review');
    return result;
  }

  async publish(id: number, roles: string[], reviewerNotes?: string): Promise<Question> {
    log.info({ id, roles }, 'publish question');
    if (!roles.includes('org_admin')) {
      throw new PermissionError('Only admins can publish questions');
    }
    const result = await this.repository.publish(id, reviewerNotes);
    log.info({ id }, 'question published');
    return result;
  }

  async reject(id: number, note: string, roles: string[], reviewerNotes: string): Promise<Question> {
    log.info({ id, roles }, 'reject question');
    if (!roles.includes('org_admin')) {
      throw new PermissionError('Only admins can reject questions');
    }
    const result = await this.repository.reject(id, note, reviewerNotes);
    log.info({ id }, 'question rejected');
    return result;
  }

  async reorder(questionIds: number[], userId: number, roles: string[]): Promise<void> {
    log.info({ count: questionIds.length, userId, roles }, 'reorder questions');
    await this.repository.reorder(questionIds, userId, roles);
    log.info({ count: questionIds.length }, 'questions reordered');
  }
}
