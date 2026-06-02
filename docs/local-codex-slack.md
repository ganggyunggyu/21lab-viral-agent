# Local Codex Slack Bot

Slack Socket Mode events are handled directly by a local Node service.

Flow:

1. Slack DM or mention arrives at the Slack app.
2. `scripts/local-codex-slack-bot.mjs` receives the event.
3. The service maps the Slack DM or thread to a persistent Codex session.
4. The service calls local `codex exec` for a new conversation or `codex exec resume` for an existing conversation.
5. Codex reads `AGENTS.md`, recent Slack context, and local filesystem state.
6. The service posts Codex's final answer back to the Slack thread.

Runtime:

- Script: `scripts/local-codex-slack-bot.mjs`
- Workspace: `/Users/gyunggyugang/Documents/Codex/2026-05-06/21lab`
- Logs: `/Users/gyunggyugang/.codex/slack-direct/logs`
- Session map: `/Users/gyunggyugang/.codex/slack-direct/state/sessions.json`
- LaunchAgent: `~/Library/LaunchAgents/ai.21lab.local-codex-slack.plist`

Secrets:

- The service reads existing Slack app/bot tokens from `/Users/gyunggyugang/.openclaw/openclaw.json`.
- Token values must not be committed, printed, or copied into repo files.

Operational note:

- OpenClaw Slack intake should remain disabled while this service is active.
- Running both Socket Mode consumers for the same Slack app can cause duplicate or missed events.

## Local Codex skills

Local custom skills live under `/Users/gyunggyugang/.codex/skills`.

The Slack bot should treat these as executable work instructions. When a Slack request matches a skill trigger, Codex must open that skill's `SKILL.md` and follow its workflow instead of guessing commands.

Current custom skills:

| Skill | Use when the Slack request says | Main action |
| --- | --- | --- |
| `auto-publish-review` | 자동발행 검토, 오늘 자동발행 체크, 18:00 발행 검토 | Check today's Naver blog auto-publish status from `blog-scheduler-server` and report to 강경규 DM through Slack Desktop UI/CDP. |
| `blog-package-exposure-check` | 패키지 노출체크, 흑염소 구 노출체크, 루트 노출체크, package exposure check | Run the selected `blog-cron-bot` exposure target and send the routed Slack Desktop UI/CDP report. |
| `blog-page-exposure-check` | 페이지 노출체크, 페이지 전체 체크, 멀티페이지 크론 | Run the full page exposure check, parse unexposed rows, and send the routed report. |
| `dogmaru-exposure-check` | 도그마루 노출체크, 도그마루 미노출 키워드 | Run the dogmaru exposure check and send the deduplicated unexposed keyword report. |
| `general-exposure-check` | 일반건 노출체크, 도그마루 제외 노출체크 | Run the dogmaru-exclude/general exposure check and send the deduplicated report. |
| `guideline-folder-creator` | `지침생성_이름`, 직원 지침 폴더 생성 | Create the standard employee guideline folder under `/Users/gyunggyugang/Documents/직원지침`. |
| `image-processor` | 이미지 입력 폴더 처리, 키워드 카테고리 생성, S3 업로드 준비 | Process blog image input folders for pet, ophthalmology, or Alibaba workflows and validate outputs. |
| `karpathy-guidelines` | 코드 작성, 리뷰, 리팩터링에서 실수 방지 기준이 필요할 때 | Apply conservative coding guidelines: small scoped changes, explicit assumptions, verifiable success criteria. |
| `root-thursday-exposure-compare` | 루트 목요일 비교, 루트 오전 대비 오후 비교, 16:00 root report | Run the Thursday afternoon root exposure check, compare with morning CSV, and report to 위대한 DM. |

Skill rules:

- Do not print or copy token values from `/Users/gyunggyugang/.openclaw`.
- External sending through Slack is allowed only when the matched skill explicitly defines that reporting route.
- S3 upload, deletion, payment, public posting, or production server changes require explicit user approval.
- If the request only asks where projects or files are, inspect `/Users/gyunggyugang/Programing` and `/Users/gyunggyugang/Documents/Codex`; do not conclude from Desktop alone.
