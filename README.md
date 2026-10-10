# SideCaption

KIRAMS IAEA 벨라루스 강의(2026-10-19~23)용 실시간 영어 자막. 한 문장은 한 언어(EN 또는 KO), 수동 전환.

- 실행: `./serve.sh` → Chrome/Edge 에서 http://localhost:8765/
- 키: E=영어 발화, K=한국어 발화(영어로 번역 표시), S=시작/정지, C=지우기
- ① 보조 스크린 모드: 좁은 자막 띠(좌/우, 폭·줄수 조절), 보조 스크린에 창 전체화면(F)
- ② 오버레이 모드(비상): Document PiP 항상-위 창, 2~4줄 — PPT 는 전체보기 말고 창 모드
- 엔진은 어댑터(`WebSpeechEngine`, `translateKoEn`) — 현장 투입 전 성능 좋은 STT·번역으로 교체 예정
