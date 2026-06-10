import { Test, TestingModule } from '@nestjs/testing';
import { EnderecoService } from './endereco.service';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';

const mockPrisma = {
  estado: { findMany: jest.fn(), findFirst: jest.fn() },
  municipio: { findMany: jest.fn(), findFirst: jest.fn() },
};

describe('EnderecoService', () => {
  let service: EnderecoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnderecoService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<EnderecoService>(EnderecoService);
    jest.clearAllMocks();
  });

  describe('listarEstados', () => {
    it('retorna lista de estados mapeados para DTO', async () => {
      mockPrisma.estado.findMany.mockResolvedValue([
        { id: 6, codigo: '23', nome: 'Ceará', sigla: 'CE' },
        { id: 26, codigo: '35', nome: 'São Paulo', sigla: 'SP' },
      ]);

      const result = await service.listarEstados();

      expect(mockPrisma.estado.findMany).toHaveBeenCalledWith({
        orderBy: { nome: 'asc' },
      });
      expect(result).toEqual([
        { id: 6, codigo: '23', nome: 'Ceará' },
        { id: 26, codigo: '35', nome: 'São Paulo' },
      ]);
    });
  });

  describe('listarMunicipiosPorEstado', () => {
    it('retorna municípios vinculados ao estado com nomeEstado', async () => {
      mockPrisma.municipio.findMany.mockResolvedValue([
        {
          id: 1,
          codigo: '2304400',
          nome: 'Fortaleza',
          estadoId: 6,
          estado: { id: 6, codigo: '23', nome: 'Ceará', sigla: 'CE' },
        },
      ]);

      const result = await service.listarMunicipiosPorEstado(6);

      expect(mockPrisma.municipio.findMany).toHaveBeenCalledWith({
        where: { estadoId: 6 },
        orderBy: { nome: 'asc' },
        include: { estado: true },
      });
      expect(result).toEqual([
        {
          id: 1,
          codigo: '2304400',
          nome: 'Fortaleza',
          idEstado: 6,
          nomeEstado: 'Ceará',
        },
      ]);
    });
  });

  describe('consultarCep', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('retorna DTO enriquecido com estado e município', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          cep: '60175-047',
          logradouro: 'Avenida Santos Dumont',
          bairro: 'Aldeota',
          localidade: 'Fortaleza',
          uf: 'CE',
          ibge: '2304400',
        }),
      });
      mockPrisma.estado.findFirst.mockResolvedValue({
        id: 6,
        codigo: '23',
        nome: 'Ceará',
        sigla: 'CE',
      });
      mockPrisma.municipio.findFirst.mockResolvedValue({
        id: 1,
        codigo: '2304400',
        nome: 'Fortaleza',
        estadoId: 6,
        estado: { id: 6, codigo: '23', nome: 'Ceará', sigla: 'CE' },
      });

      const result = await service.consultarCep('60175047');

      expect(result.cep).toBe('60175-047');
      expect(result.estado).toEqual({ id: 6, codigo: '23', nome: 'Ceará' });
      expect(result.municipio).toEqual({
        id: 1,
        codigo: '2304400',
        nome: 'Fortaleza',
        idEstado: 6,
        nomeEstado: 'Ceará',
      });
    });

    it('retorna estado=null e municipio=null quando não encontrado na base', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          cep: '01310-100',
          logradouro: 'Avenida Paulista',
          bairro: 'Bela Vista',
          localidade: 'São Paulo',
          uf: 'SP',
          ibge: '3550308',
        }),
      });
      mockPrisma.estado.findFirst.mockResolvedValue(null);

      const result = await service.consultarCep('01310100');

      expect(result.estado).toBeNull();
      expect(result.municipio).toBeNull();
    });

    it('lança BusinessException quando ViaCEP falha (rede)', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.consultarCep('00000000')).rejects.toThrow(
        BusinessException,
      );
    });

    it('lança BusinessException quando CEP não encontrado (erro=true)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ erro: true }),
      });

      await expect(service.consultarCep('00000000')).rejects.toThrow(
        BusinessException,
      );
    });

    it('lança BusinessException quando ViaCEP responde HTTP não-ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(service.consultarCep('00000000')).rejects.toThrow(
        BusinessException,
      );
    });

    it('mensagem de erro é ["Erro na recuperação do CEP"]', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('timeout'));

      try {
        await service.consultarCep('00000000');
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).messages).toEqual([
          'Erro na recuperação do CEP',
        ]);
      }
    });
  });
});
