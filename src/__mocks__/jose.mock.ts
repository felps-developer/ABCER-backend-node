export const SignJWT = jest.fn().mockImplementation(() => ({
  setProtectedHeader: jest.fn().mockReturnThis(),
  setSubject: jest.fn().mockReturnThis(),
  setIssuer: jest.fn().mockReturnThis(),
  setAudience: jest.fn().mockReturnThis(),
  setIssuedAt: jest.fn().mockReturnThis(),
  setExpirationTime: jest.fn().mockReturnThis(),
  setNotBefore: jest.fn().mockReturnThis(),
  setJti: jest.fn().mockReturnThis(),
  sign: jest.fn().mockResolvedValue('mock.jwt.token'),
}));

export const jwtVerify = jest.fn().mockResolvedValue({
  payload: { sub: 'test@test.com', nome: 'Test', roles: ['USER'] },
});

export const importPKCS8 = jest.fn().mockResolvedValue('mock-private-key');
export const importSPKI = jest.fn().mockResolvedValue('mock-public-key');
export const generateKeyPair = jest.fn().mockResolvedValue({
  privateKey: 'mock-private-key',
  publicKey: 'mock-public-key',
});
export const exportPKCS8 = jest.fn().mockResolvedValue('-----BEGIN PRIVATE KEY-----\nmock\n-----END PRIVATE KEY-----');
export const exportSPKI = jest.fn().mockResolvedValue('-----BEGIN PUBLIC KEY-----\nmock\n-----END PUBLIC KEY-----');
