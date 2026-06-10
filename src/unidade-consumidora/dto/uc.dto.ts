export class MunicipioUcDto {
  id: number;
  nome?: string;
  idEstado?: number;
  nomeEstado?: string;
}

export class EnderecoUcDto {
  logradouro: string;
  numero: number;
  complemento?: string;
  bairro: string;
  cep: string;
  municipio: MunicipioUcDto;
}

export class UnidadeConsumidoraDto {
  id?: number;
  numeroCliente: string;
  numeroUc: string;
  faturaFullPath?: string;
  endereco: EnderecoUcDto;
}
