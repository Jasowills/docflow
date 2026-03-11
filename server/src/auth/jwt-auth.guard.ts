import { Injectable, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const request = context.switchToHttp().getRequest<{ method?: string; url?: string }>();
      const reason =
        err instanceof Error
          ? err.message
          : info instanceof Error
            ? info.message
            : typeof info === 'string'
              ? info
              : 'Unknown authentication failure';
      this.logger.warn(
        `Auth rejected ${request.method || 'UNKNOWN'} ${request.url || ''}: ${reason}`,
      );
      throw err instanceof Error ? err : new UnauthorizedException(reason);
    }

    return user;
  }
}
