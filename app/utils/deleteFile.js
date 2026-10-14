import fs from 'fs';
import path from 'path';

export const deleteFile = (filePath) => {
  if (!filePath) return;
  const fullPath = path.join(process.cwd(), filePath);
  fs.unlink(fullPath, () => {});
};