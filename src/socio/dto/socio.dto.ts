import { UnidadeConsumidoraDto } from '../../unidade-consumidora/dto/uc.dto';

export class MunicipioRefDto {
  id: number;
  nome?: string;
  idEstado?: number;
  nomeEstado?: string;
}

export class EnderecoDto {
  logradouro: string;
  numero: number;
  complemento?: string;
  bairro: string;
  cep: string;
  municipio: MunicipioRefDto;
}

export class UsuarioDto {
  id?: number;
  nome: string;
  email: string;
  telefone?: string;
  dataNascimento?: string;
  senha?: string;
  usuarioAtivo?: boolean;
  roles?: string[];
}

export class SocioDto {
  id?: number;
  nome: string;
  telefone: string;
  email: string;
  cpfCnpj: string;
  tipoPessoa: number;
  tipoSocio: number;
  concordouEstatuto: boolean;
  documentoFullPath?: string;
  endereco: EnderecoDto;
  unidadesConsumidoras: UnidadeConsumidoraDto[];
  usuario: UsuarioDto;
}
