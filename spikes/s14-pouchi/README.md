# S14 파우치 스파이크 (테스트넷만)

결과와 판단은 `docs/_research/spikes/S14.md`, 파우치에 물을 것은 `docs/_research/pouchi-questions.md`.
이 폴더는 pnpm 작업공간 밖이다. `apps/`는 여기를 가져다 쓰지 않는다 (호재 님 결정, 2026-11-20).

## browser/ : Browser SDK (`@nc-waas/sdk` beta.8), 시켜용에 넣을 경로 확인
- 할 일: 임베디드 로그인으로 앱 전용 지갑 만들기, 다음에 `createSignRequest`로 컨트랙트 호출(sender 확인, 소유자 일).
- SDK 받기 (tarball은 커밋하지 않는다, `spikes/**/vendor/`는 git 무시):
  ```sh
  cd spikes/s14-pouchi/browser
  mkdir -p vendor && curl -sSL -o vendor/nc-waas-sdk-0.1.0-beta.8.tgz https://auth.pouchi.io/downloads/npm/nc-waas-sdk-0.1.0-beta.8.tgz
  # auth.pouchi.io/downloads/manifest.json의 currentWebSdk.sha256과 대조
  echo "8208dbc51bc2616f0ca0b1c2a32c1c505831f11a5d7a55c6121aff9ea088b50e  vendor/nc-waas-sdk-0.1.0-beta.8.tgz" | shasum -a 256 -c
  npm install --ignore-scripts
  ```
- 실행: 앱 키는 저장소 루트 `.env.pouchi`(CLI `pouchi keys create`가 만든 파일, 0600, git 무시)에서 서버만 읽는다. 브라우저로 보내지 않는다.
  ```sh
  CHAIN_ID=450815 npm run dev   # http://localhost:3000 (파우치에 등록한 출처라 포트를 바꾸지 않는다)
  ```
  `apps/web` 개발 서버도 3000을 쓰므로 둘 중 하나만 띄운다.

## react/ : React SDK (`@shard-lab/nc-waas-react`), 세션 키 한도와 sender 확인용 일회성 실험 (아직 없음)
- GitHub Packages 토큰은 호재 님이 `~/.npmrc`에 넣는다. 저장소에 두지 않는다.
