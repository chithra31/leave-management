import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '../entities';

export const IS_PUBLIC = 'isPublic';
/** Opt a route out of the global login requirement. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Restrict a route to the listed roles. Routes without it allow any logged-in user. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

// A class (not an interface) so it can appear in decorated controller signatures.
export class AuthUser {
  id: number;
  role: Role;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
