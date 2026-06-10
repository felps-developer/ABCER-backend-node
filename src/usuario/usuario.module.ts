import { Module } from '@nestjs/common';
import { UsuarioController } from './usuario.controller';
import { UsuarioService } from './usuario.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtService } from '../common/services/jwt.service';
import { RecaptchaService } from '../common/services/recaptcha.service';
import { EmailService } from '../common/services/email.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UsuarioController],
  providers: [UsuarioService, JwtService, RecaptchaService, EmailService, AuthGuard],
  exports: [JwtService, AuthGuard],
})
export class UsuarioModule {}
