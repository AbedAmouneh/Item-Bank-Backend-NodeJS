import { HttpWrapper } from '../../platform/http';
import { deleteTag } from './handlers/delete_tag';
import { getTags } from './handlers/get_tags';
import { createTag } from './handlers/post_tag';

export async function tagRoutes(http: HttpWrapper): Promise<void> {
  await http.get('/tags', getTags);
  await http.post('/tags', createTag);
  await http.delete('/tags/:id', deleteTag);
}
