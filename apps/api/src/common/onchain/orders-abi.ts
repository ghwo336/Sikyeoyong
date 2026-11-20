import { parseAbi, toFunctionSelector } from 'viem';

/**
 * The parts of SikyeoyongOrders the server calls or reads (contracts/src/SikyeoyongOrders.sol,
 * tech-spec 5.2). Hand written so the API build does not need forge output. A test checks the
 * selectors against the deployment record's policy selector.
 */
export const ordersAbi = parseAbi([
  'function placeOrder(uint64 merchantId, bytes32 orderRef) payable',
  'function bindAgent(address agent)',
  'function setAgentPaused(address agent, bool paused)',
  'function agentOwner(address agent) view returns (address)',
  'function agentPaused(address agent) view returns (bool)',
  'function nextMerchantId() view returns (uint64)',
  'function merchants(uint64 merchantId) view returns (address payout, bytes32 kybUid, uint8 status, string metadataURI)',
  'event OrderPlaced(bytes32 indexed orderRef, address indexed agent, uint64 indexed merchantId, uint256 amount)',
  'event AgentBound(address indexed agent, address indexed owner)',
  'event AgentPaused(address indexed agent, bool paused)',
  'error NotOperator()',
  'error NotAgentOwner()',
  'error AgentNotBound()',
  'error AgentIsPaused()',
  'error MerchantNotActive(uint64 merchantId)',
  'error OrderExists(bytes32 orderRef)',
  'error BadAmount()',
  'error TransferFailed()',
  'error WrongMode()',
]);

/** placeOrder(uint64,bytes32): the selector the contract-scope policies hang on. */
export const PLACE_ORDER_SELECTOR = toFunctionSelector('placeOrder(uint64,bytes32)');
