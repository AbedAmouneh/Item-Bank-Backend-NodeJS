import { HttpWrapper } from '../../platform/http';
import { deleteCategory } from './handlers/delete_category';
import { removeQuestionFromCategory } from './handlers/delete_category_question';
import { getCategories } from './handlers/get_categories';
import { createCategory } from './handlers/post_category';
import { assignQuestionsToCategory } from './handlers/post_category_questions';
import { updateCategory } from './handlers/put_category';

export async function categoryRoutes(http: HttpWrapper): Promise<void> {
  await http.get('/categories', getCategories);
  await http.post('/categories', createCategory);
  await http.put('/categories/:id', updateCategory);
  await http.delete('/categories/:id', deleteCategory);
  await http.post('/categories/:id/questions', assignQuestionsToCategory);
  await http.delete('/categories/:id/questions/:questionId', removeQuestionFromCategory);
}
