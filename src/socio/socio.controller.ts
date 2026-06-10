import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request, Response } from 'express';
import { SocioService } from './socio.service';
import { JwtService } from '../common/services/jwt.service';
import { Auth403Guard } from '../common/guards/auth403.guard';
import { Principal, type JwtPrincipal } from '../common/decorators/principal.decorator';
import { setJwtCookie, setCsrfCookie } from '../common/guards/auth.guard';
import { SocioDto } from './dto/socio.dto';
import { PageDto } from './dto/page.dto';

const multerOptions = {
  storage: diskStorage({ destination: 'uploads/' }),
  limits: { fileSize: 2 * 1024 * 1024 },
};

@Controller('socio')
export class SocioController {
  constructor(
    private readonly socioService: SocioService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('incluir')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'fileDocumento', maxCount: 1 },
        { name: 'fileUC', maxCount: 1 },
      ],
      multerOptions,
    ),
  )
  async incluir(
    @Req() req: Request,
    @UploadedFiles()
    files: { fileDocumento?: Express.Multer.File[]; fileUC?: Express.Multer.File[] },
    @Res({ passthrough: true }) res: Response,
  ): Promise<SocioDto> {
    const body = (req.body ?? {}) as Record<string, string>;
    const dto = JSON.parse(body['socioDTO'] ?? '{}') as SocioDto;
    const captchaResponse = body['captchaResponse'] ?? '';

    const { socio, principal } = await this.socioService.incluir(
      dto,
      captchaResponse,
      files.fileDocumento?.[0],
      files.fileUC?.[0],
    );

    const token = await this.jwtService.sign(principal);
    setJwtCookie(res, token);
    setCsrfCookie(res);

    return socio;
  }

  @UseGuards(Auth403Guard)
  @Get('logado')
  async logado(@Principal() principal: JwtPrincipal): Promise<SocioDto> {
    return this.socioService.logado(principal.id);
  }

  @UseGuards(Auth403Guard)
  @Put()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'fileDocumento', maxCount: 1 }], multerOptions),
  )
  async atualizar(
    @Req() req: Request,
    @UploadedFiles() files: { fileDocumento?: Express.Multer.File[] },
    @Principal() principal: JwtPrincipal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SocioDto> {
    const body = (req.body ?? {}) as Record<string, string>;
    const dto = JSON.parse(body['socioDTOString'] ?? '{}') as SocioDto;

    const { socio, principal: newPrincipal } = await this.socioService.atualizar(
      dto,
      principal.id,
      files.fileDocumento?.[0],
    );

    const token = await this.jwtService.sign(newPrincipal);
    setJwtCookie(res, token);
    setCsrfCookie(res);

    return socio;
  }

  @Get('todos')
  async todos(
    @Query('pagina') pagina = '0',
    @Query('tamanho') tamanho = '10',
  ): Promise<PageDto<SocioDto>> {
    return this.socioService.todos(parseInt(pagina, 10), parseInt(tamanho, 10));
  }

  @UseGuards(Auth403Guard)
  @Delete(':idSocio')
  @HttpCode(HttpStatus.OK)
  async deletar(@Param('idSocio', ParseIntPipe) idSocio: number): Promise<SocioDto> {
    return this.socioService.deletar(idSocio);
  }
}
