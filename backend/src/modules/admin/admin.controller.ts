import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { UserRole } from '@shared/enums';
import { CertificatesService } from '../certificates/certificates.service';
import { AdminCertificatesQueryDto } from './dto/admin-certificates-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get('certificates')
  async listCertificates(@Query() query: AdminCertificatesQueryDto) {
    return this.certificatesService.findForAdmin(query);
  }
}
