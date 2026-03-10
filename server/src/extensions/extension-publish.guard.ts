import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AppConfig } from '../config/app-config';

@Injectable()
export class ExtensionPublishGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const provided = req.headers['x-extension-publish-key'];
    if (!provided || provided !== this.config.extensionPublishSecret) {
      throw new UnauthorizedException('Invalid extension publish key');
    }
    return true;
  }
}
