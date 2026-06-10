import { Test, TestingModule } from '@nestjs/testing';
import { UsuarioService } from './usuario.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '../common/services/jwt.service';
import { RecaptchaService } from '../common/services/recaptcha.service';
import { EmailService } from '../common/services/email.service';
import { BusinessException } from '../common/exceptions/business.exception';
import bcrypt from 'bcrypt';

const mockPrisma = {
  usuario: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  passwordResetToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn(), verify: jest.fn() };
const mockRecaptcha = { validar: jest.fn() };
const mockEmail = { enviarLinkTrocaSenha: jest.fn() };

describe('UsuarioService', () => {
  let service: UsuarioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuarioService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: RecaptchaService, useValue: mockRecaptcha },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get(UsuarioService);
    jest.clearAllMocks();
    mockRecaptcha.validar.mockResolvedValue(undefined);
    mockEmail.enviarLinkTrocaSenha.mockResolvedValue(undefined);
  });

  // ── logar ────────────────────────────────────────────────────────────────

  it('logar: sucesso retorna JwtPrincipal', async () => {
    const hash = await bcrypt.hash('senha123', 1);
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 1, email: 'u@test.com', nome: 'User', senha: hash, usuarioAtivo: true, roles: ['USER'],
    });

    const result = await service.logar('u@test.com', 'senha123', 'captcha');

    expect(result).toEqual({ id: 'u@test.com', nome: 'User', roles: ['USER'] });
  });

  it('logar: senha errada → BusinessException', async () => {
    const hash = await bcrypt.hash('outra', 1);
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 1, email: 'u@test.com', nome: 'User', senha: hash, usuarioAtivo: true, roles: ['USER'],
    });

    await expect(service.logar('u@test.com', 'errada', 'captcha'))
      .rejects.toThrow(BusinessException);
  });

  it('logar: usuário não encontrado → BusinessException', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await expect(service.logar('nao@existe.com', 'senha', 'captcha'))
      .rejects.toThrow(BusinessException);
  });

  it('logar: usuário inativo → BusinessException', async () => {
    const hash = await bcrypt.hash('senha123', 1);
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id: 1, email: 'u@test.com', nome: 'User', senha: hash, usuarioAtivo: false, roles: ['USER'],
    });

    await expect(service.logar('u@test.com', 'senha123', 'captcha'))
      .rejects.toThrow(BusinessException);
  });

  it('logar: captcha inválido → BusinessException', async () => {
    mockRecaptcha.validar.mockRejectedValue(new BusinessException(['Captcha inválido.']));

    await expect(service.logar('u@test.com', 'senha123', 'bad'))
      .rejects.toThrow(BusinessException);
  });

  // ── enviarLinkNovaSenha ──────────────────────────────────────────────────

  it('enviarLinkNovaSenha: email vazio → BusinessException', async () => {
    await expect(service.enviarLinkNovaSenha('', 'captcha'))
      .rejects.toThrow(BusinessException);
  });

  it('enviarLinkNovaSenha: email não existe → retorna sem erro (anti-enumeração)', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await expect(service.enviarLinkNovaSenha('nao@existe.com', 'captcha'))
      .resolves.toBeUndefined();
    expect(mockEmail.enviarLinkTrocaSenha).not.toHaveBeenCalled();
  });

  it('enviarLinkNovaSenha: email existe → cria token e envia email', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id: 1, email: 'u@test.com' });
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue(undefined);
    mockPrisma.passwordResetToken.create.mockResolvedValue(undefined);

    await service.enviarLinkNovaSenha('u@test.com', 'captcha');

    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
    expect(mockEmail.enviarLinkTrocaSenha).toHaveBeenCalledWith('u@test.com', expect.any(String));
  });

  // ── trocarSenha ──────────────────────────────────────────────────────────

  it('trocarSenha: token inválido → BusinessException', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(service.trocarSenha('invalido', 'nova123', 'captcha'))
      .rejects.toThrow(BusinessException);
  });

  it('trocarSenha: token expirado → BusinessException', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 1, token: 'tok', dataExpiracao: new Date(Date.now() - 1000), usuarioId: 1,
    });

    await expect(service.trocarSenha('tok', 'nova123', 'captcha'))
      .rejects.toThrow(BusinessException);
  });

  it('trocarSenha: sucesso → senha atualizada e token deletado', async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 1, token: 'tok', dataExpiracao: new Date(Date.now() + 3600_000), usuarioId: 1,
    });
    mockPrisma.usuario.update.mockResolvedValue(undefined);
    mockPrisma.passwordResetToken.delete.mockResolvedValue(undefined);

    await service.trocarSenha('tok', 'nova123', 'captcha');

    expect(mockPrisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
    expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
