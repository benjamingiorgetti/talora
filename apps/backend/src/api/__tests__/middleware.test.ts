import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockReq, createMockRes, createMockNext } from '../../__test-utils__/mock-request';
import { TEST_IDS } from '../../__test-utils__/factories';
import type { JwtPayload } from '../../auth/session';

// ---------------------------------------------------------------------------
// Mock ../../auth/session before importing middleware
// ---------------------------------------------------------------------------
const mockDecodeSession = mock((_token: string): JwtPayload => {
  throw new Error('not configured');
});

mock.module('../../auth/session', () => ({
  decodeSession: mockDecodeSession,
}));

// Import after mock.module so the mocked version is used
const { authMiddleware, requireSuperadmin, requireCompanyScope, getRequestCompanyId, getRequestProfessionalId } =
  await import('../middleware');

// ---------------------------------------------------------------------------
// Fixture payloads
// ---------------------------------------------------------------------------
const superadminPayload: JwtPayload = {
  userId: 'user-superadmin-id',
  email: 'super@talora.app',
  fullName: 'Super Admin',
  role: 'superadmin',
  companyId: null,
};

const adminEmpresaPayload: JwtPayload = {
  userId: 'user-admin-id',
  email: 'admin@empresa.com',
  fullName: 'Admin Empresa',
  role: 'admin_empresa',
  companyId: TEST_IDS.COMPANY_A,
};

const professionalPayload: JwtPayload = {
  userId: 'user-prof-id',
  email: 'prof@empresa.com',
  fullName: 'Prof Test',
  role: 'professional',
  companyId: TEST_IDS.COMPANY_A,
  professionalId: TEST_IDS.PROF_A,
};

// ---------------------------------------------------------------------------
// authMiddleware
// ---------------------------------------------------------------------------
describe('authMiddleware', () => {
  beforeEach(() => {
    mockDecodeSession.mockReset();
  });

  it('should set req.user and call next() when Bearer header is valid', () => {
    mockDecodeSession.mockImplementation(() => superadminPayload);

    const req = createMockReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(superadminPayload);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should set req.user and call next() when token is in ?token= query param', () => {
    mockDecodeSession.mockImplementation(() => adminEmpresaPayload);

    const req = createMockReq({ query: { token: 'query-token' } });
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(adminEmpresaPayload);
    // decodeSession must have been called with the query token
    expect(mockDecodeSession).toHaveBeenCalledWith('query-token');
  });

  it('should prefer Bearer header over query param when both are present', () => {
    mockDecodeSession.mockImplementation(() => superadminPayload);

    const req = createMockReq({
      headers: { authorization: 'Bearer header-token' },
      query: { token: 'query-token' },
    });
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware(req, res as any, next);

    expect(mockDecodeSession).toHaveBeenCalledWith('header-token');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should return 401 when no token is present', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when decodeSession throws (expired or malformed token)', () => {
    mockDecodeSession.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const req = createMockReq({ headers: { authorization: 'Bearer bad-token' } });
    const res = createMockRes();
    const next = createMockNext();

    authMiddleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireSuperadmin
// ---------------------------------------------------------------------------
describe('requireSuperadmin', () => {
  it('should call next() when req.user.role is superadmin', () => {
    const req = createMockReq({ user: superadminPayload });
    const res = createMockRes();
    const next = createMockNext();

    requireSuperadmin(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 when req.user.role is not superadmin', () => {
    const req = createMockReq({ user: adminEmpresaPayload });
    const res = createMockRes();
    const next = createMockNext();

    requireSuperadmin(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Superadmin access required' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// requireCompanyScope
// ---------------------------------------------------------------------------
describe('requireCompanyScope', () => {
  it('should call next() when superadmin provides ?company_id query param', () => {
    const req = createMockReq({
      user: superadminPayload,
      query: { company_id: TEST_IDS.COMPANY_A },
    });
    const res = createMockRes();
    const next = createMockNext();

    requireCompanyScope(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 when superadmin omits ?company_id', () => {
    const req = createMockReq({ user: superadminPayload, query: {} });
    const res = createMockRes();
    const next = createMockNext();

    requireCompanyScope(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'company_id query parameter required for superadmin scope',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when admin_empresa has companyId in JWT', () => {
    const req = createMockReq({ user: adminEmpresaPayload });
    const res = createMockRes();
    const next = createMockNext();

    requireCompanyScope(req, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 400 when admin_empresa JWT has no companyId', () => {
    const userWithoutCompany: JwtPayload = { ...adminEmpresaPayload, companyId: null };
    const req = createMockReq({ user: userWithoutCompany });
    const res = createMockRes();
    const next = createMockNext();

    requireCompanyScope(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Company context required' });
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getRequestCompanyId
// ---------------------------------------------------------------------------
describe('getRequestCompanyId', () => {
  it('should return ?company_id query param for superadmin', () => {
    const req = createMockReq({
      user: superadminPayload,
      query: { company_id: TEST_IDS.COMPANY_A },
    });

    const result = getRequestCompanyId(req);

    expect(result).toBe(TEST_IDS.COMPANY_A);
  });

  it('should return JWT companyId for admin_empresa', () => {
    const req = createMockReq({ user: adminEmpresaPayload });

    const result = getRequestCompanyId(req);

    expect(result).toBe(TEST_IDS.COMPANY_A);
  });
});

// ---------------------------------------------------------------------------
// getRequestProfessionalId
// ---------------------------------------------------------------------------
describe('getRequestProfessionalId', () => {
  it('should return JWT professionalId when role is professional', () => {
    const req = createMockReq({ user: professionalPayload });

    const result = getRequestProfessionalId(req);

    expect(result).toBe(TEST_IDS.PROF_A);
  });

  it('should return ?professional_id query param when role is admin', () => {
    const req = createMockReq({
      user: adminEmpresaPayload,
      query: { professional_id: TEST_IDS.PROF_B },
    });

    const result = getRequestProfessionalId(req);

    expect(result).toBe(TEST_IDS.PROF_B);
  });

  it('should return null when no professional context is available', () => {
    const req = createMockReq({ user: adminEmpresaPayload, query: {} });

    const result = getRequestProfessionalId(req);

    expect(result).toBeNull();
  });
});
