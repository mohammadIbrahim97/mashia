import { BadRequestException } from '@nestjs/common';
import { imageSize } from 'image-size';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const MAX_WIDTH = 4096;
const MAX_HEIGHT = 4096;

export function validateKycFile(
  field: string,
  file: Express.Multer.File,
): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      `${field}: unsupported file type (${file.mimetype}). Allowed: JPEG, PNG, WebP`,
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new BadRequestException(
      `${field}: file too large (${file.size} bytes, max ${MAX_SIZE_BYTES})`,
    );
  }

  let dimensions: { width?: number; height?: number };
  try {
    dimensions = imageSize(file.buffer);
  } catch {
    throw new BadRequestException(`${field}: file is not a valid image`);
  }

  const width = dimensions.width ?? 0;
  const height = dimensions.height ?? 0;

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    throw new BadRequestException(
      `${field}: image too small (${width}x${height}, min ${MIN_WIDTH}x${MIN_HEIGHT})`,
    );
  }
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new BadRequestException(
      `${field}: image too large (${width}x${height}, max ${MAX_WIDTH}x${MAX_HEIGHT})`,
    );
  }
}
