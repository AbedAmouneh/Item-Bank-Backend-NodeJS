// controllers/assessmentsController/index.ts
import { HttpWrapper } from '../../platform/http';
import { deleteAssessment } from './handlers/delete_assessment';
import { deletePoolItem } from './handlers/delete_question_pool_item';
import { getAssessment } from './handlers/get_assessment';
import { getAssessments } from './handlers/get_assessments';
import { getAttemptResult } from './handlers/get_attempt_result';
import { getQuestionPool } from './handlers/get_question_pool';
import { updateAssessment } from './handlers/patch_assessment';
import { saveAnswer } from './handlers/patch_save_answer';
import { createAssessment } from './handlers/post_assessment';
import { addToPool } from './handlers/post_question_pool';
import { startAttempt } from './handlers/post_start_attempt';
import { submitAttempt } from './handlers/post_submit_attempt';
import { logViolation } from './handlers/post_violation';

export async function assessmentRoutes(http: HttpWrapper): Promise<void> {
  // Assessment CRUD
  await http.get('/assessments', getAssessments);
  await http.post('/assessments', createAssessment);
  await http.get('/assessments/:id', getAssessment);
  await http.patch('/assessments/:id', updateAssessment);
  await http.delete('/assessments/:id', deleteAssessment);

  // Question pool (static segment 'pool' before dynamic /:questionId)
  await http.get('/assessments/:id/pool', getQuestionPool);
  await http.post('/assessments/:id/pool', addToPool);
  await http.delete('/assessments/:id/pool/:questionId', deletePoolItem);

  // Attempt start (under /assessments)
  await http.post('/assessments/:id/attempts', startAttempt);

  // Attempt actions (under /attempts)
  await http.patch('/attempts/:attemptId/answers', saveAnswer);
  await http.post('/attempts/:attemptId/submit', submitAttempt);
  await http.get('/attempts/:attemptId/result', getAttemptResult);
  await http.post('/attempts/:attemptId/violations', logViolation);
}
