import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request, Response } from 'express';
import { UcService } from './uc.service';
import { Auth403Guard } from '../common/guards/auth403.guard';
import { Principal, type JwtPrincipal } from '../common/decorators/principal.decorator';
import { UnidadeConsumidoraDto } from './dto/uc.dto';
import { PageDto } from '../socio/dto/page.dto';

const multerOptions = {
  storage: diskStorage({ destination: 'uploads/' }),
  limits: { fileSize: 2 * 1024 * 1024 },
};

@UseGuards(Auth403Guard)
@Controller('unidadeConsumidora')
export class UcController {
  constructor(private readonly ucService: UcService) {}

  @Get('todosPaginados')
  async todosPaginados(
    @Principal() principal: JwtPrincipal,
    @Query('pagina') pagina = '0',
    @Query('tamanho') tamanho = '10',
  ): Promise<PageDto<UnidadeConsumidoraDto>> {
    return this.ucService.todosPaginados(principal.id, parseInt(pagina, 10), parseInt(tamanho, 10));
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<UnidadeConsumidoraDto> {
    return this.ucService.findById(id);
  }

  @Post('salvar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async salvar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Principal() principal: JwtPrincipal,
  ): Promise<UnidadeConsumidoraDto> {
    const body = (req.body ?? {}) as Record<string, string>;
    const dto = JSON.parse(body['ucDTOString'] ?? '{}') as UnidadeConsumidoraDto;
    return this.ucService.salvar(dto, principal.id, file);
  }

  @Delete(':idUC')
  @HttpCode(HttpStatus.OK)
  async deletar(
    @Param('idUC', ParseIntPipe) idUC: number,
    @Principal() principal: JwtPrincipal,
  ): Promise<void> {
    return this.ucService.deletar(idUC, principal.id);
  }

  @Get(':id/fatura')
  async fatura(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const uc = await this.ucService.findUcRow(id);
    const { stream, filename } = this.ucService.getFaturaStream(uc);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }
}
