import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService, type JwtPrincipal } from '../services/jwt.service';
import { randomUUID } from 'crypto';

export const JWT_COOKIE = 'ABCER_JWT_TOKEN';
export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'x-xsrf-token';
export const PRINCIPAL_KEY = '__principal__';

export function setJwtCookie(res: Response, token: string): void {
  res.cookie(JWT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 * 1000,
    path: '/',
  });
}

export function setCsrfCookie(res: Response): void {
  res.cookie(CSRF_COOKIE, randomUUID(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 * 1000,
    path: '/',
  });
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { [PRINCIPAL_KEY]?: JwtPrincipal }>();
    const res = context.switchToHttp().getResponse<Response>();

    const token = req.cookies?.[JWT_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException();

    let principal: JwtPrincipal;
    try {
      principal = await this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException();
    }

    this.validateCsrf(req);

    req[PRINCIPAL_KEY] = principal;

    const newToken = await this.jwtService.sign(principal);
    setJwtCookie(res, newToken);
    setCsrfCookie(res);

    return true;
  }

  private validateCsrf(req: Request): void {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

    const cookieValue = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const headerValue = req.headers[CSRF_HEADER] as string | undefined;

    if (!cookieValue || !headerValue || cookieValue !== headerValue) {
      throw new UnauthorizedException();
    }
  }
}
