// User session states for handling multi-step conversations
export enum SessionState {
  NONE = 'none',
  
  // Registration flow
  ENTERING_NAME = 'entering_name',
  ENTERING_BANK = 'entering_bank',
  ENTERING_ACCOUNT_NUMBER = 'entering_account_number',
  
  // Sell flow
  SELECTING_CRYPTO = 'selecting_crypto',
  SELECTING_NETWORK = 'selecting_network',
  ENTERING_AMOUNT = 'entering_amount',
  CONFIRMING_SALE = 'confirming_sale',
  
  // Support flow
  ENTERING_SUPPORT_SUBJECT = 'entering_support_subject',
  ENTERING_SUPPORT_MESSAGE = 'entering_support_message',
  
  // Settings flow
  SELECTING_SETTING = 'selecting_setting',
  UPDATING_BANK = 'updating_bank',
  UPDATING_ACCOUNT_NUMBER = 'updating_account_number',
  UPDATING_ACCOUNT_NAME = 'updating_account_name',
  
  // Admin flows
  ADMIN_BROADCAST = 'admin_broadcast',
  ADMIN_USER_SEARCH = 'admin_user_search',
}

export interface SessionData {
  state: SessionState;
  data: Record<string, unknown>;
  lastActivity: Date;
}

// In-memory session store (use Redis in production)
const sessions = new Map<number, SessionData>();

export function getSession(userId: number): SessionData {
  let session = sessions.get(userId);
  if (!session) {
    session = {
      state: SessionState.NONE,
      data: {},
      lastActivity: new Date(),
    };
    sessions.set(userId, session);
  }
  return session;
}

export function setSession(userId: number, session: Partial<SessionData>): SessionData {
  const current = getSession(userId);
  const updated = {
    ...current,
    ...session,
    lastActivity: new Date(),
  };
  sessions.set(userId, updated);
  return updated;
}

export function clearSession(userId: number): void {
  sessions.delete(userId);
}

export function updateSessionData(userId: number, data: Record<string, unknown>): SessionData {
  const current = getSession(userId);
  const updated = {
    ...current,
    data: { ...current.data, ...data },
    lastActivity: new Date(),
  };
  sessions.set(userId, updated);
  return updated;
}

// Clean up old sessions every 30 minutes
setInterval(() => {
  const now = new Date();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  for (const [userId, session] of sessions.entries()) {
    if (now.getTime() - session.lastActivity.getTime() > maxAge) {
      sessions.delete(userId);
    }
  }
}, 30 * 60 * 1000);
