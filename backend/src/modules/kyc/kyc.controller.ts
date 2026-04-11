import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { KycService, SubmittedKycFiles } from './kyc.service';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';
import { validateKycFile } from './kyc-file.validator';
import { User } from '../users/user.entity';

interface AuthenticatedRequest extends ExpressRequest {
  user: User;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'nationalId', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
        { name: 'businessLicense', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_FILE_SIZE_BYTES } },
    ),
  )
  async submit(
    @UploadedFiles()
    uploaded: {
      nationalId?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      businessLicense?: Express.Multer.File[];
    },
    @Req() req: AuthenticatedRequest,
  ): Promise<KycStatusResponseDto> {
    const files: SubmittedKycFiles = {};

    const nationalId = uploaded?.nationalId?.[0];
    const selfie = uploaded?.selfie?.[0];
    const businessLicense = uploaded?.businessLicense?.[0];

    if (nationalId) {
      validateKycFile('nationalId', nationalId);
      files.nationalId = {
        buffer: nationalId.buffer,
        mimeType: nationalId.mimetype,
      };
    }
    if (selfie) {
      validateKycFile('selfie', selfie);
      files.selfie = { buffer: selfie.buffer, mimeType: selfie.mimetype };
    }
    if (businessLicense) {
      validateKycFile('businessLicense', businessLicense);
      files.businessLicense = {
        buffer: businessLicense.buffer,
        mimeType: businessLicense.mimetype,
      };
    }

    return this.kycService.submit(req.user, files);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@Req() req: AuthenticatedRequest): KycStatusResponseDto {
    return this.kycService.getStatus(req.user);
  }
}
