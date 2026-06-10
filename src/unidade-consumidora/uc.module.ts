import { Module } from '@nestjs/common';
import { UcController } from './uc.controller';
import { UcService } from './uc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtService } from '../common/services/jwt.service';
import { ArquivoService } from '../common/services/arquivo.service';
import { Auth403Guard } from '../common/guards/auth403.guard';

@Module({
  imports: [PrismaModule],
  controllers: [UcController],
  providers: [UcService, JwtService, ArquivoService, Auth403Guard],
})
export class UcModule {}
