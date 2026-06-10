import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { EstadoDto } from './dto/estado.dto';
import { MunicipioDto } from './dto/municipio.dto';
import { RespostaCepDto } from './dto/resposta-cep.dto';

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  erro?: boolean;
}

@Injectable()
export class EnderecoService {
  constructor(private readonly prisma: PrismaService) {}

  async listarEstados(): Promise<EstadoDto[]> {
    const estados = await this.prisma.estado.findMany({
      orderBy: { nome: 'asc' },
    });
    return estados.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome }));
  }

  async listarMunicipiosPorEstado(idEstado: number): Promise<MunicipioDto[]> {
    const municipios = await this.prisma.municipio.findMany({
      where: { estadoId: idEstado },
      orderBy: { nome: 'asc' },
      include: { estado: true },
    });
    return municipios.map((m) => ({
      id: m.id,
      codigo: m.codigo,
      nome: m.nome,
      idEstado: m.estadoId,
      nomeEstado: m.estado.nome,
    }));
  }

  async consultarCep(cep: string): Promise<RespostaCepDto> {
    const viaCepData = await this.fetchViaCep(cep);

    const estado = await this.prisma.estado.findFirst({
      where: { sigla: viaCepData.uf },
    });
    const municipio = estado
      ? await this.prisma.municipio.findFirst({
          where: { codigo: viaCepData.ibge },
          include: { estado: true },
        })
      : null;

    return {
      cep: viaCepData.cep,
      logradouro: viaCepData.logradouro,
      bairro: viaCepData.bairro,
      localidade: viaCepData.localidade,
      uf: viaCepData.uf,
      ibge: viaCepData.ibge,
      estado: estado
        ? { id: estado.id, codigo: estado.codigo, nome: estado.nome }
        : null,
      municipio: municipio
        ? {
            id: municipio.id,
            codigo: municipio.codigo,
            nome: municipio.nome,
            idEstado: municipio.estadoId,
            nomeEstado: municipio.estado.nome,
          }
        : null,
    };
  }

  private async fetchViaCep(cep: string): Promise<ViaCepResponse> {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error('ViaCEP HTTP error');
      const data = (await response.json()) as ViaCepResponse;
      if (data.erro) throw new Error('CEP not found');
      return data;
    } catch {
      throw new BusinessException(['Erro na recuperação do CEP']);
    }
  }
}
