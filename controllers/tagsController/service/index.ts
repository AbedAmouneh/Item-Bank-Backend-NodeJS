import { createChildLogger } from '../../../utils/logger';
import { Tag, TagListQuery } from '../models';
import { CreateTagRequest, TagsRepository } from '../repository';

export class TagInUseError extends Error {
  readonly count: number;
  constructor(count: number) {
    super(`Tag is used by ${count} question(s)`);
    this.name = 'TagInUseError';
    this.count = count;
  }
}

const log = createChildLogger('tags-service');

export class TagsService {
  private repository: TagsRepository;

  constructor() {
    this.repository = new TagsRepository();
  }

  async findAll(
    query: TagListQuery
  ): Promise<{ items: Tag[]; total: number; page: number; limit: number }> {
    log.info({}, 'findAll tags');
    const result = await this.repository.findAll(query);
    log.info({ total: result.total, page: result.page }, 'findAll complete');
    return result;
  }

  async create(data: CreateTagRequest): Promise<Tag> {
    log.info({}, 'create tag');
    const normalizedSlug = data.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const result = await this.repository.create({ ...data, slug: normalizedSlug });
    log.info({ id: result.id }, 'tag created');
    return result;
  }

  async delete(id: number): Promise<void> {
    log.info({ id }, 'delete tag');
    const count = await this.repository.checkUsage(id);
    if (count > 0) throw new TagInUseError(count);
    await this.repository.delete(id);
    log.info({ id }, 'tag deleted');
  }
}
