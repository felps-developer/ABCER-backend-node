import { Test, TestingModule } from '@nestjs/testing';
import { UcService } from './uc.service';
import { PrismaService } from '../prisma/prisma.service';
import { ArquivoService } from '../common/services/arquivo.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { UnidadeConsumidoraDto } from './dto/uc.dto';

const mockPrisma = {
  usuario: { findUnique: jest.fn() },
  unidadeConsumidora: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};
const mockArquivo = { uploadFile: jest.fn().mockReturnValue('uploads/123/fat.pdf'), removerArquivo: jest.fn() };

const buildDto = (overrides: Partial<UnidadeConsumidoraDto> = {}): UnidadeConsumidoraDto => ({
  numeroCliente: 'CLI001',
  numeroUc: 'UC001',
  endereco: { logradouro: 'Rua A', numero: 1, bairro: 'Centro', cep: '60000000', municipio: { id: 1 } },
  ...overrides,
});

const buildUcRow = () => ({
  id: 1,
  numeroCliente: 'CLI001',
  numeroUc: 'UC001',
  faturaFullPath: 'uploads/123/fat.pdf',
  socioId: 1,
  endLogradouro: 'Rua A',
  endNumero: 1,
  endComplemento: null,
  endBairro: 'Centro',
  endCep: '60000000',
  endMunicipioId: 1,
});

const buildUsuarioComSocio = (ucs = [buildUcRow()]) => ({
  id: 1,
  email: 'u@test.com',
  roles: ['USER'],
  socio: {
    id: 1,
    cpfCnpj: '12345678901',
    unidadesConsumidoras: ucs,
  },
});

describe('UcService', () => {
  let service: UcService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UcService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ArquivoService, useValue: mockArquivo },
      ],
    }).compile();
    service = module.get<UcService>(UcService);
    jest.clearAllMocks();
  });

  describe('todosPaginados', () => {
    it('returns empty page when user has no socio', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue({ id: 1, socio: null });
      const result = await service.todosPaginados('u@test.com', 0, 10);
      expect(result.content).toHaveLength(0);
    });

    it('returns paginated UCs for logged socio', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuarioComSocio());
      mockPrisma.unidadeConsumidora.findMany.mockResolvedValue([buildUcRow()]);
      mockPrisma.unidadeConsumidora.count.mockResolvedValue(1);

      const result = await service.todosPaginados('u@test.com', 0, 10);
      expect(result.totalElements).toBe(1);
      expect(result.content[0].numeroCliente).toBe('CLI001');
    });
  });

  describe('salvar', () => {
    const fakeFile = { originalname: 'fatura.pdf', path: 'uploads/tmp' } as Express.Multer.File;

    it('throws on missing numeroCliente', async () => {
      await expect(service.salvar(buildDto({ numeroCliente: '' }), 'u@test.com', fakeFile)).rejects.toMatchObject({
        messages: expect.arrayContaining(['Número do Cliente obrigatório.']),
      });
    });

    it('throws on missing numeroUc', async () => {
      await expect(service.salvar(buildDto({ numeroUc: '' }), 'u@test.com', fakeFile)).rejects.toMatchObject({
        messages: expect.arrayContaining(['Número da Unidade Consumidora obrigatório.']),
      });
    });

    it('throws on duplicate numeroUc (typo preserved)', async () => {
      mockPrisma.unidadeConsumidora.findFirst.mockResolvedValue({ id: 99 });
      mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuarioComSocio());

      await expect(service.salvar(buildDto(), 'u@test.com', fakeFile)).rejects.toMatchObject({
        messages: ['Número da Unidade Consmidora já cadastrado.'],
      });
    });

    it('creates new UC when id is null', async () => {
      mockPrisma.unidadeConsumidora.findFirst.mockResolvedValue(null);
      mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuarioComSocio());
      mockPrisma.unidadeConsumidora.create.mockResolvedValue(buildUcRow());

      const result = await service.salvar(buildDto(), 'u@test.com', fakeFile);
      expect(mockPrisma.unidadeConsumidora.create).toHaveBeenCalled();
      expect(result.numeroCliente).toBe('CLI001');
    });

    it('updates existing UC when id > 0', async () => {
      mockPrisma.unidadeConsumidora.findFirst.mockResolvedValue(null);
      mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuarioComSocio());
      mockPrisma.unidadeConsumidora.findUnique.mockResolvedValue(buildUcRow());
      mockPrisma.unidadeConsumidora.update.mockResolvedValue(buildUcRow());

      const result = await service.salvar(buildDto({ id: 1 }), 'u@test.com', fakeFile);
      expect(mockPrisma.unidadeConsumidora.update).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });
  });

  describe('deletar', () => {
    it('throws when socio has only 1 UC', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuarioComSocio([buildUcRow()]));

      await expect(service.deletar(1, 'u@test.com')).rejects.toMatchObject({
        messages: ['Exclusão não permitida. Enquanto sócio, você deve ter pelo menos uma unidade consumidora.'],
      });
    });

    it('deletes UC when socio has more than 1', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValue(buildUsuarioComSocio([buildUcRow(), buildUcRow()]));
      mockPrisma.unidadeConsumidora.findUnique.mockResolvedValue(buildUcRow());
      mockPrisma.unidadeConsumidora.delete.mockResolvedValue({});

      await service.deletar(1, 'u@test.com');
      expect(mockPrisma.unidadeConsumidora.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('findById', () => {
    it('throws when not found', async () => {
      mockPrisma.unidadeConsumidora.findUnique.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(BusinessException);
    });

    it('returns DTO when found', async () => {
      mockPrisma.unidadeConsumidora.findUnique.mockResolvedValue(buildUcRow());
      const result = await service.findById(1);
      expect(result.id).toBe(1);
    });
  });
});
