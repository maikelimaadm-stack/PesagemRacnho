// Ponto de entrada do módulo de autenticação local (ADR-041…046, doc 11 rev. 2).
export * from './domain/permissionService.js';
export { PROFILES, PROFILE_LABELS, PERMISSIONS, ALL_PERMISSIONS, assertCan, isProfile, profileLabel, listPermissions } from './domain/accessPolicy.js';
export { hashPassword, verifyPassword, constantTimeEqual, PBKDF2_ITERATIONS, PASSWORD_ALGORITHM, PASSWORD_VERSION } from './domain/passwordHasher.js';
export { validatePassword, MIN_PASSWORD_LENGTH, TRIVIAL_PASSWORDS, getPasswordIterations, generateTemporaryPassword } from './domain/passwordPolicy.js';
export { generateRecoveryKey, hashRecoveryKey, verifyRecoveryKey, normalizeRecoveryKey } from './domain/recoveryKey.js';
export { AUTH_ERRORS, authError } from './domain/authErrors.js';
export * as localAuthService from './application/localAuthService.js';
export * as authService from './application/localAuthService.js';
export * as authSession from './application/authSession.js';
export * as sessionService from './application/authSession.js';
export * as authAudit from './application/authAudit.js';
export { getActor, getCurrentActor, actorFields, EMPTY_ACTOR } from './application/auditContext.js';
