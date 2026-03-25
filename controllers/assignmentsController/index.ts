import { HttpWrapper } from '../../platform/http';
import { deleteAssignment } from './handlers/delete_assignment';
import { unassignUser } from './handlers/delete_unassign_user';
import { getAssignment } from './handlers/get_assignment';
import { listAssignments } from './handlers/get_assignments';
import { getSubmission } from './handlers/get_submission';
import { listSubmissions } from './handlers/get_submissions';
import { updateAssignment } from './handlers/patch_assignment';
import { gradeSubmission } from './handlers/patch_submission_grade';
import { createAssignment } from './handlers/post_assignment';
import { assignUsers } from './handlers/post_assign_users';
import { saveOrSubmitSubmission } from './handlers/post_submission';

export async function assignmentRoutes(http: HttpWrapper): Promise<void> {
  // Assignment CRUD
  await http.get('/assignments', listAssignments);
  await http.post('/assignments', createAssignment);
  await http.get('/assignments/:id', getAssignment);
  await http.patch('/assignments/:id', updateAssignment);
  await http.delete('/assignments/:id', deleteAssignment);

  // Assign / unassign users
  await http.post('/assignments/:id/users', assignUsers);
  await http.delete('/assignments/:id/users/:userId', unassignUser);

  // Submissions
  await http.get('/assignments/:id/submissions', listSubmissions);
  await http.post('/assignments/:id/submissions', saveOrSubmitSubmission);
  await http.get('/assignments/:id/submissions/:subId', getSubmission);
  await http.patch('/assignments/:id/submissions/:subId/grade', gradeSubmission);
}
