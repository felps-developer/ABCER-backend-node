import { Injectable } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { basename } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ArquivoService } from '../common/services/arquivo.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { UnidadeConsumidoraDto } from './dto/uc.dto';
import { PageDto } from '../socio/dto/page.dto';

type UcRow = {
  id: number;
  numeroCliente: string;
  numeroUc: string;
  faturaFullPath: string | null;
  socioId: number;
  endLogradouro: string | null;
  endNumero: number | null;
  endComplemento: string | null;
  endBairro: string | null;
  endCep: string | null;
  endMunicipioId: number | null;
};

@Injectable()
export class UcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly arquivo: ArquivoService,
  ) {}

  async todosPaginados(email: string, pagina: number, tamanho: number): Promise<PageDto<UnidadeConsumidoraDto>> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { socio: true },
    });

    const socioId = usuario?.socio?.id;
    if (!socioId) return { content: [], totalElements: 0, totalPages: 0, size: tamanho, number: pagina };

    const skip = pagina * tamanho;
    const [items, total] = await Promise.all([
      this.prisma.unidadeConsumidora.findMany({
        where: { socioId },
        skip,
        take: tamanho,
      }),
      this.prisma.unidadeConsumidora.count({ where: { socioId } }),
    ]);

    return {
      content: items.map((uc) => this.toDto(uc as UcRow)),
      totalElements: total,
      totalPages: Math.ceil(total / tamanho),
      size: tamanho,
      number: pagina,
    };
  }

  async findById(id: number): Promise<UnidadeConsumidoraDto> {
    const uc = await this.prisma.unidadeConsumidora.findUnique({ where: { id } });
    if (!uc) throw new BusinessException(['Unidade consumidora não encontrada.']);
    return this.toDto(uc as UcRow);
  }

  async salvar(
    dto: UnidadeConsumidoraDto,
    email: string,
    file: Express.Multer.File | undefined,
  ): Promise<UnidadeConsumidoraDto> {
    const erros: string[] = [];

    if (!dto.numeroCliente) erros.push('Número do Cliente obrigatório.');
    if (!dto.numeroUc) erros.push('Número da Unidade Consumidora obrigatório.');

    if (dto.id && dto.id > 0) {
      // edit
      const existeOutra = await this.prisma.unidadeConsumidora.findFirst({
        where: { numeroUc: dto.numeroUc, id: { not: dto.id } },
      });
      if (existeOutra) erros.push('Número da Unidade Consmidora já cadastrado.');
    } else {
      // create
      const existeUc = await this.prisma.unidadeConsumidora.findFirst({
        where: { numeroUc: dto.numeroUc },
      });
      if (existeUc) erros.push('Número da Unidade Consmidora já cadastrado.');
    }

    if (erros.length > 0) throw new BusinessException(erros);

    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { socio: true },
    });
    if (!usuario?.socio) throw new BusinessException(['Sócio não encontrado.']);

    if (!dto.id || dto.id === 0) {
      const cpfCnpj = usuario.socio.cpfCnpj;
      const faturaPath = file ? this.arquivo.uploadFile(cpfCnpj, file) : undefined;

      const created = await this.prisma.unidadeConsumidora.create({
        data: {
          numeroCliente: dto.numeroCliente,
          numeroUc: dto.numeroUc,
          faturaFullPath: faturaPath,
          socioId: usuario.socio.id,
          endLogradouro: dto.endereco.logradouro,
          endNumero: dto.endereco.numero,
          endComplemento: dto.endereco.complemento,
          endBairro: dto.endereco.bairro,
          endCep: dto.endereco.cep,
          endMunicipioId: dto.endereco.municipio.id,
        },
      });
      return this.toDto(created as UcRow);
    } else {
      const atual = await this.prisma.unidadeConsumidora.findUnique({ where: { id: dto.id } });
      if (!atual) throw new BusinessException(['Unidade consumidora não encontrada.']);

      let faturaPath = atual.faturaFullPath;
      if (file) {
        if (faturaPath) this.arquivo.removerArquivo(faturaPath);
        faturaPath = this.arquivo.uploadFile(usuario.socio.cpfCnpj, file);
      }

      const updated = await this.prisma.unidadeConsumidora.update({
        where: { id: dto.id },
        data: {
          numeroCliente: dto.numeroCliente,
          numeroUc: dto.numeroUc,
          faturaFullPath: faturaPath,
          endLogradouro: dto.endereco.logradouro,
          endNumero: dto.endereco.numero,
          endComplemento: dto.endereco.complemento,
          endBairro: dto.endereco.bairro,
          endCep: dto.endereco.cep,
          endMunicipioId: dto.endereco.municipio.id,
        },
      });
      return this.toDto(updated as UcRow);
    }
  }

  async deletar(idUC: number, email: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { socio: { include: { unidadesConsumidoras: true } } },
    });

    if (!usuario?.socio) throw new BusinessException(['Sócio não encontrado.']);

    if (usuario.socio.unidadesConsumidoras.length <= 1) {
      throw new BusinessException([
        'Exclusão não permitida. Enquanto sócio, você deve ter pelo menos uma unidade consumidora.',
      ]);
    }

    const uc = await this.prisma.unidadeConsumidora.findUnique({ where: { id: idUC } });
    if (uc?.faturaFullPath) this.arquivo.removerArquivo(uc.faturaFullPath);

    await this.prisma.unidadeConsumidora.delete({ where: { id: idUC } });
  }

  getFaturaStream(uc: UcRow): { stream: ReturnType<typeof createReadStream>; filename: string } {
    const path = uc.faturaFullPath ?? '';
    if (!existsSync(path)) throw new BusinessException(['Fatura não encontrada.']);
    return { stream: createReadStream(path), filename: basename(path) };
  }

  async findUcRow(id: number): Promise<UcRow> {
    const uc = await this.prisma.unidadeConsumidora.findUnique({ where: { id } });
    if (!uc) throw new BusinessException(['Unidade consumidora não encontrada.']);
    return uc as UcRow;
  }

  private toDto(uc: UcRow): UnidadeConsumidoraDto {
    return {
      id: uc.id,
      numeroCliente: uc.numeroCliente,
      numeroUc: uc.numeroUc,
      faturaFullPath: uc.faturaFullPath ?? undefined,
      endereco: {
        logradouro: uc.endLogradouro ?? '',
        numero: uc.endNumero ?? 0,
        complemento: uc.endComplemento ?? undefined,
        bairro: uc.endBairro ?? '',
        cep: uc.endCep ?? '',
        municipio: { id: uc.endMunicipioId ?? 0 },
      },
    };
  }
}
