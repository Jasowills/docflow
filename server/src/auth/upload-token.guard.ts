import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UploadTokenService } from './upload-token.service';

@Injectable()
export class UploadTokenGuard implements CanActivate {
  constructor(private readonly uploadTokenService: UploadTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    request.user = this.uploadTokenService.parseUploadToken(token);
    return true;
  }
}
