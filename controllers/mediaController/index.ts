import { HttpWrapper } from '../../platform/http';
import { uploadMedia } from './handlers/post_upload';
import { uploadMediaBase64 } from './handlers/post_upload_base64';

export async function mediaRoutes(http: HttpWrapper): Promise<void> {
  await http.post('/media/upload', uploadMedia);
  await http.post('/media/upload/base64', uploadMediaBase64);
}
