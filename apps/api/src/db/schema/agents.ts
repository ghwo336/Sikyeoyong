import { AGENT_LEVELS, type AgentLevel, DRAGON_SPECIES } from '@sikyeoyong/shared';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { aokrwCheck, enumCheck, intEnumCheck } from './checks.js';
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
    level: integer('level').$type<AgentLevel>().notNull().default(1),
    setupStep: text('setup_step', { enum: SETUP_STEPS }).notNull().default('wallet'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    enumCheck('agents_dragon_species_check', t.dragonSpecies, DRAGON_SPECIES),
    enumCheck('agents_status_check', t.status, AGENT_STATUSES),
    enumCheck('agents_payment_path_check', t.paymentPath, PAYMENT_PATHS),
    enumCheck('agents_setup_step_check', t.setupStep, SETUP_STEPS),
    intEnumCheck('agents_level_check', t.level, AGENT_LEVELS),
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
    level: integer('level').$type<AgentLevel>().notNull(),
    transferLimitAokrw: text('transfer_limit').notNull(),
    txHash: text('tx_hash'),
    approvalId: text('approval_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('agent_limit_history_agent_idx').on(t.agentId, t.createdAt),
    aokrwCheck('agent_limit_history_transfer_limit_check', t.transferLimitAokrw),
    intEnumCheck('agent_limit_history_level_check', t.level, AGENT_LEVELS),
  ],
);
