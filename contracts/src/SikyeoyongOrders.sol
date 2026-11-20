// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title SikyeoyongOrders
/// @notice 시켜용 주문 결제. 에이전트가 OKRW(네이티브)로 내고 가게 payout으로 바로 보낸다.
/// 이름과 시그니처는 decisions D-08, 의사 코드는 tech-spec 5.2.
///
/// 한도(건당, 30일 누적)와 가게 KYB는 이 컨트랙트가 세지 않는다. PCL 프록시 뒤에 배포하고
/// 컨트랙트 범위 정책(placeOrder에 AGENT_OKRW_TRANSFER_LIMIT_POLICY And PERIODIC_VOLUME_POLICY,
/// registerMerchant에 EAS_POLICY)이 실행 중에 검사한다 (D-02, D-07). 거절되면 revert되고
/// 트랜잭션은 블록에 남으며 가스가 과금된다. 프록시 없이 배포하면 이 정책들은 걸리지 않는다.
///
/// 불변식 (docs/wiki/components/contracts.md):
/// 1. 나가는 돈은 Active 가게의 payout, 또는 그 에이전트의 소유자에게만 간다.
/// 2. placeOrder의 msg.sender는 에이전트 자신이다 (대리 호출 함수 없음).
/// 3. 같은 orderRef는 한 번만 결제된다.
/// 4. 모드 P는 돈을 보관하지 않는다. 모드 V는 선불 합계가 컨트랙트 잔액과 같다.
contract SikyeoyongOrders is Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuard {
    enum OrderStatus {
        None,
        Paid,
        Refunded
    }

    enum MerchantStatus {
        None,
        Pending,
        Active,
        Suspended
    }

    struct Merchant {
        address payout; // 지급 주소 = 등록 신청 sender (D-08 E-2)
        bytes32 kybUid; // EAS attestation UID. 검사는 PCL EAS_POLICY가 한다
        MerchantStatus status;
        string metadataURI;
    }

    struct Order {
        address agent;
        uint64 merchantId;
        uint128 amount; // aokrw
        uint64 createdAt;
        OrderStatus status;
    }

    // 저장소 레이아웃: UUPS 업그레이드 때 순서를 바꾸지 않는다. 새 변수는 __gap 앞 끝에 더하고 gap을 줄인다.
    // OZ v5의 Ownable, Initializable, ReentrancyGuard는 ERC-7201 이름 공간 슬롯을 써서 아래와 겹치지 않는다.
    address public operator; // 운영자: 가게 활성화, 환불 대행, 에이전트 바인딩(1단계)
    uint64 public nextMerchantId; // 다음에 줄 가게 번호. 1부터 (0은 "없음")
    bool public vaultMode; // false = 모드 P (기본, D-06). 초기화 때 한 번 정한다
    mapping(uint64 merchantId => Merchant) public merchants;
    mapping(address payout => uint64 merchantId) public merchantIdByPayout;
    mapping(address agent => address owner) public agentOwner;
    mapping(address agent => bool) public agentPaused;
    mapping(address agent => uint256) public vaultBalance; // 모드 V 전용, aokrw
    mapping(bytes32 orderRef => Order) public orders;
    uint256[43] private __gap;

    event MerchantRegistered(uint64 indexed merchantId, address indexed payout, bytes32 kybUid, string metadataURI);
    event MerchantStatusChanged(uint64 indexed merchantId, MerchantStatus status);
    event AgentBound(address indexed agent, address indexed owner);
    event Deposited(address indexed agent, address indexed from, uint256 amount);
    event OrderPlaced(bytes32 indexed orderRef, address indexed agent, uint64 indexed merchantId, uint256 amount);
    event Refunded(bytes32 indexed orderRef, address indexed to, uint256 amount);
    event Withdrawn(address indexed agent, address indexed to, uint256 amount);
    event AgentPaused(address indexed agent, bool paused);

    // tech-spec 5.2와 같은 이름. 서버 매핑은 chain-and-pcl.md "revert 매핑".
    error NotOperator();
    error NotAgentOwner();
    error AgentNotBound();
    error AgentIsPaused();
    error MerchantNotActive(uint64 merchantId);
    error OrderExists(bytes32 orderRef);
    error OrderNotPaid(bytes32 orderRef);
    error BadAmount();
    error TransferFailed();
    // 명세에 이름이 없어 더한 에러 (contracts.md "명세와 다른 점").
    error WrongMode(); // 의사 코드의 빈 revert() 대신
    error ZeroAddress();
    error PayoutAlreadyRegistered(address payout);
    error MerchantNotFound(uint64 merchantId);
    error InvalidMerchantStatus();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice 프록시를 거쳐 한 번만 부른다 (tech-spec 5.5의 3단계).
    /// @param operator_ 운영자 주소
    /// @param owner_ 업그레이드 권한자 (1단계 운영자 키, 2단계 멀티시그)
    /// @param vaultMode_ false면 모드 P. 모드 V는 스파이크 S10 확인 뒤에만 (D-06)
    function initialize(address operator_, address owner_, bool vaultMode_) external initializer {
        if (operator_ == address(0)) revert ZeroAddress();
        __Ownable_init(owner_);
        operator = operator_;
        vaultMode = vaultMode_;
        nextMerchantId = 1;
    }

    // ---------------------------------------------------------------- 가게

    /// @notice 가게 payout 지갑이 직접 신청한다. KYB attestation 검사는 이 셀렉터에 건 PCL EAS_POLICY가
    /// sender를 보고 한다 (D-08 E-2). 신청한 가게는 Pending이고 운영자가 활성화해야 주문을 받는다.
    function registerMerchant(bytes32 kybUid, string calldata metadataURI) external returns (uint64 merchantId) {
        if (merchantIdByPayout[msg.sender] != 0) revert PayoutAlreadyRegistered(msg.sender);
        merchantId = nextMerchantId++;
        merchants[merchantId] = Merchant(msg.sender, kybUid, MerchantStatus.Pending, metadataURI);
        merchantIdByPayout[msg.sender] = merchantId;
        emit MerchantRegistered(merchantId, msg.sender, kybUid, metadataURI);
    }

    /// @notice 운영자가 등록된 가게를 활성화하거나 정지한다.
    function setMerchantStatus(uint64 merchantId, MerchantStatus status) external onlyOperator {
        Merchant storage m = merchants[merchantId];
        if (m.payout == address(0)) revert MerchantNotFound(merchantId);
        if (status == MerchantStatus.None) revert InvalidMerchantStatus();
        m.status = status;
        emit MerchantStatusChanged(merchantId, status);
    }

    // ---------------------------------------------------------------- 에이전트

    /// @notice 에이전트를 호출자에게 묶는다. 묶인 주인은 바꿀 수 없다.
    /// 1단계는 운영자만 부른다: 모든 에이전트의 8004 소유자가 운영자이고 (tech-spec 5.3),
    /// 8004 소유 확인 인터페이스가 미확인이라(스파이크 S11, Q-11) 아무나 남의 에이전트를 묶지 못하게 막는다.
    /// 8004 확인이 되면 업그레이드로 소유자 직접 호출을 연다 (open-questions Q-30).
    function bindAgent(address agent) external onlyOperator {
        if (agent == address(0)) revert ZeroAddress();
        address current = agentOwner[agent];
        if (current != address(0) && current != msg.sender) revert NotAgentOwner();
        agentOwner[agent] = msg.sender;
        emit AgentBound(agent, msg.sender);
    }

    /// @notice 소유자가 에이전트를 온체인에서 멈추거나 푼다 (D-07 동결).
    function setAgentPaused(address agent, bool paused) external {
        if (agentOwner[agent] != msg.sender) revert NotAgentOwner();
        agentPaused[agent] = paused;
        emit AgentPaused(agent, paused);
    }

    // ---------------------------------------------------------------- 주문

    /// @notice 모드 P 결제. 에이전트가 msg.value로 내고 가게 payout으로 바로 간다.
    /// 같은 orderRef는 두 번 결제되지 않는다 (OrderExists, D-19). 서버는 결과를 모르는 제출 뒤에
    /// 같은 orderRef로만 다시 시도한다.
    function placeOrder(uint64 merchantId, bytes32 orderRef) external payable nonReentrant {
        if (vaultMode) revert WrongMode();
        address payout = _checkOrder(merchantId, orderRef, msg.value);
        _recordAndPay(payout, merchantId, orderRef, msg.value);
    }

    /// @notice 모드 V 결제. 선불 잔액에서 뺀다. 스파이크 S10에서 이 지급이 에이전트 한도로
    /// 집계되는 것이 확인될 때만 모드 V로 배포한다 (D-06).
    function placeOrderFromVault(uint64 merchantId, uint256 amount, bytes32 orderRef) external nonReentrant {
        if (!vaultMode) revert WrongMode();
        address payout = _checkOrder(merchantId, orderRef, amount);
        uint256 balance = vaultBalance[msg.sender];
        if (amount > balance) revert BadAmount();
        vaultBalance[msg.sender] = balance - amount;
        _recordAndPay(payout, merchantId, orderRef, amount);
    }

    /// @notice 모드 V 선불 충전. 묶인 에이전트에만 넣을 수 있다 (주인이 없으면 꺼낼 사람이 없다).
    function deposit(address agent) external payable nonReentrant {
        if (!vaultMode) revert WrongMode();
        if (agentOwner[agent] == address(0)) revert AgentNotBound();
        if (msg.value == 0) revert BadAmount();
        vaultBalance[agent] += msg.value;
        emit Deposited(agent, msg.sender, msg.value);
    }

    /// @notice 모드 V 선불 회수. 소유자만, 받는 주소는 소유자로 고정. 에이전트가 멈춰 있어도 된다.
    function withdraw(address agent, uint256 amount) external nonReentrant {
        address owner_ = agentOwner[agent];
        if (owner_ != msg.sender) revert NotAgentOwner();
        uint256 balance = vaultBalance[agent];
        if (amount == 0 || amount > balance) revert BadAmount();
        vaultBalance[agent] = balance - amount;
        emit Withdrawn(agent, owner_, amount);
        _send(owner_, amount);
    }

    /// @notice 가게 payout 또는 운영자가 결제 금액 그대로 돌려보내면 에이전트 소유자에게 전달한다.
    /// 에이전트 지갑을 다시 채우지 않는다. 주문 하나에 한 번, 전액만.
    function refund(bytes32 orderRef) external payable nonReentrant {
        Order storage o = orders[orderRef];
        if (o.status != OrderStatus.Paid) revert OrderNotPaid(orderRef);
        if (msg.sender != operator && msg.sender != merchants[o.merchantId].payout) revert NotOperator();
        if (msg.value != o.amount) revert BadAmount();
        o.status = OrderStatus.Refunded;
        address to = agentOwner[o.agent];
        emit Refunded(orderRef, to, msg.value);
        _send(to, msg.value);
    }

    // ---------------------------------------------------------------- 내부

    /// 체크만 한다 (tech-spec 5.2 의사 코드 순서). 통과하면 가게 payout을 돌려준다.
    function _checkOrder(uint64 merchantId, bytes32 orderRef, uint256 amount) private view returns (address) {
        if (agentOwner[msg.sender] == address(0)) revert AgentNotBound();
        if (agentPaused[msg.sender]) revert AgentIsPaused();
        Merchant storage m = merchants[merchantId];
        if (m.status != MerchantStatus.Active) revert MerchantNotActive(merchantId);
        if (amount == 0 || amount > type(uint128).max) revert BadAmount();
        if (orders[orderRef].status != OrderStatus.None) revert OrderExists(orderRef);
        return m.payout;
    }

    /// 효과(기록, 이벤트) 뒤에 상호작용(지급).
    function _recordAndPay(address payout, uint64 merchantId, bytes32 orderRef, uint256 amount) private {
        // amount는 _checkOrder가 uint128 상한을 확인했다. block.timestamp는 uint64를 넘지 않는다.
        // forge-lint: disable-next-line(unsafe-typecast)
        orders[orderRef] = Order(msg.sender, merchantId, uint128(amount), uint64(block.timestamp), OrderStatus.Paid);
        emit OrderPlaced(orderRef, msg.sender, merchantId, amount);
        _send(payout, amount);
    }

    /// 가스를 고정하지 않고 보낸다. 실패하면 전체를 되돌린다.
    /// 받는 주소는 부르는 쪽이 정한다: Active 가게 payout 또는 에이전트 소유자뿐 (불변식 1).
    function _send(address to, uint256 amount) private {
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
