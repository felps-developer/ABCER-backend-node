import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { PRINCIPAL_KEY } from '../guards/auth.guard';
import type { JwtPrincipal } from '../services/jwt.service';

export type { JwtPrincipal } from '../services/jwt.service';

export const Principal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPrincipal => {
    const req = ctx.switchToHttp().getRequest<Request & { [PRINCIPAL_KEY]?: JwtPrincipal }>();
    return req[PRINCIPAL_KEY]!;
  },
);
