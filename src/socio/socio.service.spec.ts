import { Test, TestingModule } from '@nestjs/testing';
import { SocioService } from './socio.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecaptchaService } from '../common/services/recaptcha.service';
import { ArquivoService } from '../common/services/arquivo.service';
import { JwtService } from '../common/services/jwt.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { SocioDto } from './dto/socio.dto';

const mockPrisma = {
  $transaction: jest.fn(),
  usuario: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
  socio: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  unidadeConsumidora: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
  passwordResetToken: { deleteMany: jest.fn() },
};

const mockRecaptcha = { validar: jest.fn() };
const mockArquivo = { uploadFile: jest.fn().mockReturnValue('uploads/123/doc.pdf'), removerArquivo: jest.fn() };
const mockJwt = { sign: jest.fn().mockResolvedValue('token'), verify: jest.fn() };

const buildDto = (overrides: Partial<SocioDto> = {}): SocioDto => ({
  nome: 'Felipe',
  telefone: '85999999999',
  email: 'felipe@test.com',
  cpfCnpj: '12345678901',
  tipoPessoa: 0,
  tipoSocio: 0,
  concordouEstatuto: true,
  endereco: { logradouro: 'Rua A', numero: 10, bairro: 'Centro', cep: '60000000', municipio: { id: 1 } },
  unidadesConsumidoras: [{ numeroCliente: 'CLI001', numeroUc: 'UC001', endereco: { logradouro: 'Rua B', numero: 5, bairro: 'Sul', cep: '60000001', municipio: { id: 1 } } }],
  usuario: { nome: 'Felipe', email: 'felipe@test.com', senha: 'senha123' },
  ...overrides,
});

const buildSocioRow = () => ({
  id: 1,
  cpfCnpj: '12345678901',
  nome: 'Felipe',
  telefone: '85999999999',
  email: 'felipe@test.com',
  documentoFullPath: null,
  tipoPessoa: 0,
  tipoSocio: 0,
  concordouEstatuto: true,
  endLogradouro: 'Rua A',
  endNumero: 10,
  endComplemento: null,
  endBairro: 'Centro',
  endCep: '60000000',
  endMunicipioId: 1,
  usuario: { id: 1, nome: 'Felipe', email: 'felipe@test.com', telefone: null, dataNascimento: null, usuarioAtivo: true, roles: ['USER'] },
  unidadesConsumidoras: [{ id: 1, numeroCliente: 'CLI001', numeroUc: 'UC001', faturaFullPath: 'uploads/123/fat.pdf', endLogradouro: 'Rua B', endNumero: 5, endComplemento: null, endBairro: 'Sul', endCep: '60000001', endMunicipioId: 1 }],
});

describe('SocioService', () => {
  let service: SocioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocioService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RecaptchaService, useValue: mockRecaptcha },
        { provide: ArquivoService, useValue: mockArquivo },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get<SocioService>(SocioService);
    jest.clearAllMocks();
  });

  describe('incluir', () => {
    const fakeFile = { originalname: 'doc.pdf', path: 'uploads/tmp' } as Express.Multer.File;

    it('throws BusinessException on captcha failure', async () => {
      mockRecaptcha.validar.mockRejectedValue(new BusinessException(['Captcha inválido.']));
      await expect(service.incluir(buildDto(), 'bad', fakeFile, fakeFile)).rejects.toThrow(BusinessException);
    });

    it('accumulates email + cpf duplicates', async () => {
      mockRecaptcha.validar.mockResolvedValue(undefined);
      mockPrisma.unidadeConsumidora.findFirst.mockResolvedValue(null);
      mockPrisma.usuario.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.socio.findFirst.mockResolvedValue({ id: 1 });

      await expect(service.incluir(buildDto(), 'ok', fakeFile, fakeFile)).rejects.toMatchObject({
        messages: expect.arrayContaining([
          'E-mail já cadastrado! Favor, usar a opção Entrar!',
          'CPF/CNPJ já cadastrado! Favor, usar a opção Entrar!',
        ]),
      });
    });

    it('throws on missing fileDocumento', async () => {
      mockRecaptcha.validar.mockResolvedValue(undefined);
      mockPrisma.unidadeConsumidora.findFirst.mockResolvedValue(null);
      mockPrisma.usuario.findUnique.mockResolvedValue(null);
      mockPrisma.socio.findFirst.mockResolvedValue(null);

      await expect(service.incluir(buildDto(), 'ok', undefined, fakeFile)).rejects.toMatchObject({
        messages: ['Documento, RG ou CNH, obrigatório.'],
      });
    });

    it('throws on missing fileUC', async () => {
      mockRecaptcha.validar.mockResolvedValue(undefined);
      mockPrisma.unidadeConsumidora.findFirst.mockResolvedValue(null);
      mockPrisma.usuario.findUnique.mockResolvedValue(null);
      mockPrisma.socio.findFirst.mockResolvedValue(null);
      mockArquivo.uploadFile.mockReturnValue('uploads/123/doc.pdf');

      const socioCreated = { id: 1, usuario: { id: 1, email: 'felipe@test.com', nome: 'Felipe', telefone: null, dataNascimento: null, usuarioAtivo: true, roles: ['USER'] }, unidadesConsumidoras: [] };
      mockPrisma.$transaction.mockImplementation(async (fn: unknown) => (fn as (p: typeof mockPrisma) => Promise<unknown>)(mockPrisma));
      mockPrisma.socio.create.mockResolvedValue(socioCreated);

      await expect(service.incluir(buildDto(), 'ok', fakeFile, undefined)).rejects.toMatchObject({
        messages: ['Última fatura da conta de energia obrigatória.'],
      });
    });

    it('creates socio and returns principal on success', async () => {
      mockRecaptcha.validar.mockResolvedValue(undefined);
      mockPrisma.unidadeConsumidora.findFirst.mockResolvedValue(null);
      mockPrisma.usuario.findUnique.mockResolvedValue(null);
      mockPrisma.socio.findFirst.mockResolvedValue(null);
      mockArquivo.uploadFile.mockReturnValue('uploads/123/doc.pdf');

      const socioCreated = { id: 1, cpfCnpj: '12345678901', nome: 'Felipe', telefone: '85999999999', email: 'felipe@test.com', documentoFullPath: 'uploads/123/doc.pdf', tipoPessoa: 0, tipoSocio: 0, concordouEstatuto: true, endLogradouro: 'Rua A', endNumero: 10, endComplemento: null, endBairro: 'Centro', endCep: '60000000', endMunicipioId: 1, usuario: { id: 1, email: 'felipe@test.com', nome: 'Felipe', telefone: null, dataNascimento: null, usuarioAtivo: true, roles: ['USER'] }, unidadesConsumidoras: [] };
      const ucCreated = { id: 1, numeroCliente: 'CLI001', numeroUc: 'UC001', faturaFullPath: 'uploads/123/fat.pdf', socioId: 1, endLogradouro: 'Rua B', endNumero: 5, endComplemento: null, endBairro: 'Sul', endCep: '60000001', endMunicipioId: 1 };

      mockPrisma.$transaction.mockImplementation(async (fn: unknown) => (fn as (p: typeof mockPrisma) => Promise<unknown>)(mockPrisma));
      mockPrisma.socio.create.mockResolvedValue(socioCreated);
      mockPrisma.unidadeConsumidora.create.mockResolvedValue(ucCreated);

      const result = await service.incluir(buildDto(), 'ok', fakeFile, fakeFile);

      expect(result.socio.nome).toBe('Felipe');
      expect(result.principal.id).toBe('felipe@test.com');
      expect(result.socio.unidadesConsumidoras).toHaveLength(1);
    });
  });

  describe('logado', () => {
    it('throws when user has no socio', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue({ id: 1, socio: null });
      await expect(service.logado('email@test.com')).rejects.toThrow(BusinessException);
    });

    it('returns SocioDto for authenticated user', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue({
        id: 1,
        nome: 'Felipe',
        email: 'felipe@test.com',
        telefone: null,
        dataNascimento: null,
        usuarioAtivo: true,
        roles: ['USER'],
        socio: buildSocioRow(),
      });
      const result = await service.logado('felipe@test.com');
      expect(result.nome).toBe('Felipe');
      expect(result.unidadesConsumidoras).toHaveLength(1);
    });
  });

  describe('todos', () => {
    it('returns paginated list', async () => {
      const row = buildSocioRow();
      mockPrisma.socio.findMany.mockResolvedValue([row]);
      mockPrisma.socio.count.mockResolvedValue(1);

      const result = await service.todos(0, 10);
      expect(result.totalElements).toBe(1);
      expect(result.content).toHaveLength(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('deletar', () => {
    it('throws when socio not found', async () => {
      mockPrisma.socio.findUnique.mockResolvedValue(null);
      await expect(service.deletar(999)).rejects.toThrow(BusinessException);
    });

    it('deletes socio and returns dto', async () => {
      const row = buildSocioRow();
      mockPrisma.socio.findUnique.mockResolvedValue(row);
      mockPrisma.$transaction.mockImplementation(async (fn: unknown) => (fn as (p: typeof mockPrisma) => Promise<unknown>)(mockPrisma));
      mockPrisma.unidadeConsumidora.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.usuario.delete.mockResolvedValue({});
      mockPrisma.socio.delete.mockResolvedValue({});

      const result = await service.deletar(1);
      expect(result.id).toBe(1);
      expect(mockArquivo.removerArquivo).toHaveBeenCalled();
    });
  });
});
