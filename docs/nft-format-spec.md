# Momento NFT Format Spec
> 나노바나나 이미지 생성 → DB 삽입 → 민팅 데모용

---

## 1. 이미지 스펙 (나노바나나 생성 기준)

| 항목 | 값 |
|------|-----|
| 크기 | **800 × 800 px** (정사각형, Magic Eden 표준) |
| 포맷 | PNG (투명도 없이) |
| 배경 | 다크 (#070710 계열) |
| 스타일 | 스포츠 트레이딩 카드 — 어두운 배경 + 팀 색상 액센트 |

### GOAL 카드에 들어갈 요소
- 상단: `MOMENTO` 로고 or 워터마크 + `FIFA WORLD CUP 2026`
- 중앙 크게: 골 넣은 팀 이름 + 골 분 (`ARGENTINA — 23'`)
- 스코어: `CABO VERDE  0 – 1  ARGENTINA`
- 배지: `GOAL` (골드 컬러) / `PENALTY` / `OWN GOAL` 해당 시
- 하단: `Moment #[ID]` + `Limited Edition`

### RESULT 카드에 들어갈 요소
- 상단: `FULL TIME` + `FIFA WORLD CUP 2026`
- 중앙: 최종 스코어 크게 + 승자 팀명
- 하단: `Moment #[ID]` + `Limited Edition`

---

## 2. Metaplex 메타데이터 JSON 포맷

```json
{
  "name": "Argentina Goal · 23' [Momento #6]",
  "description": "FIFA World Cup 2026 · Cabo Verde vs Argentina · Goal at 23' (0–1)",
  "image": "https://<hosted-url>/moment-6.png",
  "external_url": "https://momento.app/moment/6",
  "attributes": [
    { "trait_type": "Competition",  "value": "FIFA World Cup 2026" },
    { "trait_type": "Stage",        "value": "Group Stage" },
    { "trait_type": "Home Team",    "value": "Cabo Verde" },
    { "trait_type": "Away Team",    "value": "Argentina" },
    { "trait_type": "Kind",         "value": "GOAL" },
    { "trait_type": "Minute",       "value": 23 },
    { "trait_type": "Score",        "value": "0–1" },
    { "trait_type": "Goal Type",    "value": "regular" }
  ],
  "properties": {
    "files":    [{ "uri": "https://<hosted-url>/moment-6.png", "type": "image/png" }],
    "category": "image"
  }
}
```

---

## 3. 생성 흐름 (데모용)

```
나노바나나로 이미지 생성
    → PNG 파일 or 호스팅 URL 확보
    → DB에 imageUrl 업데이트 (아래 명령 사용)
    → 메타데이터 JSON을 Arweave/IPFS or DB에 저장
    → metadataUrl 업데이트
    → /api/mint 호출 → Metaplex Core NFT 발행 → 지갑 착지
```

---

## 4. DB 업데이트 명령 (이미지 URL 확보 후 실행)

```sql
-- 이미지 URL만 업데이트 (외부 호스팅 URL 사용 시)
UPDATE "Moment"
SET "imageUrl"    = 'https://<hosted-url>/moment-<ID>.png',
    "metadataUrl" = 'http://localhost:3000/api/moments/<ID>/metadata'
WHERE id = <ID>;

-- imageData를 직접 넣을 경우 (파일 → base64 → psql은 번거로우니
-- 아래 Admin API 엔드포인트를 사용할 것)
```

---

## 5. Admin API (이미지 URL 주입용 — 데모 전용)

`PATCH /api/admin/moment/:id`

```json
{
  "imageUrl": "https://arweave.net/xxxx",
  "metadataUrl": "https://arweave.net/yyyy"   // 선택, 없으면 /api/moments/:id/metadata 자동 사용
}
```

---

## 6. 피칭/제출용 — API 비용 발생 구간 (공백 처리)

| 구간 | 설명 | 데모 상태 |
|------|------|-----------|
| 실시간 스코어 | TxLINE / football-data.org API | **`TXLINE_API_KEY=<blank>`** — keeper는 replay 모드로 시연 |
| 이미지 생성 | AI 이미지 생성 API | **수동 삽입** (나노바나나 생성물 직접 DB에 주입) |
| 메타데이터 호스팅 | Arweave / IPFS 업로드 | **DB 서빙** (`/api/moments/:id/metadata`) 으로 대체 |
| Solana RPC | devnet 무료, mainnet은 유료 | **devnet** 사용 |

> 제출 README에는 각 구간의 환경변수명과 연동 방법만 기술,
> 실제 키 없이도 replay 모드 + 수동 이미지로 전체 플로우 시연 가능.
