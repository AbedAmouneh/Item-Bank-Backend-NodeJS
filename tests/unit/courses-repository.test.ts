import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PoolClient } from 'pg';

const queryMock = vi.fn();
const transactionMock = vi.fn();

vi.mock('../../platform/database/connection', () => ({
  db: {
    query: queryMock,
    transaction: transactionMock,
  },
}));

vi.mock('../../utils/logger', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Test Course',
    description: null,
    status: 'draft',
    thumbnail_url: null,
    created_by: 10,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    course_id: 1,
    type: 'quiz',
    title: 'Test Activity',
    description: null,
    position: 0,
    settings: { item_bank_id: 5 },
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    course_id: 1,
    user_id: 20,
    assigned_by: 10,
    assigned_at: new Date(),
    due_at: null,
    ...overrides,
  };
}

describe('CoursesRepository', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    transactionMock.mockReset();
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    test('returns paginated list without filters', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [makeCourse({ id: 1 }), makeCourse({ id: 2 })] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    test('applies status filter when provided', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeCourse({ status: 'published' })] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      await repo.findAll({ page: 1, limit: 20, status: 'published' });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('status = $');
      expect(countCall?.[1]).toContain('published');
    });

    test('applies search filter with ILIKE when provided', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [makeCourse()] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      await repo.findAll({ page: 1, limit: 20, search: 'math' });

      const [countCall] = queryMock.mock.calls;
      expect(countCall?.[0]).toContain('ILIKE');
      expect(countCall?.[1]).toContain('%math%');
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    test('returns course row when found', async () => {
      const course = makeCourse();
      queryMock.mockResolvedValueOnce({ rows: [course] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.findById(1);

      expect(result).toEqual(course);
      const [call] = queryMock.mock.calls;
      expect(call?.[1]).toEqual([1]);
    });

    test('returns null when not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.findById(999);

      expect(result).toBeNull();
    });
  });

  // ── findByIdWithActivities ─────────────────────────────────────────────────

  describe('findByIdWithActivities', () => {
    test('returns null when course not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.findByIdWithActivities(999);

      expect(result).toBeNull();
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    test('returns course with activities array', async () => {
      const course = makeCourse();
      const activities = [makeActivity({ position: 0 }), makeActivity({ id: 2, position: 1 })];
      queryMock
        .mockResolvedValueOnce({ rows: [course] })
        .mockResolvedValueOnce({ rows: activities });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.findByIdWithActivities(1);

      expect(result).not.toBeNull();
      expect(result?.activities).toHaveLength(2);
      expect(result?.title).toBe('Test Course');
    });

    test('returns course with empty activities array when none exist', async () => {
      queryMock
        .mockResolvedValueOnce({ rows: [makeCourse()] })
        .mockResolvedValueOnce({ rows: [] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.findByIdWithActivities(1);

      expect(result?.activities).toEqual([]);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    test('inserts course and returns the created row', async () => {
      const dbRow = makeCourse();
      queryMock.mockResolvedValueOnce({ rows: [dbRow] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.create(
        { title: 'Test Course', status: 'draft' },
        10
      );

      expect(result.title).toBe('Test Course');
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('INSERT INTO courses');
      expect(call?.[1]).toContain(10); // created_by
    });

    test('throws when INSERT returns no rows', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();

      await expect(
        repo.create({ title: 'Test', status: 'draft' }, 10)
      ).rejects.toThrow('Failed to create course');
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    test('runs UPDATE and re-fetches the updated row', async () => {
      const existing = makeCourse();
      const updated = makeCourse({ title: 'New Title' });
      queryMock
        .mockResolvedValueOnce({ rows: [existing] })  // findById
        .mockResolvedValueOnce({ rowCount: 1 })        // UPDATE
        .mockResolvedValueOnce({ rows: [updated] });   // re-fetch

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.update(1, { title: 'New Title' });

      expect(result?.title).toBe('New Title');
      expect(queryMock).toHaveBeenCalledTimes(3);
    });

    test('returns null when course does not exist', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] }); // findById returns nothing

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.update(999, { title: 'X' });

      expect(result).toBeNull();
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    test('issues DELETE query for the given id', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      await repo.remove(1);

      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('DELETE FROM courses');
      expect(call?.[1]).toEqual([1]);
    });
  });

  // ── findActivitiesByCourse ─────────────────────────────────────────────────

  describe('findActivitiesByCourse', () => {
    test('returns activities ordered by position', async () => {
      const activities = [makeActivity({ position: 0 }), makeActivity({ id: 2, position: 1 })];
      queryMock.mockResolvedValueOnce({ rows: activities });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.findActivitiesByCourse(1);

      expect(result).toHaveLength(2);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('ORDER BY position');
      expect(call?.[1]).toEqual([1]);
    });
  });

  // ── createActivity ─────────────────────────────────────────────────────────

  describe('createActivity', () => {
    test('inserts activity and returns created row', async () => {
      const dbRow = makeActivity();
      queryMock.mockResolvedValueOnce({ rows: [dbRow] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.createActivity(1, {
        type: 'quiz',
        title: 'Test Activity',
        position: 0,
        settings: { item_bank_id: 5 },
      });

      expect(result.title).toBe('Test Activity');
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('INSERT INTO activities');
    });

    test('throws when INSERT returns no rows', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();

      await expect(
        repo.createActivity(1, {
          type: 'quiz',
          title: 'Test',
          position: 0,
          settings: { item_bank_id: 5 },
        })
      ).rejects.toThrow('Failed to create activity');
    });
  });

  // ── updateActivity ─────────────────────────────────────────────────────────

  describe('updateActivity', () => {
    test('runs UPDATE and returns updated activity', async () => {
      const existing = makeActivity();
      const updated = makeActivity({ title: 'Updated' });
      queryMock
        .mockResolvedValueOnce({ rows: [existing] })  // findActivityById
        .mockResolvedValueOnce({ rowCount: 1 })        // UPDATE
        .mockResolvedValueOnce({ rows: [updated] });   // re-fetch

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.updateActivity(1, 1, { title: 'Updated' });

      expect(result?.title).toBe('Updated');
      // Verify the pre-check fetched with the correct course scope
      const findCall = queryMock.mock.calls[0];
      expect(findCall?.[1]).toEqual([1, 1]); // actId=1, courseId=1
    });

    test('returns null when activity not found', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.updateActivity(1, 999, { title: 'X' });

      expect(result).toBeNull();
    });
  });

  // ── removeActivity ─────────────────────────────────────────────────────────

  describe('removeActivity', () => {
    test('deletes activity by id and courseId', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      await repo.removeActivity(1, 5);

      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('DELETE FROM activities');
      expect(call?.[1]).toEqual([5, 1]); // actId, courseId
    });
  });

  // ── reorderActivities ─────────────────────────────────────────────────────

  describe('reorderActivities', () => {
    test('calls transaction and maps each activity to its new position', async () => {
      const clientQueryMock = vi.fn().mockResolvedValue({ rowCount: 1 });
      transactionMock.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb({ query: clientQueryMock } as unknown as PoolClient);
        }
      );

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      await repo.reorderActivities(1, [3, 1, 2]);

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(clientQueryMock).toHaveBeenCalledTimes(3);

      const calls = clientQueryMock.mock.calls.map((c: unknown[]) => c[1]);
      expect(calls).toContainEqual([0, 3, 1]); // actId=3 → position=0
      expect(calls).toContainEqual([1, 1, 1]); // actId=1 → position=1
      expect(calls).toContainEqual([2, 2, 1]); // actId=2 → position=2
    });
  });

  // ── findAssignmentsByCourse ────────────────────────────────────────────────

  describe('findAssignmentsByCourse', () => {
    test('returns list of assignments for the course', async () => {
      const assignments = [makeAssignment(), makeAssignment({ id: 2, user_id: 21 })];
      queryMock.mockResolvedValueOnce({ rows: assignments });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.findAssignmentsByCourse(1);

      expect(result).toHaveLength(2);
      const [call] = queryMock.mock.calls;
      expect(call?.[1]).toEqual([1]);
    });
  });

  // ── createAssignment ──────────────────────────────────────────────────────

  describe('createAssignment', () => {
    test('inserts and returns the assignment', async () => {
      const dbRow = makeAssignment();
      queryMock.mockResolvedValueOnce({ rows: [dbRow] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      const result = await repo.createAssignment(1, 20, 10, undefined);

      expect(result.user_id).toBe(20);
      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('INSERT INTO course_assignments');
    });

    test('throws when INSERT returns no rows', async () => {
      queryMock.mockResolvedValueOnce({ rows: [] });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();

      await expect(repo.createAssignment(1, 20, 10, undefined)).rejects.toThrow(
        'Failed to create assignment'
      );
    });
  });

  // ── removeAssignment ──────────────────────────────────────────────────────

  describe('removeAssignment', () => {
    test('deletes assignment by courseId and userId', async () => {
      queryMock.mockResolvedValueOnce({ rowCount: 1 });

      const { CoursesRepository } = await import('../../controllers/courses/repository');
      const repo = new CoursesRepository();
      await repo.removeAssignment(1, 20);

      const [call] = queryMock.mock.calls;
      expect(call?.[0]).toContain('DELETE FROM course_assignments');
      expect(call?.[1]).toEqual([1, 20]);
    });
  });
});
