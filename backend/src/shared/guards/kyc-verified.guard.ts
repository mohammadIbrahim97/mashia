import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { KycStatus } from '@shared/enums';

@Injectable()
export class KycVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException('KYC verification required');
    }
    return true;
  }
}
