# AI4Caption · 동시자막

> 이름 이력 (2026-10-11): SideCaption → SimulCap → **AI4Caption**. 자막 위치가 좌·우를 넘어 상·하·좌·우로 넓어졌고, 자막·통역(KO→EN)·번역어 세트 반영(예정)까지 포괄하므로 위치·방식이 아닌 역할로 이름을 잡았다. `ai4radmed` 제품군 명명(ai4…)과 일치.

KIRAMS IAEA 벨라루스 강의(2026-10-19~23)용 실시간 영어 자막. 한 문장은 한 언어(EN 또는 KO), 수동 전환.

## 설치 (팀 노트북 — **Google Chrome 전용**)

Chrome 고정: STT(Chrome 음성인식)·번역이 모두 Google 경로라 사전 점검 환경 = 현장 환경. 다른 브라우저로 열면 경고가 뜨고 시작이 막힌다. 기본 브라우저를 바꿀 필요는 없다(설치한 앱은 항상 Chrome 으로 뜬다).

0. Chrome 이 없으면 설치 (관리자 권한 없이 사용자 단위 설치 가능 — 기관 정책 확인)
1. **Chrome 을 직접 열고** 주소 입력: **https://ai4radmed.github.io/ai4caption/** (메일 링크 클릭은 기본 브라우저로 열리므로 피함)
2. 주소창 오른쪽 **앱 설치** 아이콘 클릭 → *설치* (없으면 `⋮` → 전송, 저장, 공유 → *페이지를 앱으로 설치*)
3. 바탕화면·시작 메뉴의 **AI4Caption** 아이콘으로 실행 → 첫 시작 때 마이크 **허용**

- 점검: 현장 망에서 Google 음성인식·`translate.googleapis.com` 접속 확인, 핫스팟 백업 준비.
- 업데이트: `main` 에 push 하면 Pages 가 재배포 → 앱을 다시 열면 최신본(네트워크 우선 캐시).
- 인터넷 필수: STT(브라우저 음성인식)·번역이 모두 온라인 서비스. 오프라인이면 화면만 열리고 자막은 안 나온다.
- 제거: 앱 창 `⋮` → *AI4Caption 제거*.

## 개발 (로컬)

- `./serve.sh` → http://localhost:8765/ (file:// 로 열면 마이크·BroadcastChannel·서비스워커 불가)
- 서비스워커 때문에 옛 화면이 보이면 강력 새로고침(Ctrl+Shift+R)

## 사용
- 키: E=영어 발화, K=한국어 발화(영어로 번역 표시), S=시작/정지, C=지우기
- ① 보조 스크린: 보조 모니터·프로젝터가 따로 있을 때 좌/우 세로 띠(폭·줄수·세로 위치 조절), 보조 스크린에 창 전체화면(F)
- ② 오버레이: 발표 화면(PPT) 위에 겹치는 자막 띠 — Document PiP 항상-위 창. 위치 상·하(폭 전체)·좌·우(높이 전체, 폭 % 조절), 1~10줄. 첫 실행 때 창을 원하는 가장자리로 끌어다 놓기. PPT 는 읽기용 보기/창 모드 권장
- 엔진은 어댑터(`WebSpeechEngine`, `translateKoEn`) — 현장 투입 전 성능 좋은 STT·번역으로 교체 예정

## 번역 중계 서버 (`api/translate.js` — Vercel Edge, 서울 icn1)

앱 → `https://ai4caption.vercel.app/api/translate` → 번역 엔진. **API 키는 Vercel env 에만** 있고 팀 노트북·저장소에는 없다.

| env | 엔진 | 비고 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude (`CLAUDE_MODEL`, 기본 `claude-haiku-5-5`) | 사고 끔, 시스템 프롬프트(용어집 포함) 캐시. Console 워크스페이스 월 지출 한도로 하드캡 |
| `GEMINI_API_KEY` | Gemini (`GEMINI_MODEL`, 기본 `gemini-flash-lite-latest`) | 무료 등급(분당 10회)은 실시간에 부족 — 유료 등급 키 |
| `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation v2 | 번역 전용(가장 빠름). 용어집은 사전 치환으로 근사 |

- 엔진 순서(자동): claude → gemini → google. 첫 글자가 나오기 전 실패하면 다음 엔진으로 넘어간다. 키가 없는 엔진은 건너뛴다.
- 서버가 전부 실패하면 앱이 **확정 문장만** 무료 gtx 로 번역한다(미리 번역은 생략).
- `GET /api/translate` = 예열 + 설정된 엔진 표시(앱이 시작 시 호출). Origin 허용 = `ai4radmed.github.io`·localhost.
- 배포: Vercel 이 GitHub `main` 과 연결돼 있어 **push 하면 Pages(앱)와 Vercel(서버)이 함께 자동 배포**된다. env 변경 후에는 Redeploy 필요.
- 용어 결정(2026-10-12): 철자는 ICRP 원문(영국식) 유지, 납치마=lead apron, 태아=fetus, 방사선안전관리자=RSO, 방사선사=radiographer / 핵의학 기사=nuclear medicine technologist.
- 번역어 세트(용어집) 정본 = **`glossary/ko-en.tsv`** (탭 구분: `ko` · `en` · `aliases`(;로 구분) · `source` · `note`). Excel·메모장으로 고쳐 push → Pages 반영 후 **서버가 1분 안에 새로 읽음**(서버 재배포 불필요). 서버가 못 읽으면 `glossary/seed.js` 비상 목록.
- 용어 적용: 띄어쓰기 무시 매칭 + 별칭(음성인식 변형) → **그 문장에 나온 용어만** 엔진에 전달(긴 용어 우선) → 앱 로그에 `✓ 용어 n` / `⚠ 용어 미반영: 한글→영문` 표시.
- 실측: `node bench/run.mjs [claude gemini google]` (서울 → Vercel → 엔진, 첫 글자·완료 중앙값). 로컬 시험: `node bench/local-test.mjs <엔진> "<문장>"` (셸 env 의 키 사용).
- 앱 쪽: 스트리밍 표시, 말하는 도중 미리 번역(인식이 400ms 멈추면 번역해 회색 임시 자막, 확정 시 교체), 시작 시 서버 예열.

## 보류 / 향후 (2026-10-13 결정, Dr. Ben)

현장 투입(2026-10-19~23)까지 6일이라 **검증된 ko→en 경로를 건드리지 않기로** 하고 아래 두 가지는 보류한다. 코드가 어려워서가 아니라 *검증할 시간·사람이 없어서*다.

| 항목 | 현재 | 보류 사유 | 재검토 조건 |
|---|---|---|---|
| **언어쌍 확장** (en→ko·ko→ru·ru→en·ru→ko 등) | 발화 EN(그대로 표시)·KO(→영어) 두 모드만 | 러시아어 음성인식·전문용어 번역을 검수할 사람·시간이 없음. 미검증 쌍을 현장에 노출하면 오번역 위험만 늘어남 | 방문 후, 러시아어 검수자 확보 시. 방문자의 영어 이해도·필요 방향(영한 우선인지 한러 우선인지) 확인 후 |
| **마이크 2개 화자 구분 표시** | Web Speech API 인스턴스 1개 = 기본 마이크 1개 | 장치 선택·동시 2인스턴스를 Web Speech API 로 보장할 수 없고, 클라우드 STT 교체는 키·비용·토큰 중계·지연 시험이 필요 | 방안 A(`start(audioTrack)` Chrome 동작·동시 2인스턴스) 5분 시험 → 안 되면 방안 B(클라우드 STT, README "엔진 교체 예정"과 같은 작업) |

**확장 시 바꿀 곳** (코드 조사 결과)
- 발화·자막 언어를 쌍으로 선택하는 UI, `begin()` 의 STT 언어코드(`en-US`/`ko-KR` 하드코딩).
- `api/translate.js`: 시스템 프롬프트("Korean → English")·Google `source:'ko', target:'en'`을 `src`/`tgt` 변수로.
- `index.html`: gtx 폴백(`sl=ko&tl=en`)·`ctxKo` 문맥·용어 검증(`checkTerms`).
- 용어집: `ko-en.tsv` 를 뒤집어 en→ko 에 재사용 가능. 러시아어 열은 없음(신규 작성·검수 필요).
- 마이크 구분 표시는 자막 줄 데이터에 마이크 필드를 하나 더 넣고 색·라벨로 구분하면 됨(표시 자체는 쉬움). 어려운 것은 입력 쪽(장치별 STT)과 마이크 간 혼입(크로스토크) 차단.

**방문자 질문 대응(이번 방문)**: 영한 번역은 구현하지 않으므로 방문자 질문은 영어 원문으로 확인하고 구두로 답한다. 화면에는 한국어 발화의 영어 자막만 나간다.
