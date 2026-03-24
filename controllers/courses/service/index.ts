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
    query: CourseListQuery
  ): Promise<{ items: Course[]; total: number; page: number; limit: number }> {
    log.info({ query }, 'findAll courses');
    return this.repository.findAll(query);
  }

  async findById(id: number): Promise<Course | null> {
    log.info({ id }, 'findById course');
    return this.repository.findById(id);
  }

  async findByIdWithActivities(id: number): Promise<CourseWithActivities | null> {
    log.info({ id }, 'findByIdWithActivities');
    return this.repository.findByIdWithActivities(id);
  }

  async create(data: CreateCourseInput, createdBy: number): Promise<Course> {
    log.info({ createdBy }, 'create course');
    const result = await this.repository.create(data, createdBy);
    log.info({ id: result.id }, 'course created');
    return result;
  }

  async update(id: number, data: UpdateCourseInput): Promise<Course | null> {
    log.info({ id }, 'update course');
    const result = await this.repository.update(id, data);
    log.info({ id, found: result !== null }, 'course update complete');
    return result;
  }

  async remove(id: number): Promise<void> {
    log.info({ id }, 'remove course');
    await this.repository.remove(id);
    log.info({ id }, 'course removed');
  }

  async getActivities(courseId: number): Promise<Activity[]> {
    log.info({ courseId }, 'getActivities');
    return this.repository.findActivitiesByCourse(courseId);
  }

  async createActivity(courseId: number, data: CreateActivityInput): Promise<Activity> {
    log.info({ courseId }, 'createActivity');
    const result = await this.repository.createActivity(courseId, data);
    log.info({ actId: result.id, courseId }, 'activity created');
    return result;
  }

  async updateActivity(
    courseId: number,
    actId: number,
    data: UpdateActivityInput
  ): Promise<Activity | null> {
    log.info({ courseId, actId }, 'updateActivity');
    return this.repository.updateActivity(courseId, actId, data);
  }

  async removeActivity(courseId: number, actId: number): Promise<void> {
    log.info({ courseId, actId }, 'removeActivity');
    await this.repository.removeActivity(courseId, actId);
    log.info({ actId, courseId }, 'activity removed');
  }

  async reorderActivities(courseId: number, orderedIds: number[]): Promise<void> {
    log.info({ courseId, count: orderedIds.length }, 'reorderActivities');
    await this.repository.reorderActivities(courseId, orderedIds);
    log.info({ courseId }, 'reorder complete');
  }

  async getAssignments(courseId: number): Promise<CourseAssignment[]> {
    log.info({ courseId }, 'getAssignments');
    return this.repository.findAssignmentsByCourse(courseId);
  }

  async assignUser(
    courseId: number,
    userId: number,
    assignedBy: number,
    dueAt: string | undefined
  ): Promise<CourseAssignment> {
    log.info({ courseId, userId }, 'assignUser');
    const result = await this.repository.createAssignment(courseId, userId, assignedBy, dueAt);
    log.info({ courseId, userId }, 'user assigned');
    return result;
  }

  async unassignUser(courseId: number, userId: number): Promise<void> {
    log.info({ courseId, userId }, 'unassignUser');
    await this.repository.removeAssignment(courseId, userId);
    log.info({ courseId, userId }, 'user unassigned');
  }
}
