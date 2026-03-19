import { createChildLogger } from '../../../utils/logger';
import { Tag, TagListQuery } from '../models';
import { CreateTagRequest, TagsRepository } from '../repository';

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
    const result = await this.repository.create(data);
    log.info({ id: result.id }, 'tag created');
    return result;
  }
}
