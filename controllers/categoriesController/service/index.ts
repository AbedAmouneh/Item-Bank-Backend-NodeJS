import { createChildLogger } from '../../../utils/logger';
import { Category, CreateCategoryInput, FlatCategoryRow } from '../models';
import { CategoriesRepository } from '../repository';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

const log = createChildLogger('categories-service');

function buildTree(rows: FlatCategoryRow[]): Category[] {
  const map = new Map<number, Category>();
  for (const row of rows) {
    map.set(row.id, { id: row.id, name: row.name, children: [] });
  }
  const roots: Category[] = [];
  for (const row of rows) {
    const node = map.get(row.id);
    if (!node) continue;
    if (row.parent_id === null) {
      roots.push(node);
    } else {
      const parent = map.get(row.parent_id);
      if (parent) parent.children.push(node);
    }
  }
  return roots;
}

export class CategoriesService {
  private repository: CategoriesRepository;

  constructor() {
    this.repository = new CategoriesRepository();
  }

  async getTree(): Promise<Category[]> {
    log.info({}, 'getTree');
    const rows = await this.repository.findAll();
    return buildTree(rows);
  }

  async create(data: CreateCategoryInput, userId: number): Promise<Category> {
    log.info({ userId }, 'create category');
    const req = data.parent_id !== undefined
      ? { name: data.name, parent_id: data.parent_id, created_by: userId }
      : { name: data.name, created_by: userId };
    const row = await this.repository.create(req);
    log.info({ id: row.id }, 'category created');
    return { id: row.id, name: row.name, children: [] };
  }

  async update(id: number, name: string): Promise<Category> {
    log.info({ id }, 'update category');
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError(`Category ${id} not found`);
    const row = await this.repository.update(id, name);
    log.info({ id }, 'category updated');
    return { id: row.id, name: row.name, children: [] };
  }

  async delete(id: number): Promise<void> {
    log.info({ id }, 'delete category');
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError(`Category ${id} not found`);
    const [children, questions] = await Promise.all([
      this.repository.countChildren(id),
      this.repository.countAssignedQuestions(id),
    ]);
    if (children > 0) throw new ConflictError('Category has subcategories and cannot be deleted');
    if (questions > 0)
      throw new ConflictError('Category has assigned questions and cannot be deleted');
    await this.repository.delete(id);
    log.info({ id }, 'category deleted');
  }

  async assignQuestions(
    categoryId: number,
    questionIds: number[],
    userId: number,
    role: string
  ): Promise<void> {
    log.info({ categoryId, userId, role }, 'assignQuestions');
    if (role !== 'admin') {
      const owned = await this.repository.countOwnedQuestions(userId, questionIds);
      if (owned !== questionIds.length) {
        throw new ForbiddenError('You can only assign your own questions to a category');
      }
    }
    await this.repository.assignQuestions(categoryId, questionIds);
    log.info({ categoryId }, 'questions assigned');
  }

  async removeQuestion(
    categoryId: number,
    questionId: number,
    userId: number,
    role: string
  ): Promise<void> {
    log.info({ categoryId, questionId, userId, role }, 'removeQuestion');
    if (role !== 'admin') {
      const owned = await this.repository.countOwnedQuestions(userId, [questionId]);
      if (owned !== 1) {
        throw new ForbiddenError('You can only remove your own questions from a category');
      }
    }
    await this.repository.removeQuestion(categoryId, questionId);
    log.info({ categoryId, questionId }, 'question removed');
  }
}
