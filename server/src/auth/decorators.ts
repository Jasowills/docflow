import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserContext } from '@docflow/shared';

/** Mark a route as publicly accessible (no auth required) */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Require specific application roles */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Extract the authenticated user from the request */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as UserContext;
  },
);

