import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RecaptchaService } from '../common/services/recaptcha.service';
import { ArquivoService } from '../common/services/arquivo.service';
import { JwtService, type JwtPrincipal } from '../common/services/jwt.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { SocioDto } from './dto/socio.dto';
import { PageDto } from './dto/page.dto';
import { UnidadeConsumidoraDto } from '../unidade-consumidora/dto/uc.dto';

type SocioWithRelations = {
  id: number;
  cpfCnpj: string;
  nome: string;
  telefone: string | null;
  email: string;
  documentoFullPath: string | null;
  tipoPessoa: number;
  tipoSocio: number;
  concordouEstatuto: boolean;
  endLogradouro: string | null;
  endNumero: number | null;
  endComplemento: string | null;
  endBairro: string | null;
  endCep: string | null;
  endMunicipioId: number | null;
  usuario: {
    id: number;
    nome: string;
    email: string;
    telefone: string | null;
    dataNascimento: Date | null;
    usuarioAtivo: boolean;
    roles: string[];
  } | null;
  unidadesConsumidoras: {
    id: number;
    numeroCliente: string;
    numeroUc: string;
    faturaFullPath: string | null;
    endLogradouro: string | null;
    endNumero: number | null;
    endComplemento: string | null;
    endBairro: string | null;
    endCep: string | null;
    endMunicipioId: number | null;
  }[];
};

@Injectable()
export class SocioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recaptcha: RecaptchaService,
    private readonly arquivo: ArquivoService,
    private readonly jwtService: JwtService,
  ) {}

  async incluir(
    dto: SocioDto,
    captchaResponse: string,
    fileDocumento: Express.Multer.File | undefined,
    fileUC: Express.Multer.File | undefined,
  ): Promise<{ socio: SocioDto; principal: JwtPrincipal }> {
    await this.recaptcha.validar(captchaResponse);

    const erros: string[] = [];

    for (const uc of dto.unidadesConsumidoras ?? []) {
      const exists = await this.prisma.unidadeConsumidora.findFirst({
        where: { numeroCliente: uc.numeroCliente },
      });
      if (exists) erros.push('Número do Cliente já cadastrado!');
    }

    const emailExiste = await this.prisma.usuario.findUnique({
      where: { email: dto.usuario.email },
    });
    if (emailExiste) erros.push('E-mail já cadastrado! Favor, usar a opção Entrar!');

    const cpfExiste = await this.prisma.socio.findFirst({ where: { cpfCnpj: dto.cpfCnpj } });
    if (cpfExiste) erros.push('CPF/CNPJ já cadastrado! Favor, usar a opção Entrar!');

    if (erros.length > 0) throw new BusinessException(erros);

    if (!fileDocumento) throw new BusinessException(['Documento, RG ou CNH, obrigatório.']);

    const documentoPath = this.arquivo.uploadFile(dto.cpfCnpj, fileDocumento);
    const senhaHash = await bcrypt.hash(dto.usuario.senha ?? '', 10);

    const socio = await this.prisma.$transaction(async (tx) => {
      const newSocio = await tx.socio.create({
        data: {
          cpfCnpj: dto.cpfCnpj,
          nome: dto.nome,
          telefone: dto.telefone,
          email: dto.email,
          documentoFullPath: documentoPath,
          tipoPessoa: dto.tipoPessoa,
          tipoSocio: dto.tipoSocio,
          concordouEstatuto: dto.concordouEstatuto,
          endLogradouro: dto.endereco.logradouro,
          endNumero: dto.endereco.numero,
          endComplemento: dto.endereco.complemento,
          endBairro: dto.endereco.bairro,
          endCep: dto.endereco.cep,
          endMunicipioId: dto.endereco.municipio.id,
          usuario: {
            create: {
              email: dto.usuario.email,
              senha: senhaHash,
              nome: dto.usuario.nome,
              telefone: dto.usuario.telefone,
              dataNascimento: dto.usuario.dataNascimento
                ? new Date(dto.usuario.dataNascimento)
                : undefined,
              usuarioAtivo: true,
              roles: ['USER'],
            },
          },
        },
        include: { usuario: true, unidadesConsumidoras: true },
      });
      return newSocio;
    });

    if (!fileUC) throw new BusinessException(['Última fatura da conta de energia obrigatória.']);

    const faturaPath = this.arquivo.uploadFile(dto.cpfCnpj, fileUC);
    const ucs = dto.unidadesConsumidoras ?? [];
    const ucCriadas = await Promise.all(
      ucs.map((uc, i) =>
        this.prisma.unidadeConsumidora.create({
          data: {
            numeroCliente: uc.numeroCliente,
            numeroUc: uc.numeroUc,
            faturaFullPath: i === 0 ? faturaPath : undefined,
            socioId: socio.id,
            endLogradouro: uc.endereco.logradouro,
            endNumero: uc.endereco.numero,
            endComplemento: uc.endereco.complemento,
            endBairro: uc.endereco.bairro,
            endCep: uc.endereco.cep,
            endMunicipioId: uc.endereco.municipio.id,
          },
        }),
      ),
    );

    const socioCompleto: SocioWithRelations = {
      ...socio,
      unidadesConsumidoras: ucCriadas,
    };

    const principal: JwtPrincipal = {
      id: socio.usuario!.email,
      nome: socio.usuario!.nome,
      roles: socio.usuario!.roles,
    };

    return { socio: this.toDto(socioCompleto), principal };
  }

  async logado(email: string): Promise<SocioDto> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: {
        socio: {
          include: { unidadesConsumidoras: true },
        },
      },
    });

    if (!usuario?.socio) throw new BusinessException(['Sócio não encontrado.']);

    const socio: SocioWithRelations = {
      ...usuario.socio,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        dataNascimento: usuario.dataNascimento,
        usuarioAtivo: usuario.usuarioAtivo,
        roles: usuario.roles,
      },
    };

    return this.toDto(socio);
  }

  async atualizar(
    dto: SocioDto,
    email: string,
    fileDocumento: Express.Multer.File | undefined,
  ): Promise<{ socio: SocioDto; principal: JwtPrincipal }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { socio: { include: { unidadesConsumidoras: true } } },
    });

    if (!usuario?.socio) throw new BusinessException(['Sócio não encontrado.']);

    const socioAtual = usuario.socio;

    let documentoPath = socioAtual.documentoFullPath;
    if (fileDocumento && fileDocumento.originalname !== '') {
      if (documentoPath) this.arquivo.removerArquivo(documentoPath);
      documentoPath = this.arquivo.uploadFile(dto.cpfCnpj, fileDocumento);
    }

    let senhaHash: string | undefined;
    if (dto.usuario?.senha) {
      senhaHash = await bcrypt.hash(dto.usuario.senha, 10);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.socio.update({
        where: { id: socioAtual.id },
        data: {
          cpfCnpj: dto.cpfCnpj,
          nome: dto.nome,
          telefone: dto.telefone,
          email: dto.email,
          documentoFullPath: documentoPath,
          tipoPessoa: dto.tipoPessoa,
          tipoSocio: dto.tipoSocio,
          concordouEstatuto: dto.concordouEstatuto,
          endLogradouro: dto.endereco.logradouro,
          endNumero: dto.endereco.numero,
          endComplemento: dto.endereco.complemento,
          endBairro: dto.endereco.bairro,
          endCep: dto.endereco.cep,
          endMunicipioId: dto.endereco.municipio.id,
        },
      });

      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          nome: dto.usuario.nome,
          telefone: dto.usuario.telefone,
          dataNascimento: dto.usuario.dataNascimento
            ? new Date(dto.usuario.dataNascimento)
            : undefined,
          ...(senhaHash ? { senha: senhaHash } : {}),
        },
      });
    });

    const updated = await this.prisma.socio.findUnique({
      where: { id: socioAtual.id },
      include: { usuario: true, unidadesConsumidoras: true },
    });

    const principal: JwtPrincipal = {
      id: usuario.email,
      nome: dto.usuario.nome,
      roles: usuario.roles,
    };

    return { socio: this.toDto(updated as SocioWithRelations), principal };
  }

  async todos(pagina: number, tamanho: number): Promise<PageDto<SocioDto>> {
    const skip = pagina * tamanho;
    const [items, total] = await Promise.all([
      this.prisma.socio.findMany({
        skip,
        take: tamanho,
        include: { usuario: true, unidadesConsumidoras: true },
      }),
      this.prisma.socio.count(),
    ]);

    return {
      content: items.map((s) => this.toDto(s as SocioWithRelations)),
      totalElements: total,
      totalPages: Math.ceil(total / tamanho),
      size: tamanho,
      number: pagina,
    };
  }

  async deletar(idSocio: number): Promise<SocioDto> {
    const socio = await this.prisma.socio.findUnique({
      where: { id: idSocio },
      include: { usuario: true, unidadesConsumidoras: true },
    });

    if (!socio) throw new BusinessException(['Sócio não encontrado.']);

    const dto = this.toDto(socio as SocioWithRelations);

    for (const uc of socio.unidadesConsumidoras) {
      if (uc.faturaFullPath) this.arquivo.removerArquivo(uc.faturaFullPath);
    }
    if (socio.documentoFullPath) this.arquivo.removerArquivo(socio.documentoFullPath);

    await this.prisma.$transaction(async (tx) => {
      await tx.unidadeConsumidora.deleteMany({ where: { socioId: idSocio } });
      if (socio.usuario) {
        await tx.passwordResetToken.deleteMany({ where: { usuarioId: socio.usuario.id } });
        await tx.usuario.delete({ where: { id: socio.usuario.id } });
      }
      await tx.socio.delete({ where: { id: idSocio } });
    });

    return dto;
  }

  private toDto(socio: SocioWithRelations): SocioDto {
    return {
      id: socio.id,
      nome: socio.nome,
      telefone: socio.telefone ?? '',
      email: socio.email,
      cpfCnpj: socio.cpfCnpj,
      tipoPessoa: socio.tipoPessoa,
      tipoSocio: socio.tipoSocio,
      concordouEstatuto: socio.concordouEstatuto,
      documentoFullPath: socio.documentoFullPath ?? undefined,
      endereco: {
        logradouro: socio.endLogradouro ?? '',
        numero: socio.endNumero ?? 0,
        complemento: socio.endComplemento ?? undefined,
        bairro: socio.endBairro ?? '',
        cep: socio.endCep ?? '',
        municipio: { id: socio.endMunicipioId ?? 0 },
      },
      unidadesConsumidoras: socio.unidadesConsumidoras.map((uc) => this.ucToDto(uc)),
      usuario: socio.usuario
        ? {
            id: socio.usuario.id,
            nome: socio.usuario.nome,
            email: socio.usuario.email,
            telefone: socio.usuario.telefone ?? undefined,
            dataNascimento: socio.usuario.dataNascimento?.toISOString().split('T')[0],
            usuarioAtivo: socio.usuario.usuarioAtivo,
            roles: socio.usuario.roles,
          }
        : { nome: '', email: '' },
    };
  }

  private ucToDto(uc: SocioWithRelations['unidadesConsumidoras'][number]): UnidadeConsumidoraDto {
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
