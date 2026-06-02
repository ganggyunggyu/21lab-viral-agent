# Patch Notes

## 2026-05-29

- 자동발행 Slack 알림 포맷 간소화: OK 계정 전체 나열을 생략하고 `상태 요약 → 확인 필요 → 조치` 구조로 보이도록 `format-auto-publish-slack.mjs` 포맷터 추가.
- 자동발행 보고 지침 업데이트: `dm-20`, `dm-22`, `dm-23` 자동화 메모리와 `auto-publish-review` 스킬에 간소화 포맷 사용 규칙 추가.

## 2026-05-14

- Slack DM 발송 지침 추가: Slack API/커넥터가 아니라 21lab Slack Desktop UI/CDP 경로를 사용하도록 `AGENTS.md`에 명시.
- OpenClaw Slack DM 허용 정책 변경: `dmPolicy`를 `open`, `allowFrom`을 `["*"]`로 설정해 모든 Slack 계정 DM 호출을 허용.
- 로컬 Codex Slack Bot 재시작: 변경된 OpenClaw Slack 허용 정책이 적용되도록 봇 프로세스를 재시작.
- 패치노트 기록 지침 추가: 기능, 설정, 자동화, 지침 변경 시 `docs/PATCH_NOTES.md`에 누적 기록하도록 `AGENTS.md`에 명시.
- Slack 캔버스 자동화 상태 정정: launchd 기준 자동화 22개로 재분류. `auto-pull-all` 10개 시간, `codex-sync` 10개 시간, 상시 실행 2개를 명시.
- Slack 캔버스 직원용 구조 재정리: 기술 경로 중심 설명을 업무 용도, 자동화 시간, 요청 문구, 시트별 확인 내용, 보고 대상 기준으로 재구성.
