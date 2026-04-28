import {
  createUserInDb,
  findUserByEmailFromDb,
  isPostgresUserStoreEnabled,
  updateUserLoginInDb,
} from './postgresUserStore.js';
import {
  createUserInLocal,
  findUserByEmailFromLocal,
  updateUserLoginInLocal,
} from './localUserStore.js';
import { ENV } from '../../config/env.js';

function shouldUseLocalAuthStore() {
  return ENV.isDev && !isPostgresUserStoreEnabled();
}

function assertAuthStoreAvailable() {
  if (isPostgresUserStoreEnabled() || shouldUseLocalAuthStore()) return;
  throw new Error('AUTH_DATABASE_REQUIRED');
}

export async function findUserByEmail(email) {
  assertAuthStoreAvailable();
  if (isPostgresUserStoreEnabled()) {
    return findUserByEmailFromDb(email);
  }
  return findUserByEmailFromLocal(email);
}

export async function createUser(user) {
  assertAuthStoreAvailable();
  if (isPostgresUserStoreEnabled()) {
    return createUserInDb(user);
  }
  return createUserInLocal(user);
}

export async function updateUserLogin(email) {
  assertAuthStoreAvailable();
  if (isPostgresUserStoreEnabled()) {
    return updateUserLoginInDb(email);
  }
  return updateUserLoginInLocal(email);
}
