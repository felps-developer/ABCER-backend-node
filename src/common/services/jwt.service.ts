import { Injectable } from '@nestjs/common';
import {
  importPKCS8,
  importSPKI,
  SignJWT,
  jwtVerify,
} from 'jose';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface JwtPrincipal {
  id: string;
  nome: string;
  roles: string[];
}

@Injectable()
export class JwtService {
  private readonly ttl = 3600;
  private readonly notBefore = '-90s';
  private readonly issuer = 'abcer';
  private readonly audience = 'abcer';

  async sign(principal: JwtPrincipal): Promise<string> {
    const privateKey = await importPKCS8(this.readPem('private'), 'RS512');
    return new SignJWT({ nome: principal.nome, roles: principal.roles })
      .setProtectedHeader({ alg: 'RS512' })
      .setSubject(principal.id)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${this.ttl}s`)
      .setNotBefore(this.notBefore)
      .setJti(randomUUID())
      .sign(privateKey);
  }

  async verify(token: string): Promise<JwtPrincipal> {
    const publicKey = await importSPKI(this.readPem('public'), 'RS512');
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: this.issuer,
      audience: this.audience,
      algorithms: ['RS512'],
    });
    return {
      id: payload.sub as string,
      nome: payload['nome'] as string,
      roles: payload['roles'] as string[],
    };
  }

  private readPem(type: 'private' | 'public'): string {
    const envVar = type === 'private' ? process.env.JWT_PRIVATE_KEY_PEM : process.env.JWT_PUBLIC_KEY_PEM;
    if (envVar) return envVar.replace(/\\n/g, '\n');

    const file = type === 'private' ? 'private.pem' : 'public.pem';
    return readFileSync(join(process.cwd(), 'keys', file), 'utf8');
  }
}
