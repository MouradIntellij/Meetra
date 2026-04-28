import {
  createUserInDb,
  findUserByEmailFromDb,
  isPostgresUserStoreEnabled,
  updateUserLoginInDb,
} from './postgresUserStore.js';

function assertAuthDatabase() {
  if (!isPostgresUserStoreEnabled()) {
    throw new Error('AUTH_DATABASE_REQUIRED');
  }
}

export async function findUserByEmail(email) {
  assertAuthDatabase();
  return findUserByEmailFromDb(email);
}

export async function createUser(user) {
  assertAuthDatabase();
  return createUserInDb(user);
}

export async function updateUserLogin(email) {
  assertAuthDatabase();
  return updateUserLoginInDb(email);
}
