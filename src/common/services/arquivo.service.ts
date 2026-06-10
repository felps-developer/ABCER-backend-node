import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ArquivoService {
  uploadFile(cpfCnpj: string, file: Express.Multer.File): string {
    const dir = join('uploads', cpfCnpj);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const destPath = join(dir, `${Date.now()}-${file.originalname}`);
    renameSync(file.path, destPath);
    return destPath;
  }

  removerArquivo(path: string): void {
    try {
      if (existsSync(path)) unlinkSync(path);
    } catch {
      // ignore
    }
  }
}
