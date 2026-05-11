import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UserRole } from '@shared/enums';
import { User } from '../users/user.entity';
import { CertificatesService } from '../certificates/certificates.service';
import { UsersService } from '../users/users.service';
import { AdminCertificatesQueryDto } from './dto/admin-certificates-query.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminKycDecisionDto } from './dto/admin-kyc-decision.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly certificatesService: CertificatesService,
    private readonly usersService: UsersService,
  ) {}

  // ----- Certificates -----

  @Get('certificates')
  async listCertificates(@Query() query: AdminCertificatesQueryDto) {
    return this.certificatesService.findForAdmin(query);
  }

  // ----- Users (G3-US03) -----

  @Get('users')
  async listUsers(@Query() query: AdminUsersQueryDto) {
    return this.usersService.findForAdmin(query);
  }

  @Get('users/:id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findByIdForAdmin(id);
  }

  @Patch('users/:id/kyc')
  async reviewKyc(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminKycDecisionDto,
  ) {
    return this.usersService.reviewKyc(
      admin.id,
      id,
      dto.decision,
      dto.rejectionReason,
    );
  }

  @Patch('users/:id/suspend')
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.setSuspended(id, true);
  }

  @Patch('users/:id/unsuspend')
  async unsuspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.setSuspended(id, false);
  }
}
