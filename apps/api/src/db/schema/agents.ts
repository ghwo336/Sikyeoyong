import { DRAGON_SPECIES } from '@sikyeoyong/shared';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { aokrwCheck, enumCheck } from './checks.js';
import { users } from './users.js';

export const AGENT_STATUSES = ['PENDING', 'ACTIVE', 'FROZEN', 'REVOKED'] as const;
export const PAYMENT_PATHS = ['A', 'B', 'C', 'mock'] as const;
/**
 * Where hatching is (user-flow 4): the wallet, the 8004 identity, then the TransferLimit.
 * failed keeps the agent PENDING until a retry.
 */
export const SETUP_STEPS = ['wallet', 'identity', 'limit', 'done', 'failed'] as const;

/** One dragon per user (tech-spec 4). Keys live in agent_keys (payment), never here. */
export const agents = sqliteTable(
  'agents',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    dragonName: text('dragon_name').notNull(),
    dragonSpecies: text('dragon_species', { enum: DRAGON_SPECIES }).notNull(),
    status: text('status', { enum: AGENT_STATUSES }).notNull().default('PENDING'),
    paymentPath: text('payment_path', { enum: PAYMENT_PATHS }).notNull(),
    walletAddress: text('wallet_address').unique(),
    onchainAgentId: text('onchain_agent_id'),
    ownerAddress: text('owner_address'),
    mawsAgentId: text('maws_agent_id'),
    /** The per-order limit the owner picked (D-31), aokrw text. The chain's TransferLimit holds the same. */
    perOrderLimitAokrw: text('per_order_limit').notNull(),
    setupStep: text('setup_step', { enum: SETUP_STEPS }).notNull().default('wallet'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    enumCheck('agents_dragon_species_check', t.dragonSpecies, DRAGON_SPECIES),
    enumCheck('agents_status_check', t.status, AGENT_STATUSES),
    enumCheck('agents_payment_path_check', t.paymentPath, PAYMENT_PATHS),
    enumCheck('agents_setup_step_check', t.setupStep, SETUP_STEPS),
    aokrwCheck('agents_per_order_limit_check', t.perOrderLimitAokrw),
  ],
);

/** Every TransferLimit change, with its transaction (tech-spec 4). */
export const agentLimitHistory = sqliteTable(
  'agent_limit_history',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    transferLimitAokrw: text('transfer_limit').notNull(),
    txHash: text('tx_hash'),
    approvalId: text('approval_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('agent_limit_history_agent_idx').on(t.agentId, t.createdAt),
    aokrwCheck('agent_limit_history_transfer_limit_check', t.transferLimitAokrw),
  ],
);

/**
 * Path B only (tech-spec 4, payment.md): one encrypted EOA private key per agent wallet. The key
 * is AES-256-GCM sealed with a per-row key derived from AGENT_KEY_ENCRYPTION_KEY (v2); the address is bound in as AAD so a row's
 * ciphertext cannot be moved under another address. agent_id is filled when the agents row links
 * the wallet (the key is saved first, before anything on chain, so a crash never loses a key whose
 * address may hold money). Nothing here is ever logged or sent to the web.
 */
export const agentKeys = sqliteTable(
  'agent_keys',
  {
    /** Lowercase 0x address of the agent wallet. */
    address: text('address').primaryKey(),
    agentId: text('agent_id').references(() => agents.id),
    /** The 8004 id (decimal string) once register() succeeded; a retried hatch resumes from it. */
    onchainAgentId: text('onchain_agent_id'),
    /** AES-256-GCM ciphertext, hex. */
    ciphertext: text('ciphertext').notNull(),
    /** 12 byte nonce, hex. */
    iv: text('iv').notNull(),
    /** 16 byte auth tag, hex. */
    tag: text('tag').notNull(),
    /**
     * 16 byte random HKDF salt, hex. Null on v1 rows, whose encryption key is the master key
     * itself; every v2 row has one (the per-agent key is HKDF(master, salt, address)).
     */
    salt: text('salt'),
    /** 1: sealed with the master key directly. 2: sealed with the HKDF per-agent key. */
    keyVersion: integer('key_version').notNull().default(1),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('agent_keys_agent_id_unique').on(t.agentId)],
);
