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
- 번역어 세트: `glossary/ko-en.js` 수정 → push.
- 실측: `node bench/run.mjs [claude gemini google]` (서울 → Vercel → 엔진, 첫 글자·완료 중앙값). 로컬 시험: `node bench/local-test.mjs <엔진> "<문장>"` (셸 env 의 키 사용).
- 앱 쪽: 스트리밍 표시, 말하는 도중 미리 번역(인식이 400ms 멈추면 번역해 회색 임시 자막, 확정 시 교체), 시작 시 서버 예열.
