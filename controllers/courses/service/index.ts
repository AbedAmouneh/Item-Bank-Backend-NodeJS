import { createChildLogger } from '../../../utils/logger';
import {
  Activity,
  Course,
  CourseAssignment,
  CourseListQuery,
  CourseWithActivities,
  CreateActivityInput,
  CreateCourseInput,
  UpdateActivityInput,
  UpdateCourseInput,
} from '../models';
import { CoursesRepository } from '../repository';

const log = createChildLogger('courses-service');

export class CoursesService {
  private repository: CoursesRepository;

  constructor() {
    this.repository = new CoursesRepository();
  }

  async findAll(
    query: CourseListQuery,
    tenantId: number
  ): Promise<{ items: Course[]; total: number; page: number; limit: number }> {
    log.info({ query }, 'findAll courses');
    return this.repository.findAll(query, tenantId);
  }

  async findById(id: number, tenantId: number): Promise<Course | null> {
    log.info({ id }, 'findById course');
    return this.repository.findById(id, tenantId);
  }

  async findByIdWithActivities(id: number, tenantId: number): Promise<CourseWithActivities | null> {
    log.info({ id }, 'findByIdWithActivities');
    return this.repository.findByIdWithActivities(id, tenantId);
  }

  async create(data: CreateCourseInput, createdBy: number, tenantId: number): Promise<Course> {
    log.info({ createdBy }, 'create course');
    const result = await this.repository.create(data, createdBy, tenantId);
    log.info({ id: result.id }, 'course created');
    return result;
  }

  async update(id: number, data: UpdateCourseInput, tenantId: number): Promise<Course | null> {
    log.info({ id }, 'update course');
    const result = await this.repository.update(id, data, tenantId);
    log.info({ id, found: result !== null }, 'course update complete');
    return result;
  }

  async remove(id: number, tenantId: number): Promise<void> {
    log.info({ id }, 'remove course');
    await this.repository.remove(id, tenantId);
    log.info({ id }, 'course removed');
  }

  async getActivities(courseId: number, tenantId: number): Promise<Activity[]> {
    log.info({ courseId }, 'getActivities');
    return this.repository.findActivitiesByCourse(courseId, tenantId);
  }

  async createActivity(
    courseId: number,
    data: CreateActivityInput,
    tenantId: number
  ): Promise<Activity> {
    log.info({ courseId }, 'createActivity');
    const result = await this.repository.createActivity(courseId, data, tenantId);
    log.info({ actId: result.id, courseId }, 'activity created');
    return result;
  }

  async updateActivity(
    courseId: number,
    actId: number,
    data: UpdateActivityInput,
    tenantId: number
  ): Promise<Activity | null> {
    log.info({ courseId, actId }, 'updateActivity');
    return this.repository.updateActivity(courseId, actId, data, tenantId);
  }

  async removeActivity(courseId: number, actId: number, tenantId: number): Promise<void> {
    log.info({ courseId, actId }, 'removeActivity');
    await this.repository.removeActivity(courseId, actId, tenantId);
    log.info({ actId, courseId }, 'activity removed');
  }

  async reorderActivities(
    courseId: number,
    orderedIds: number[],
    tenantId: number
  ): Promise<void> {
    log.info({ courseId, count: orderedIds.length }, 'reorderActivities');
    await this.repository.reorderActivities(courseId, orderedIds, tenantId);
    log.info({ courseId }, 'reorder complete');
  }

  async getAssignments(courseId: number, tenantId: number): Promise<CourseAssignment[]> {
    log.info({ courseId }, 'getAssignments');
    return this.repository.findAssignmentsByCourse(courseId, tenantId);
  }

  async assignUser(
    courseId: number,
    userId: number,
    assignedBy: number,
    dueAt: string | undefined,
    tenantId: number
  ): Promise<CourseAssignment> {
    log.info({ courseId, userId }, 'assignUser');
    const result = await this.repository.createAssignment(courseId, userId, assignedBy, dueAt, tenantId);
    log.info({ courseId, userId }, 'user assigned');
    return result;
  }

  async unassignUser(courseId: number, userId: number, tenantId: number): Promise<void> {
    log.info({ courseId, userId }, 'unassignUser');
    await this.repository.removeAssignment(courseId, userId, tenantId);
    log.info({ courseId, userId }, 'user unassigned');
  }
}
