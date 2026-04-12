import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { User } from '../users/user.entity';

interface AuthenticatedRequest extends ExpressRequest {
  user: User;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned-url')
  @UseGuards(JwtAuthGuard)
  async getPresignedUrl(
    @Body() dto: PresignedUrlDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.uploadsService.generatePresignedUploadUrl(
      req.user.id,
      dto.purpose,
      dto.contentType,
      dto.fileName,
    );
  }
}
