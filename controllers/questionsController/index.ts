import { HttpWrapper } from '../../platform/http';
import { deleteQuestion } from './handlers/delete_question';
import { exportQuestions } from './handlers/get_export';
import { getQuestion } from './handlers/get_question';
import { getQuestions } from './handlers/get_questions';
import { createQuestion } from './handlers/post_question';
import { publishQuestion } from './handlers/post_publish';
import { rejectQuestion } from './handlers/post_reject';
import { submitForReview } from './handlers/post_submit_for_review';
import { updateQuestion } from './handlers/put_question';

export async function questionRoutes(http: HttpWrapper): Promise<void> {
  await http.get('/questions', getQuestions);
  await http.get('/questions/export', exportQuestions);
  await http.get('/questions/:id', getQuestion);
  await http.post('/questions', createQuestion);
  await http.put('/questions/:id', updateQuestion);
  await http.delete('/questions/:id', deleteQuestion);
  await http.post('/questions/:id/submit', submitForReview);
  await http.post('/questions/:id/publish', publishQuestion);
  await http.post('/questions/:id/reject', rejectQuestion);
}
