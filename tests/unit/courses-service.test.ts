import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
  findAllMock,
  findByIdMock,
  findByIdWithActivitiesMock,
  createMock,
  updateMock,
  removeMock,
  findActivitiesByCourse,
  createActivityMock,
  updateActivityMock,
  removeActivityMock,
  reorderActivitiesMock,
  findAssignmentsByCourse,
  createAssignmentMock,
  removeAssignmentMock,
} = vi.hoisted(() => ({
  findAllMock: vi.fn(),
  findByIdMock: vi.fn(),
  findByIdWithActivitiesMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  removeMock: vi.fn(),
  findActivitiesByCourse: vi.fn(),
  createActivityMock: vi.fn(),
  updateActivityMock: vi.fn(),
  removeActivityMock: vi.fn(),
  reorderActivitiesMock: vi.fn(),
  findAssignmentsByCourse: vi.fn(),
  createAssignmentMock: vi.fn(),
  removeAssignmentMock: vi.fn(),
}));

vi.mock('../../controllers/courses/repository', () => ({
  CoursesRepository: function () {
    return {
      findAll: findAllMock,
      findById: findByIdMock,
      findByIdWithActivities: findByIdWithActivitiesMock,
      create: createMock,
      update: updateMock,
      remove: removeMock,
      findActivitiesByCourse,
      createActivity: createActivityMock,
      updateActivity: updateActivityMock,
      removeActivity: removeActivityMock,
      reorderActivities: reorderActivitiesMock,
      findAssignmentsByCourse,
      createAssignment: createAssignmentMock,
      removeAssignment: removeAssignmentMock,
    };
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

describe('CoursesService', () => {
  let service: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    const { CoursesService } = await import('../../controllers/courses/service');
    service = new CoursesService();
  });

  test('findAll delegates to repository', async () => {
    const page = { items: [], total: 0, page: 1, limit: 20 };
    findAllMock.mockResolvedValue(page);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result).toEqual(page);
    expect(findAllMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  test('findById returns course from repository', async () => {
    const course = { id: 1, title: 'Test' };
    findByIdMock.mockResolvedValue(course);

    const result = await service.findById(1);

    expect(result).toEqual(course);
  });

  test('findById returns null when not found', async () => {
    findByIdMock.mockResolvedValue(null);

    const result = await service.findById(999);

    expect(result).toBeNull();
  });

  test('findByIdWithActivities delegates to repository', async () => {
    const courseWithActs = { id: 1, title: 'Test', activities: [] };
    findByIdWithActivitiesMock.mockResolvedValue(courseWithActs);

    const result = await service.findByIdWithActivities(1);

    expect(result).toEqual(courseWithActs);
  });

  test('create delegates to repository with createdBy', async () => {
    const course = { id: 1, title: 'New' };
    createMock.mockResolvedValue(course);

    await service.create({ title: 'New', status: 'draft' }, 10);

    expect(createMock).toHaveBeenCalledWith({ title: 'New', status: 'draft' }, 10);
  });

  test('update delegates to repository', async () => {
    const updated = { id: 1, title: 'Updated' };
    updateMock.mockResolvedValue(updated);

    const result = await service.update(1, { title: 'Updated' });

    expect(result).toEqual(updated);
  });

  test('remove delegates to repository', async () => {
    removeMock.mockResolvedValue(undefined);

    await service.remove(1);

    expect(removeMock).toHaveBeenCalledWith(1);
  });

  test('getActivities delegates to repository', async () => {
    const activities = [{ id: 1 }];
    findActivitiesByCourse.mockResolvedValue(activities);

    const result = await service.getActivities(1);

    expect(result).toEqual(activities);
  });

  test('createActivity delegates to repository', async () => {
    const activity = { id: 1, title: 'Act' };
    createActivityMock.mockResolvedValue(activity);

    const result = await service.createActivity(1, {
      type: 'quiz' as const,
      title: 'Act',
      position: 0,
      settings: { item_bank_id: 5 },
    });

    expect(result).toEqual(activity);
  });

  test('reorderActivities delegates to repository', async () => {
    reorderActivitiesMock.mockResolvedValue(undefined);

    await service.reorderActivities(1, [3, 1, 2]);

    expect(reorderActivitiesMock).toHaveBeenCalledWith(1, [3, 1, 2]);
  });

  test('assignUser delegates to repository', async () => {
    const assignment = { id: 1, user_id: 20 };
    createAssignmentMock.mockResolvedValue(assignment);

    const result = await service.assignUser(1, 20, 10, undefined);

    expect(result).toEqual(assignment);
    expect(createAssignmentMock).toHaveBeenCalledWith(1, 20, 10, undefined);
  });
});
