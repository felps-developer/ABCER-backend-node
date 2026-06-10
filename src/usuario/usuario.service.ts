import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService, type JwtPrincipal } from '../common/services/jwt.service';
import { RecaptchaService } from '../common/services/recaptcha.service';
import { EmailService } from '../common/services/email.service';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class UsuarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly recaptcha: RecaptchaService,
    private readonly email: EmailService,
  ) {}

  async logar(emailInput: string, senha: string, captchaResponse: string): Promise<JwtPrincipal> {
    await this.recaptcha.validar(captchaResponse);

    const usuario = await this.prisma.usuario.findUnique({ where: { email: emailInput } });

    const senhaValida =
      usuario && usuario.usuarioAtivo
        ? await bcrypt.compare(senha, usuario.senha)
        : false;

    if (!senhaValida) {
      throw new BusinessException(['Usuário e senha inválidos.']);
    }

    return { id: usuario!.email, nome: usuario!.nome, roles: usuario!.roles };
  }

  async enviarLinkNovaSenha(emailInput: string, captchaResponse: string): Promise<void> {
    await this.recaptcha.validar(captchaResponse);

    if (!emailInput) throw new BusinessException(['Favor, informar o email.']);

    const usuario = await this.prisma.usuario.findUnique({ where: { email: emailInput } });
    if (!usuario) return;

    await this.prisma.passwordResetToken.deleteMany({ where: { usuarioId: usuario.id } });

    const token = randomUUID();
    const dataExpiracao = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { token, dataExpiracao, usuarioId: usuario.id },
    });

    await this.email.enviarLinkTrocaSenha(usuario.email, token);
  }

  async trocarSenha(token: string, novaSenha: string, captchaResponse: string): Promise<void> {
    await this.recaptcha.validar(captchaResponse);

    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken || resetToken.dataExpiracao < new Date()) {
      throw new BusinessException(['Token inválido ou expirado.']);
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await this.prisma.usuario.update({
      where: { id: resetToken.usuarioId },
      data: { senha: senhaHash },
    });

    await this.prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
  }
}
