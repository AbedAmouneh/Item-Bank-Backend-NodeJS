export const BUCKETS = {
  CONTENT: 'vox-content',
  BACKUPS: 'vox-backups',
  TEMP: 'vox-temp',
} as const;

export const FOLDERS = {
  IMAGES: 'images',
  DOCUMENTS: 'documents',
  AUDIO: 'audio',
  VIDEO: 'video',
  OTHER: 'other',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
export type FolderName = (typeof FOLDERS)[keyof typeof FOLDERS];
