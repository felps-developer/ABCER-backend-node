import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { EnderecoModule } from './endereco/endereco.module.js';
import { UsuarioModule } from './usuario/usuario.module.js';
import { SocioModule } from './socio/socio.module.js';
import { UcModule } from './unidade-consumidora/uc.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EnderecoModule,
    UsuarioModule,
    SocioModule,
    UcModule,
  ],
})
export class AppModule {}
