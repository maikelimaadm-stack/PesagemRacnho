// Ponto de entrada do módulo de autenticação local (ADR-035/036).
export * from './domain/accessPolicy.js';
export { hashPassword, verifyPassword, PBKDF2_ITERATIONS, PASSWORD_ALGORITHM } from './domain/passwordHasher.js';
export { createLoginLockout, defaultLoginLockout } from './domain/loginLockout.js';
export * as localAuthService from './application/localAuthService.js';
export * as authSession from './application/authSession.js';
export { getActor, getCurrentActor, actorFields, EMPTY_ACTOR } from './application/auditContext.js';
