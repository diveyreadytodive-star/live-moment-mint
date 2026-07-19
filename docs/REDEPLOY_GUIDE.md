# Momento 프로그램 재배포 가이드 (온체인 NFT 민팅 활성화)

> 목적: devnet에 배포된 `moment-mint` 프로그램을 **mpl-core CPI가 포함된 최신 소스**로
> 재배포해서, `mint_moment`가 실제 Metaplex Core NFT를 생성하게 만든다.
>
> 배경: 2026-07-19 시뮬레이션으로 확인된 사실 — 현재 devnet 배포본은 `mint_moment`가
> `mint_count`만 증가시키고 이벤트만 emit하는 **옛 버전**이다 (mpl-core CPI 없음).
> 소스 `lib.rs`에는 `CreateV1CpiBuilder` CPI가 이미 있으나 재배포가 안 된 상태.
> SETUP_STATUS.md에도 "mpl-core CPI = Next Steps(미완료)"로 기록돼 있었음.

---

## ⚠️ 보안 경고 (먼저 읽을 것)

- **비밀키(secret key, 64바이트/128 hex 또는 `[n,n,...]` JSON 배열)를 채팅·이슈·로그·URL 어디에도 붙여넣지 말 것.**
  2026-07-19 세션에서 devnet keypair 시크릿키가 대화에 노출됨 → 그 키페어는 **폐기(burn)** 하고 새로 만들 것.
- 재배포·서명·자산 이동은 **본인 로컬 터미널에서만** 실행한다. 자동 에이전트에 키를 넘기지 않는다.
- git 원격 URL에 박힌 GitHub PAT 2건(`.git/config`)도 revoke·재발급 대상.

---

## 0. 사전 준비물

- Rust + Solana CLI + Anchor 설치 (아래 버전 권장)
  - Solana CLI 1.18.x 이상
  - Anchor 0.30.1 (프로그램 Cargo.toml 기준)
- devnet SOL: 프로그램 재배포는 **1~3 SOL** 정도 필요 (프로그램 크기에 따라). 민팅 테스트용 0.01 SOL 별도.
- 배포 authority 키페어: 기존 upgrade authority = `CSrPnu3y3vUeRPpJmsVukXyDZbHKLw7sFyweSubj97ve`
  (프로그램을 업그레이드하려면 이 authority 키페어가 있어야 함. 없으면 새 program id로 배포해야 함 — 아래 참고)

```bash
solana --version
anchor --version
solana config set --url devnet
solana address                # 현재 지갑 확인
solana balance                # devnet SOL 잔액 확인
```

SOL이 부족하면:
```bash
solana airdrop 2 --url devnet          # 자주 rate-limit 걸림
# 또는 https://faucet.solana.com 에서 수동 요청
```

---

## 1. 빌드

```bash
cd programs/moment-mint
anchor build
```

**알려진 이슈 (SETUP_STATUS.md 기록):**
`anchor build`의 IDL 생성 단계가 `proc_macro2::Span::source_file()` rustc 호환성 문제로
실패할 수 있음. 그래도 **`.so` 바이너리 컴파일은 정상**이라, IDL 실패는 무시하고 진행 가능.
IDL은 이미 손으로 맞춘 `idl/moment_mint.json`(2026-07-19에 mint_moment 계정 5개로 동기화 완료)을 쓴다.

IDL 생성만 실패하고 .so는 빌드하려면:
```bash
anchor build --no-idl
# 또는 cargo build-sbf 직접 사용
cargo build-sbf
```

빌드 산출물 위치 확인 (버전에 따라 경로 다름):
```bash
ls -la target/deploy/moment_mint.so 2>/dev/null
ls -la target/sbpf-solana-solana/release/moment_mint.so 2>/dev/null
```

**mpl-core 의존성 주의:** `Cargo.toml`에 `mpl-core = "0.7"`이 있으므로 이 crate가 함께 컴파일된다.
빌드 시간이 길고, `@noble/hashes`/sha3 관련 이슈가 과거 리포트에 있었음(웹 번들 쪽). 프로그램(Rust) 빌드에서
버전 충돌이 나면 `cargo update -p <crate>`로 맞춘다.

---

## 2. 배포 (업그레이드)

기존 program id(`CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja`)를 **업그레이드**하려면
upgrade authority 키페어로 서명해야 한다:

```bash
# .so 경로는 1단계에서 확인한 실제 경로로 교체
solana program deploy \
  target/deploy/moment_mint.so \
  --program-id target/deploy/moment_mint-keypair.json \
  --keypair <UPGRADE_AUTHORITY_KEYPAIR.json> \
  --url devnet
```

- `--program-id`에 넘기는 keypair는 **program account의 keypair** (주소가 CL6e7...F7ja여야 함).
- `--keypair`는 **fee/authority 지갑** (SOL 지불 + upgrade authority).

업그레이드 authority 키페어가 없다면 기존 program id 업그레이드 불가 →
**새 program id로 신규 배포**해야 하고, 그 경우 아래를 모두 새 id로 교체:
- `programs/moment-mint/src/lib.rs`의 `declare_id!(...)`
- `apps/web/src/app/moment/[id]/page.tsx`의 `PROGRAM_ID`
- `apps/web/src/app/api/mint/route.ts`의 `PROGRAM_ID`
- `apps/keeper/src/scripts/open-and-mint.ts`의 `PROGRAM_ID`
- `.env` / Vercel의 `MOMENTO_PROGRAM_ID`, `NEXT_PUBLIC_MOMENTO_PROGRAM_ID`
- 그리고 `open_moment_window`를 다시 호출해 새 프로그램 하의 window를 만들어야 함(기존 PDA는 옛 프로그램 소유).

---

## 3. 배포 검증 (재배포가 실제로 반영됐는지)

`open-and-mint.ts` 스크립트로 open+mint를 한 방에 실행:

```bash
cd apps/keeper
KEYPAIR_PATH=<민팅용 devnet 지갑.json> \
SOLANA_RPC_URL=https://api.devnet.solana.com \
npx ts-node src/scripts/open-and-mint.ts
```

**성공 판정 (로그에서 반드시 확인):**
- `mint_moment` 실행 중에 `Program CoREENx...hX7d invoke [2]` (mpl-core CPI)가 찍혀야 함.
- 마지막에 `🎉 SUCCESS — asset is owned by Metaplex Core.` 출력.
- Explorer에서 asset 주소의 owner가 `CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d` 여야 진짜 NFT.

**실패 신호 (아직 옛 프로그램):**
- `MintMoment` 로그에 mpl-core invoke가 없고 compute units가 수천 단위로 작으면 → 재배포가 반영 안 된 것.
- asset 계정이 아예 안 생기면 → 마찬가지로 CPI 없는 옛 버전.

---

## 4. 재배포 없이 데모만 살리는 대안 (시간 부족 시)

재배포가 한 시간 내 불확실하면, "실시간 → 온체인 window 개설(PDA 생성) → 한정 민팅"까지를
데모의 온체인 서사로 삼는다. 이 경우:
- `open_moment_window`는 **시뮬레이션으로 성공 확인됨**(2026-07-19) → 실제로 PDA가 온체인에 생성됨.
- `mint_moment`도 트랜잭션 자체는 성공(mint_count 증가 + MintEvent emit) → Explorer에 트랜잭션 실재.
- 다만 asset(NFT 계정)은 생성되지 않으므로, UI에서 "NFT asset" 대신 "온체인 민팅 기록(PDA + tx)"을 강조.
- 서버는 온체인 tx를 검증만 하고 DB에 컬렉션 기록. (SPL 서버 발행 로직은 이미 제거됨.)

이 경로는 "진짜 온체인 트랜잭션 + 한정 민팅 로직"은 보여주되 "지갑에 뜨는 NFT"는 재배포 후로 미루는 절충안.
