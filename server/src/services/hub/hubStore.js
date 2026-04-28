import {
  addHubMessageInDb,
  appendHubActivityInDb,
  getHubProfileFromDb,
  isPostgresHubStoreEnabled,
  listHubActivityFromDb,
  listHubConversationsFromDb,
  listHubMessagesFromDb,
  markHubConversationReadInDb,
  searchHubProfilesFromDb,
  upsertHubProfileInDb,
} from './postgresHubStore.js';
import {
  addHubMessageInLocal,
  appendHubActivityInLocal,
  getHubProfileFromLocal,
  listHubActivityFromLocal,
  listHubConversationsFromLocal,
  listHubMessagesFromLocal,
  markHubConversationReadInLocal,
  searchHubProfilesFromLocal,
  upsertHubProfileInLocal,
} from './localHubStore.js';
import { ENV } from '../../config/env.js';

function shouldUseLocalHubStore() {
  return ENV.isDev && !isPostgresHubStoreEnabled();
}

function assertHubStoreAvailable() {
  if (isPostgresHubStoreEnabled() || shouldUseLocalHubStore()) return;
  throw new Error('HUB_DATABASE_REQUIRED');
}

export async function upsertHubProfile(payload) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return upsertHubProfileInDb(payload);
  }
  return upsertHubProfileInLocal(payload);
}

export async function getHubProfile(email) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return getHubProfileFromDb(email);
  }
  return getHubProfileFromLocal(email);
}

export async function searchHubProfiles(payload) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return searchHubProfilesFromDb(payload);
  }
  return searchHubProfilesFromLocal(payload);
}

export async function appendHubActivity(payload) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return appendHubActivityInDb(payload);
  }
  return appendHubActivityInLocal(payload);
}

export async function listHubActivity(email, limit = 20) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return listHubActivityFromDb(email, limit);
  }
  return listHubActivityFromLocal(email, limit);
}

export async function addHubMessage(payload) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return addHubMessageInDb(payload);
  }
  return addHubMessageInLocal(payload);
}

export async function listHubMessages(payload) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return listHubMessagesFromDb(payload);
  }
  return listHubMessagesFromLocal(payload);
}

export async function listHubConversations(email) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return listHubConversationsFromDb(email);
  }
  return listHubConversationsFromLocal(email);
}

export async function markHubConversationRead(payload) {
  assertHubStoreAvailable();
  if (isPostgresHubStoreEnabled()) {
    return markHubConversationReadInDb(payload);
  }
  return markHubConversationReadInLocal(payload);
}
