import { Module } from '@nestjs/common';
import { SocioController } from './socio.controller';
import { SocioService } from './socio.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtService } from '../common/services/jwt.service';
import { RecaptchaService } from '../common/services/recaptcha.service';
import { ArquivoService } from '../common/services/arquivo.service';
import { Auth403Guard } from '../common/guards/auth403.guard';

@Module({
  imports: [PrismaModule],
  controllers: [SocioController],
  providers: [SocioService, JwtService, RecaptchaService, ArquivoService, Auth403Guard],
})
export class SocioModule {}
