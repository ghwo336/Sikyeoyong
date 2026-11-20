#!/bin/sh
# pnpm contracts:deploy:testnet
# 테스트넷 배포 준비만 확인한다. 아무것도 배포하지 않고 체인에 아무것도 보내지 않는다.
# 실제 배포는 호재 님 승인 뒤에 아래 안내 명령을 직접 실행한다 (돈이 드는 체인 호출).
# 값은 출력하지 않는다. 있는지 없는지만 본다 (CLAUDE.md 5).

missing=0

check() {
  eval "value=\${$1:-}"
  if [ -n "$value" ]; then
    echo "  있음  $1  $2"
  else
    echo "  없음  $1  $2"
    missing=1
  fi
}

echo "SikyeoyongOrders 테스트넷 배포 준비 확인 (배포하지 않음)"
echo ""
echo "환경변수 (.env.example, tech-spec 8.3):"
check MAROO_RPC_URL "테스트넷 RPC"
check CHAIN_ID "기대 체인 ID. RPC의 eth_chainId와 다르면 스크립트가 멈춘다"
check POLICY_PROFILE "default 또는 demo (D-12). 프로필마다 프록시를 따로 배포한다"
check OPERATOR_KEY "운영자 키 (2단계 TS 스크립트용, 정책 admin). forge에는 keystore를 쓴다"

if ! command -v forge >/dev/null 2>&1; then
  echo "  없음  forge (Foundry)"
  missing=1
fi

echo ""
if [ "$missing" -ne 0 ]; then
  echo "빠진 값이 있다. 셸에 넣은 뒤 다시 확인한다 (예: set -a; . ./.env; set +a)."
  exit 1
fi

cat <<'GUIDE'
준비는 됐다. 실제 배포는 하지 않았다.
테스트넷 배포는 돈이 드는 체인 호출이라 호재 님 승인을 받은 뒤에만 아래를 실행한다.

1. 구현 컨트랙트 배포와 배포 기록 쓰기 (저장소 루트에서)
   먼저 --broadcast 없이 한 번 돌려 연습 실행을 본다 (기록을 쓰지 않는다).
   운영자 키는 keystore로 넣어 둔다 (한 번만): cast wallet import <keystore 이름> --interactive
   forge script contracts/script/Deploy.s.sol:Deploy --root contracts \
     --rpc-url "$MAROO_RPC_URL" --account <keystore 이름> --broadcast
   (keystore가 없으면 --account 대신 --interactive. --private-key는 키가 프로세스 목록에 보여 쓰지 않는다)
   기록: packages/shared/src/config/deployments/<chainId>.<profile>.json (proxy, deployBlock, policyHash는 0)
   전송이 실패하면 사람이 기록 파일을 지우고(스크립트는 지우지 않는다) 원인을 확인한 뒤 다시 한다 (자동 재시도 금지).

2. 프록시와 정책 (infra/scripts/deploy-orders.ts, 아직 없음. Q-13 확인 뒤)
   deployPclProxy(UUPS), initialize(operator, owner, false), 같은 운영자 키로 changeContractPolicies 첫 호출,
   contractPolicies 재조회, 배포 기록의 proxy, deployBlock, policyHash 채우기.
   순서와 이유는 contracts/script/Deploy.s.sol 주석과 docs/wiki/components/contracts.md "배포 순서".

3. 배포 주소와 트랜잭션 해시를 docs/wiki/log/worklog.md에 남긴다.
GUIDE
