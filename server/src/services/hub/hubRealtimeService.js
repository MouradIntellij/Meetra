function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getHubUserRoom(email) {
  return `hub:user:${normalizeEmail(email)}`;
}

export function joinHubUserRoom(socket, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const room = getHubUserRoom(normalizedEmail);
  socket.join(room);
  socket.data.hubEmail = normalizedEmail;
  return room;
}
