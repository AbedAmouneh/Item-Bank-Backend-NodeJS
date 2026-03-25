import { PoolClient } from 'pg';

import { db } from '../../../platform/database/connection';
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

const log = createChildLogger('courses-repository');

export class CoursesRepository {
  // ── Courses ──────────────────────────────────────────────────────────────

  async findAll(
    query: CourseListQuery,
    tenantId: number
  ): Promise<{ items: Course[]; total: number; page: number; limit: number }> {
    const { page, limit, search, status } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [tenantId];
    let idx = 2;

    conditions.push(`c.tenant_id = $1`);

    if (status !== undefined) {
      conditions.push(`c.status = $${idx++}`);
      params.push(status);
    }

    if (search !== undefined) {
      conditions.push(`c.title ILIKE $${idx++}`);
      params.push(`%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM courses c ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataResult = await db.query<Course>(
      `SELECT c.*
       FROM courses c
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    log.debug({ page, limit, total }, 'findAll courses');
    return { items: dataResult.rows, total, page, limit };
  }

  async findById(id: number, tenantId: number): Promise<Course | null> {
    const result = await db.query<Course>(
      'SELECT * FROM courses WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] ?? null;
  }

  async findByIdWithActivities(id: number, tenantId: number): Promise<CourseWithActivities | null> {
    const courseResult = await db.query<Course>(
      'SELECT * FROM courses WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    const course = courseResult.rows[0];
    if (!course) return null;

    const activitiesResult = await db.query<Activity>(
      'SELECT * FROM activities WHERE course_id = $1 AND tenant_id = $2 ORDER BY position ASC',
      [id, tenantId]
    );

    return { ...course, activities: activitiesResult.rows };
  }

  async create(data: CreateCourseInput, createdBy: number, tenantId: number): Promise<Course> {
    const result = await db.query<Course>(
      `INSERT INTO courses (title, description, status, thumbnail_url, created_by, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.title,
        data.description ?? null,
        data.status ?? 'draft',
        data.thumbnail_url ?? null,
        createdBy,
        tenantId,
      ]
    );

    const course = result.rows[0];
    if (!course) throw new Error('Failed to create course');

    log.info({ id: course.id, createdBy }, 'Course created');
    return course;
  }

  async update(id: number, data: UpdateCourseInput, tenantId: number): Promise<Course | null> {
    const existing = await this.findById(id, tenantId);
    if (!existing) return null;

    const fields: Record<string, unknown> = {};
    if (data.title !== undefined) fields['title'] = data.title;
    if (data.description !== undefined) fields['description'] = data.description;
    if (data.status !== undefined) fields['status'] = data.status;
    if (data.thumbnail_url !== undefined) fields['thumbnail_url'] = data.thumbnail_url;

    if (Object.keys(fields).length > 0) {
      const setClauses = Object.keys(fields).map((col, i) => `${col} = $${i + 2}`);
      setClauses.push(`updated_at = NOW()`);
      await db.query(
        `UPDATE courses SET ${setClauses.join(', ')} WHERE id = $1`,
        [id, ...Object.values(fields)]
      );
    }

    const updated = await this.findById(id, tenantId);
    log.info({ id }, 'Course updated');
    return updated;
  }

  async remove(id: number, tenantId: number): Promise<void> {
    await db.query('DELETE FROM courses WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    log.info({ id }, 'Course deleted');
  }

  // ── Activities ────────────────────────────────────────────────────────────

  async findActivitiesByCourse(courseId: number, tenantId: number): Promise<Activity[]> {
    const result = await db.query<Activity>(
      'SELECT * FROM activities WHERE course_id = $1 AND tenant_id = $2 ORDER BY position ASC',
      [courseId, tenantId]
    );
    return result.rows;
  }

  private async findActivityById(
    actId: number,
    courseId: number,
    tenantId: number
  ): Promise<Activity | null> {
    const result = await db.query<Activity>(
      'SELECT * FROM activities WHERE id = $1 AND course_id = $2 AND tenant_id = $3',
      [actId, courseId, tenantId]
    );
    return result.rows[0] ?? null;
  }

  async createActivity(
    courseId: number,
    data: CreateActivityInput,
    tenantId: number
  ): Promise<Activity> {
    const result = await db.query<Activity>(
      `INSERT INTO activities (course_id, type, title, description, position, settings, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        courseId,
        data.type,
        data.title,
        data.description ?? null,
        data.position,
        JSON.stringify(data.settings),
        tenantId,
      ]
    );

    const activity = result.rows[0];
    if (!activity) throw new Error('Failed to create activity');

    log.info({ id: activity.id, courseId }, 'Activity created');
    return activity;
  }

  async updateActivity(
    courseId: number,
    actId: number,
    data: UpdateActivityInput,
    tenantId: number
  ): Promise<Activity | null> {
    const existing = await this.findActivityById(actId, courseId, tenantId);
    if (!existing) return null;

    const fields: Record<string, unknown> = {};
    if (data.title !== undefined) fields['title'] = data.title;
    if (data.description !== undefined) fields['description'] = data.description;
    if (data.position !== undefined) fields['position'] = data.position;
    if (data.settings !== undefined) fields['settings'] = JSON.stringify(data.settings);

    if (Object.keys(fields).length > 0) {
      const setClauses = Object.keys(fields).map((col, i) => `${col} = $${i + 2}`);
      setClauses.push(`updated_at = NOW()`);
      await db.query(
        `UPDATE activities SET ${setClauses.join(', ')} WHERE id = $1`,
        [actId, ...Object.values(fields)]
      );
    }

    const updated = await this.findActivityById(actId, courseId, tenantId);
    log.info({ actId, courseId }, 'Activity updated');
    return updated;
  }

  async removeActivity(courseId: number, actId: number, tenantId: number): Promise<void> {
    await db.query(
      'DELETE FROM activities WHERE id = $1 AND course_id = $2 AND tenant_id = $3',
      [actId, courseId, tenantId]
    );
    log.info({ actId, courseId }, 'Activity deleted');
  }

  async reorderActivities(
    courseId: number,
    orderedIds: number[],
    tenantId: number
  ): Promise<void> {
    await db.transaction(async (client: PoolClient) => {
      await Promise.all(
        orderedIds.map((actId, position) =>
          client.query(
            'UPDATE activities SET position = $1, updated_at = NOW() WHERE id = $2 AND course_id = $3 AND tenant_id = $4',
            [position, actId, courseId, tenantId]
          )
        )
      );
    });
    log.info({ courseId, count: orderedIds.length }, 'Activities reordered');
  }

  // ── Assignments ───────────────────────────────────────────────────────────

  async findAssignmentsByCourse(courseId: number, tenantId: number): Promise<CourseAssignment[]> {
    const result = await db.query<CourseAssignment>(
      `SELECT
         ca.id,
         ca.course_id,
         ca.user_id,
         ca.assigned_by,
         ca.assigned_at,
         ca.due_at AS due_date,
         json_build_object(
           'id',    u.id,
           'name',  COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.email),
           'email', u.email
         ) AS user
       FROM course_assignments ca
       JOIN users u ON u.id = ca.user_id
       WHERE ca.course_id = $1 AND ca.tenant_id = $2
       ORDER BY ca.assigned_at DESC`,
      [courseId, tenantId]
    );
    return result.rows;
  }

  async createAssignment(
    courseId: number,
    userId: number,
    assignedBy: number,
    dueAt: string | undefined,
    tenantId: number
  ): Promise<CourseAssignment> {
    const result = await db.query<CourseAssignment>(
      `WITH inserted AS (
         INSERT INTO course_assignments (course_id, user_id, assigned_by, due_at, tenant_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *
       )
       SELECT
         ca.id,
         ca.course_id,
         ca.user_id,
         ca.assigned_by,
         ca.assigned_at,
         ca.due_at AS due_date,
         json_build_object(
           'id',    u.id,
           'name',  COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.email),
           'email', u.email
         ) AS user
       FROM inserted ca
       JOIN users u ON u.id = ca.user_id`,
      [courseId, userId, assignedBy, dueAt ?? null, tenantId]
    );

    const assignment = result.rows[0];
    if (!assignment) throw new Error('Failed to create assignment');

    log.info({ courseId, userId }, 'Assignment created');
    return assignment;
  }

  async removeAssignment(courseId: number, userId: number, tenantId: number): Promise<void> {
    await db.query(
      'DELETE FROM course_assignments WHERE course_id = $1 AND user_id = $2 AND tenant_id = $3',
      [courseId, userId, tenantId]
    );
    log.info({ courseId, userId }, 'Assignment removed');
  }
}
