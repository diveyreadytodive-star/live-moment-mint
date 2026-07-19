# Momento — Final GO (엔드투엔드 실행 가이드)

이 문서 하나로 데모까지 간다. 코드는 **재배포 전/후 둘 다 자동 대응**하도록 패치됨.
스위치는 환경변수 `NEXT_PUBLIC_MPL_CORE_MINT` 하나.

---

## 지금 상태 (2026-07-19 최종 패치 기준)

| 레이어 | 상태 |
|--------|------|
| 클라이언트 (`moment/[id]/page.tsx`) | ✅ 2계정/5계정 자동 스위치 (`NEXT_PUBLIC_MPL_CORE_MINT`) |
| 서버 (`api/mint/route.ts`) | ✅ 온체인 tx 검증 + (있으면) asset signer 검증. SPL 발행 제거 |
| IDL | ✅ 소스(lib.rs)와 동일한 5계정 (재배포 후 정본) |
| 배포 프로그램 (devnet) | ⚠️ mpl-core CPI 없는 옛 버전 → 진짜 NFT 원하면 재배포 필요 |
| devnet 검증 | ✅ open_moment_window / mint_moment 시뮬레이션 성공 (err:null) |

**두 가지 데모 트랙 중 택1:**

- **트랙 A (재배포 없이, 지금 바로 가능):** 실시간→온체인 window(PDA 실재)→한정 민팅
  트랜잭션(Explorer 실재). 지갑에 뜨는 NFT asset은 없음. → 아래 "3. 데모"만 하면 됨.
- **트랙 B (진짜 NFT):** 프로그램 재배포 후 `NEXT_PUBLIC_MPL_CORE_MINT=1`. → "2. 재배포"부터.

---

## 1. 사전 준비 (공통)

```bash
# 데모용 devnet 지갑에 SOL (민팅 rent + (재배포 시) 프로그램 배포비)
solana airdrop 2 <WALLET> --url devnet     # 또는 https://faucet.solana.com
```

⚠️ **보안:** 비밀키를 채팅/URL/로그에 붙여넣지 말 것. 이번 작업 중 노출된 devnet 키페어와
`.git/config`에 박힌 GitHub PAT 2건은 폐기·재발급 대상. (docs/REDEPLOY_GUIDE.md 참고)

---

## 2. 재배포 (트랙 B에서만) — 원클릭

```bash
KEEPER=./devnet-keeper.json ./scripts/redeploy.sh
```

이 스크립트가 자동으로: 툴체인 체크 → `.so` 빌드(anchor build --no-idl, 실패 시 cargo build-sbf)
→ 배포(기존 keypair 있으면 업그레이드, 없으면 새 id + 교체지점 안내) → open+mint 검증.

성공 시 마지막에 `🎉 asset owned by Metaplex Core` 출력. 그러면:

```
# Vercel 환경변수에 추가 후 web 재배포
NEXT_PUBLIC_MPL_CORE_MINT=1
# (프로그램 id가 바뀐 경우) NEXT_PUBLIC_MOMENTO_PROGRAM_ID=<새 id>, MOMENTO_PROGRAM_ID=<새 id>
```

빌드가 rustc/platform-tools 문제로 막히면 REDEPLOY_GUIDE.md의 트러블슈팅 참고.
재배포가 시간 내 안 되면 **트랙 A로 데모**하면 됨(핵심 서사는 그대로 성립).

---

## 3. 데모 — 새 민팅 창 열기

기존 demo moment(id 1-3)는 close_ts가 지나 "CLOSED"다. **새 창을 열어야** 민팅 버튼이 뜬다.

### 방법 A — 풀 UI 데모 (REPLAY, 권장)
keeper를 replay로 돌리면 Argentina 2-1 Switzerland 경기의 골 4개가 미래 close_ts로 열리고
홈이 SSE로 실시간 갱신됨:

```bash
DATABASE_URL=<neon-url> \
PUBLIC_BASE_URL=https://<your-app>.vercel.app \
KEEPER_PRIVATE_KEY='[...]' \
MOMENTO_PROGRAM_ID=CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja \
./scripts/demo-open-window.sh replay
```

→ 웹 홈에서 새 순간 카드가 뜨고, 카운트다운이 도는 동안 지갑으로 민팅.
   지갑에 **트랜잭션 서명** 팝업이 뜨면 온체인 경로 진입 성공.

### 방법 B — 가장 빠른 단건 검증 (keeper 없이)
```bash
KEEPER=./devnet-keeper.json ./scripts/demo-open-window.sh single
# 트랙 B(재배포 후)면 MPL_CORE_MINT=1 을 앞에 붙여 진짜 NFT 생성 확인
```

---

## 4. 촬영 체크리스트

1. 홈: 실시간으로 순간 카드가 열리는 장면 (REPLAY의 SSE 푸시)
2. 순간 상세: 카운트다운(한정 시간) + Mint 버튼
3. 민팅: 지갑 트랜잭션 서명 → 성공
4. Explorer: 트랜잭션(그리고 트랙 B면 NFT asset) 실재 확인
5. (트랙 B) 지갑/컬렉션에 NFT 표시

---

## 5. 실행 순서 요약 (한눈에)

```
[트랙 A — 지금 바로]
  1) 데모 지갑 SOL 확보
  2) ./scripts/demo-open-window.sh replay  (또는 single)
  3) 웹에서 민팅 → Explorer 확인 → 촬영

[트랙 B — 진짜 NFT]
  1) 데모 지갑 SOL 확보 (배포비 포함 2+ SOL)
  2) ./scripts/redeploy.sh                 → 🎉 확인
  3) Vercel: NEXT_PUBLIC_MPL_CORE_MINT=1 (+ 바뀐 program id) → web 재배포
  4) ./scripts/demo-open-window.sh replay
  5) 웹에서 민팅 → 지갑에 NFT → 촬영
```
