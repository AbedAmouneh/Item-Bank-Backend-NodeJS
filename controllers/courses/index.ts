import { HttpWrapper } from '../../platform/http';
import { deleteActivity } from './handlers/delete_activity';
import { deleteAssignment } from './handlers/delete_assignment';
import { deleteCourse } from './handlers/delete_course';
import { getActivities } from './handlers/get_activities';
import { getAssignments } from './handlers/get_assignments';
import { getCourse } from './handlers/get_course';
import { getCourses } from './handlers/get_courses';
import { reorderActivities } from './handlers/patch_reorder';
import { createActivity } from './handlers/post_activity';
import { createAssignment } from './handlers/post_assignment';
import { createCourse } from './handlers/post_course';
import { updateActivity } from './handlers/put_activity';
import { updateCourse } from './handlers/put_course';

export async function courseRoutes(http: HttpWrapper): Promise<void> {
  // Courses
  await http.get('/courses', getCourses);
  await http.post('/courses', createCourse);
  await http.get('/courses/:id', getCourse);
  await http.put('/courses/:id', updateCourse);
  await http.delete('/courses/:id', deleteCourse);

  // Activities — register static /reorder before parametric /:actId
  await http.get('/courses/:id/activities', getActivities);
  await http.post('/courses/:id/activities', createActivity);
  await http.patch('/courses/:id/activities/reorder', reorderActivities);
  await http.put('/courses/:id/activities/:actId', updateActivity);
  await http.delete('/courses/:id/activities/:actId', deleteActivity);

  // Assignments
  await http.get('/courses/:id/assignments', getAssignments);
  await http.post('/courses/:id/assignments', createAssignment);
  await http.delete('/courses/:id/assignments/:userId', deleteAssignment);
}
