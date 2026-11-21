/**
 * D-34: each meal is a new conversation, and the dragon sees only the current one. A message
 * starts a new session when the user's last order has finished (delivered, cancelled, failed,
 * refunded) or when the last message is older than this.
 */
export const CHAT_SESSION_IDLE_MS = 3 * 60 * 60 * 1000;
