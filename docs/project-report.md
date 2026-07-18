# Momento 프로젝트 보고서

> 복기용 기록. 작업할 때마다 아래 항목을 이어서 업데이트한다.

---

## 프로젝트 주제
TxODDS World Cup Hackathon (Track 2) 참가작 — 실시간 축구 경기 이벤트를 5분짜리 한정 NFT 민팅 창으로 바꾸는 서비스 **Momento**.
골이 확정되는 순간(TxLINE 스트림 기준) 5분간 민팅 창이 열리고, 그 순간을 목격한 팬이 Solana devnet에 Metaplex Core NFT를 발행한다.

## 활동 목적
- 실시간 스포츠 데이터(TxLINE API)를 온체인 민팅과 연결하는 엔드투엔드 파이프라인을 직접 설계·구현해보는 것.
- 해커톤 심사 기준(작동하는 데모, 명확한 아키텍처 문서, 정직한 API 피드백)에 맞는 제출물을 만드는 것.

## 활동 목표
1. TxLINE 이벤트(GOAL/RESULT/VAR 취소) → DB 기록 → 온체인 민팅 창 개설까지 자동화.
2. 사용자가 지갑으로 실제 devnet NFT를 민팅할 수 있는 웹 UI 제공.
3. 데모/심사가 가능한 수준의 문서화(README, handoff, demo-script) 완비.

## 사용 기술
- **Next.js 14 (apps/web)** — UI + API 라우트
- **Node.js keeper (apps/keeper)** — TxLINE SSE 리스너, 이벤트 파서, 민팅 창 오케스트레이션
- **Anchor (Rust, programs/moment-mint)** — Solana 온체인 프로그램 (`open_moment_window`, `mint_moment`, `void_moment`)
- **Metaplex Core (mpl-core) + UMI** — 서버사이드 NFT 발행
- **PostgreSQL + Prisma** — Moment/Mint 레코드, 이미지(BYTEA), 메타데이터 JSON
- **@resvg/resvg-js** — SVG → PNG NFT 카드 이미지 렌더링
- **pnpm workspace 모노레포** — apps/*, packages/*(shared, image, txline)

## 기술 선택 이유
- **Metaplex Core**: 기존 Token Metadata 표준보다 계정 구조가 단순하고 민팅 비용(rent)이 낮아 해커톤 시간 내 대량 테스트 민팅에 적합.
- **resvg (SVG→PNG)**: 브라우저나 headless Chromium 없이 서버에서 가볍고 빠르게 카드 이미지를 생성할 수 있어 keeper 프로세스에 내장하기 용이함. 단, 브라우저 렌더러가 아니므로 이모지·시스템 폰트 의존은 피해야 함(아래 "문제 상황" 참조).
- **SSE + snapshot/replay 이중 검증**: TxLINE 라이브 스트림이 경기가 없을 때 조용해서(하트비트 없음) 실시간 검증이 어려움 → `/api/scores/updates/{fixtureId}`로 과거 이벤트를 재생해 결정론적으로 검증하는 방식을 채택.

---

## 작업 로그

### 2026-07-17 — NFT 이미지 템플릿 설계 확정 (설계는 직접, 구현만 위임)

**문제 상황 및 목표**
화면 UI(홈 드롭 카드 등)는 Top Shot풍 다크 테마로 새로 디자인했지만, 실제로 민팅되는 NFT PNG는 옛 Courier 블록아바타 플레이스홀더(`packages/image/src/templates.ts`)에 머물러 있었음. 이전 라운드에서 Claude Code에게 "화면과 일관된 디자인으로 바꿔라"는 방향만 주고 세부 설계는 맡겼더니 이 부분만 통째로 건너뛰었음(시간 내 완료 못함). 재발 방지를 위해 이번엔 **레이아웃 좌표, 색상, 폰트, 데이터 매핑 로직을 내가 직접 확정**하고, Claude Code에는 "이 스펙대로 구현만 하라"는 형태로 넘기기로 함.

**구체적 해결과정**
1. 실제 코드(`packages/image/src/templates.ts`, `render.ts`, `index.ts`)를 직접 읽어 현재 함수 시그니처(`GoalImageParams`, `ResultImageParams`, `renderGoalPng`, `renderResultPng`)를 확인 — 국가 코드/fixtureId 필드가 애초에 파라미터에 없다는 것도 이때 확인함(이전 프롬프트가 요구했던 "fixture #{id}" 푸터는 실제로 불가능했음).
2. 화면 목업(`momento_UI_home_mockup.html`)과 `page.tsx`의 색상/톤(다크 배경, 골드 `#c9952a`, 그린 포인트)을 기준으로 1080×1080 정사각 캔버스에 좌표 단위(x/y/폰트크기)까지 확정한 SVG 레이아웃을 설계.
3. resvg는 브라우저가 아니라서 (a) 국기 이모지가 렌더 안 되고 (b) 시스템 폰트에 의존할 수 없다는 점을 반영해, 국기 대신 "팀컬러 스와치 + 3글자 코드(예: ARG)" 방식을 쓰고, Anton(스코어/코드용)·Archivo Bold(본문용) TTF 두 개를 번들해 `loadSystemFonts:false`로 강제 로드하는 방식으로 확정.
4. 선수명(`scorerName`)은 실제 데이터에 득점자가 없을 때 팀명이 대신 들어오는 신뢰할 수 없는 필드라서 **디자인에서 아예 제외**하고, 팀·분·스코어·골타입 중심으로 재설계.
5. `templates.ts`/`render.ts`의 완성된 대체 코드를 직접 작성해 `클로드코드_프롬프트_NFT템플릿_설계확정.md`로 정리 — Claude Code는 이 코드를 그대로 적용하고 폰트 파일 다운로드·빌드·smoke test·실제 민팅 검증만 수행하도록 지시.

**결과(성과)**
- NFT 이미지 설계 스펙 확정 및 실행 가능한 코드로 문서화 완료 (구현·검증은 다음 Claude Code 실행 대기 중).
- 함수 시그니처 변경 없이(민팅 파이프라인 무변경) 이미지 디자인만 교체 가능한 형태로 설계함.

**배운점**
- 자율 에이전트(Claude Code)에게 "디자인+구현"을 통째로 맡기면 범위가 큰 항목(폰트/이미지처럼 시각 검증이 필요한 작업)은 후순위로 밀리거나 건너뛰기 쉬움. 좌표·색상·폰트까지 구체적으로 명세하고 "구현만" 맡기면 누락 위험이 줄어듦.
- resvg 같은 non-browser SVG 렌더러를 쓸 때는 이모지·시스템폰트 가정을 미리 배제하고 설계 단계에서부터 대안(코드/컬러 스와치, 번들 폰트)을 정해야 재작업이 없음.
- 파라미터에 실제로 없는 필드(fixtureId, 국가코드)를 있다고 가정한 채 프롬프트를 작성하면 에이전트가 그 부분에서 막히거나 임의로 지어냄 — 프롬프트 작성 전에 실제 인터페이스를 먼저 확인하는 습관이 필요함.

---

### 2026-07-17 — /api/mint 검증 로직 보강 (인증 누락 및 조용한 실패 수정)

**문제 상황 및 목표**

두 가지 실질적인 보안/신뢰성 결함이 존재했다.

1. **지갑 서명 검증 없이 민팅 가능(심각)**: `moment.momentPda`가 없는 경우(RESULT 타입 등 DB-only 경로) 서버가 `momentId + minter` 문자열만으로 keeper 지갑 비용의 NFT를 발행했다. 즉 누구든 타인 지갑 주소를 `minter`로 넣어 무제한 호출 가능. 온체인 검증 경로(`verifyTx`)도 "프로그램 ID가 계정 목록에 있는가"만 확인하고, minter가 실제 서명자인지·이 momentPda를 대상으로 했는지는 검증하지 않아 다른 사람의 정상 트랜잭션을 재사용해 front-running이 가능했다.
2. **NFT 발행 실패 시 200 성공 응답**: `mintCoreAsset` 예외를 catch로 삼키고 `no-keeper-key-{timestamp}` 가짜 assetId로 Mint 레코드를 생성한 뒤 200을 반환했다. 실제론 NFT가 없는데 DB와 클라이언트 양쪽이 성공으로 기록됨.

**구체적 해결과정**

1. **verifyTx 강화**: `getTransaction` → `getParsedTransaction`으로 교체해 각 계정의 `signer` 플래그를 직접 획득. 세 조건 모두 통과해야 `true` 반환: (a) PROGRAM_ID가 계정 목록에 있음, (b) `minter`가 `signer: true`인 계정 중 하나임, (c) `momentPda`가 계정 목록에 있음. 함수 시그니처를 `verifyTx(txSig, minter, momentPda)` 3인수로 변경하고 호출부도 수정.
2. **DB-only 경로 오프체인 서명 인증 추가**: `momentPda` 없는 경우 클라이언트(`MomentCard.tsx`)가 `signMessage`로 `"Momento mint authorization\nmoment:{id}\nwallet:{pubkey}\nts:{ts}"` 메시지에 서명하고 `messageSignature` + `messageTs`를 POST body에 실어 전송. 서버는 동일 메시지를 재구성해 `nacl.sign.detached.verify`로 검증(120초 만료 포함). `signMessage` 미지원 지갑이면 명확한 에러 메시지 표시.
3. **mintCoreAsset 실패 → 502 반환**: try/catch에서 에러를 삼키는 대신 `return NextResponse.json({ error, detail }, { status: 502 })`로 즉시 반환. `no-keeper-key-` 플레이스홀더 로직 제거. Mint 레코드는 실제 assetId가 확보된 후에만 생성됨.
4. **e2e-mint.ts 업데이트**: `tweetnacl` + `bs58` 임포트 추가. DB-only 경로에서 `nacl.sign.detached(msgBytes, keypair.secretKey)`로 동일 메시지에 서명하고 `postMint` 호출 시 `messageSignature` + `messageTs` 전달. dedup 체크(step 5)도 같은 필드 포함.
5. **패키지 추가**: `apps/web`에 `tweetnacl` + `bs58`, `apps/keeper`에 `bs58` 추가(`pnpm --filter` 사용).

**결과(성과)**

- messageSignature 없이 DB-only moment에 POST → **400** 반환 확인.
- 잘못된 서명으로 POST → **401** 반환 확인.
- `KEEPER_PRIVATE_KEY` 오류 시 → **502** 반환, Mint 레코드 미생성 확인.
- 온체인 경로: minter가 실제 서명자가 아닌 txSig 재사용 → **400** 반환 (verifyTx 강화).
- 기존 사용자 플로우(momentPda 있을 때: 트랜잭션 서명 팝업 1회, momentPda 없을 때: 메시지 서명 팝업 1회)는 그대로 유지.
- 알려진 제한사항: 온체인 ix 성공 후 서버 NFT 발행 실패 시 txSig는 이미 소모됐으나 Mint 레코드가 없어 수동 복구 필요 — `docs/SETUP_STATUS.md`에 기록.

**배운점**

- "작동하는 프로토타입"과 "프로덕션 준비 완료" 사이의 가장 큰 간극 중 하나는 인증 누락 — 특히 폴백 경로에서 인증을 건너뛰는 패턴은 정상 경로 테스트만으로는 발견되지 않음. 심사 시 "비정상 입력으로 직접 API를 두드린다"는 점을 항상 가정하고 설계해야 함.
- `catch`로 예외를 삼키면 실패가 성공처럼 보여 디버깅이 극도로 어려워짐. 서버사이드 민팅처럼 부작용이 있는 외부 호출은 반드시 실패를 호출자에게 전파하고, Mint 레코드 같은 상태 기록은 성공이 확인된 후에만 생성해야 함.
- 오프체인 메시지 서명(nacl.sign.detached)은 가스 없이 지갑 소유를 증명하는 가볍고 결정론적인 방법 — 온체인 트랜잭션을 보낼 수 없는 경로(타임아웃, 네트워크 오류, DB-only 모드)의 인증 대안으로 유용함.
