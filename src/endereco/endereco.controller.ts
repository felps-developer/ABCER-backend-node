import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { EnderecoService } from './endereco.service';

@Controller('estado')
export class EnderecoController {
  constructor(private readonly enderecoService: EnderecoService) {}

  @Get('todos')
  listarEstados() {
    return this.enderecoService.listarEstados();
  }

  @Get('cep/:cep')
  consultarCep(@Param('cep') cep: string) {
    return this.enderecoService.consultarCep(cep);
  }

  @Get(':idEstado/municipios')
  listarMunicipios(@Param('idEstado', ParseIntPipe) idEstado: number) {
    return this.enderecoService.listarMunicipiosPorEstado(idEstado);
  }
}
