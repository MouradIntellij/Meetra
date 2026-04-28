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

function assertHubDatabase() {
  if (!isPostgresHubStoreEnabled()) {
    throw new Error('HUB_DATABASE_REQUIRED');
  }
}

export async function upsertHubProfile(payload) {
  assertHubDatabase();
  return upsertHubProfileInDb(payload);
}

export async function getHubProfile(email) {
  assertHubDatabase();
  return getHubProfileFromDb(email);
}

export async function searchHubProfiles(payload) {
  assertHubDatabase();
  return searchHubProfilesFromDb(payload);
}

export async function appendHubActivity(payload) {
  assertHubDatabase();
  return appendHubActivityInDb(payload);
}

export async function listHubActivity(email, limit = 20) {
  assertHubDatabase();
  return listHubActivityFromDb(email, limit);
}

export async function addHubMessage(payload) {
  assertHubDatabase();
  return addHubMessageInDb(payload);
}

export async function listHubMessages(payload) {
  assertHubDatabase();
  return listHubMessagesFromDb(payload);
}

export async function listHubConversations(email) {
  assertHubDatabase();
  return listHubConversationsFromDb(email);
}

export async function markHubConversationRead(payload) {
  assertHubDatabase();
  return markHubConversationReadInDb(payload);
}
