import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtService, type JwtPrincipal } from '../services/jwt.service';
import { JWT_COOKIE, CSRF_COOKIE, CSRF_HEADER, PRINCIPAL_KEY, setJwtCookie, setCsrfCookie } from './auth.guard';

@Injectable()
export class Auth403Guard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { [PRINCIPAL_KEY]?: JwtPrincipal }>();
    const res = context.switchToHttp().getResponse<Response>();

    const token = req.cookies?.[JWT_COOKIE] as string | undefined;
    if (!token) throw new ForbiddenException();

    let principal: JwtPrincipal;
    try {
      principal = await this.jwtService.verify(token);
    } catch {
      throw new ForbiddenException();
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
      throw new ForbiddenException();
    }
  }
}
