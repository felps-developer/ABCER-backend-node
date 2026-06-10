import { EstadoDto } from './estado.dto';
import { MunicipioDto } from './municipio.dto';

export class RespostaCepDto {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  estado: EstadoDto | null;
  municipio: MunicipioDto | null;
}
