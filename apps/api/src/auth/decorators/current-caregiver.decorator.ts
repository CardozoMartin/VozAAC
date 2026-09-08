import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Caregiver } from '../../caregivers/entities/caregiver.entity';

/**
 * Inyecta el cuidador autenticado que dejó JwtStrategy.
 * Solo tiene sentido en rutas protegidas por JwtAuthGuard.
 */
export const CurrentCaregiver = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Caregiver => {
    return ctx.switchToHttp().getRequest<{ user: Caregiver }>().user;
  },
);
