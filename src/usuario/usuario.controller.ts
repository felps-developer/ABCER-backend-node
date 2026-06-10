import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { UsuarioService } from './usuario.service';
import { JwtService } from '../common/services/jwt.service';
import { LogarDto } from './dto/logar.dto';
import { JwtPrincipalDto } from './dto/jwt-principal.dto';
import { AuthGuard, JWT_COOKIE, setJwtCookie, setCsrfCookie } from '../common/guards/auth.guard';
import { Principal, type JwtPrincipal } from '../common/decorators/principal.decorator';

@Controller('usuario')
export class UsuarioController {
  constructor(
    private readonly usuarioService: UsuarioService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('logar')
  @HttpCode(HttpStatus.OK)
  async logar(
    @Body() dto: LogarDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JwtPrincipalDto> {
    const principal = await this.usuarioService.logar(dto.email, dto.senha, dto.captchaResponse);
    const token = await this.jwtService.sign(principal);
    setJwtCookie(res, token);
    setCsrfCookie(res);
    return principal;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(JWT_COOKIE, { path: '/' });
  }

  @Get('isAuthenticated')
  isAuthenticated(@Req() req: Request): boolean {
    const token = req.cookies?.[JWT_COOKIE] as string | undefined;
    return !!token && token.length > 0;
  }

  @UseGuards(AuthGuard)
  @Get('user-info')
  userInfo(@Principal() principal: JwtPrincipal): JwtPrincipalDto {
    return principal;
  }

  @Post('enviarLinkNovaSenha')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AnyFilesInterceptor())
  async enviarLinkNovaSenha(@Req() req: Request): Promise<void> {
    const body = (req.body ?? {}) as Record<string, string>;
    await this.usuarioService.enviarLinkNovaSenha(body['email'] ?? '', body['captchaResponse'] ?? '');
  }

  @Post('trocarSenha')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(AnyFilesInterceptor())
  async trocarSenha(@Req() req: Request): Promise<void> {
    const body = (req.body ?? {}) as Record<string, string>;
    await this.usuarioService.trocarSenha(
      body['token'] ?? '',
      body['senha'] ?? '',
      body['captchaResponse'] ?? '',
    );
  }
}
