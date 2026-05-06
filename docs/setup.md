# 21lab Viral Agent: Subscription-Based Slack Setup

API 키를 쓰지 않는다. Slack 연동은 공식 `@Codex` Slack 통합으로 처리한다.

## 목표

Slack 이용자가 `@Codex`를 멘션하면, Codex가 21lab 바이럴 지침을 읽은 상태로 작업을 수행하게 한다.

중요한 제한:

- 공식 `@Codex`는 이 로컬 데스크톱 세션과 직접 통신하지 않는다.
- Slack에서 실행되는 것은 Codex Cloud 작업이다.
- 따라서 `AGENTS.md`는 Codex Cloud 환경이 접근 가능한 저장소나 환경에 있어야 한다.
- 이 로컬 폴더에만 있는 지침은 Slack의 `@Codex`가 읽을 수 없다.

## 필요 조건

- ChatGPT Plus, Pro, Business, Enterprise, Edu 중 Codex Slack 통합을 사용할 수 있는 플랜
- Codex Cloud 설정
- GitHub 연결
- Codex environment 최소 1개
- Slack workspace에 공식 Codex 앱 설치 권한

## 설정 절차

1. GitHub 저장소 `ganggyunggyu/21lab-viral-agent`를 Codex Cloud에서 접근 가능하게 연결한다.
2. 저장소 루트의 `AGENTS.md`가 21lab 바이럴 지침 원본이다.
3. Codex Cloud environment가 해당 저장소를 보도록 설정한다.
4. `https://chatgpt.com/codex/settings/connectors`에서 Slack 앱을 workspace에 설치한다.
5. Slack 채널에 `@Codex`를 추가한다.
6. Slack에서 다음처럼 테스트한다.

```text
@Codex ganggyunggyu/21lab-viral-agent 저장소의 AGENTS.md 지침을 읽고, 21lab 바이럴 에이전트의 업무 방식과 말투를 요약해.
```

기대 결과:

- 21lab 바이럴 파트 에이전트라고 인식한다.
- 대표가 작업자/관리자에게 지시하는 말투를 언급한다.
- 외부 발송, 삭제, 결제, 공개 게시, 운영 서버 변경은 승인 전 실행하지 않는다고 답한다.

## 실제 업무 요청 예시

```text
@Codex ganggyunggyu/21lab-viral-agent 기준으로 블로그 작업자에게 오늘 해야 할 업무를 지시문 형태로 정리해.
```

```text
@Codex ganggyunggyu/21lab-viral-agent 기준으로 이 스레드의 바이럴 업무 요청을 실행 항목, 확인 필요 항목, 승인 필요 항목으로 나눠.
```

## 지침 동기화 원칙

`AGENTS.md`를 단일 원본으로 둔다.

- 로컬 Codex: 현재 작업 폴더 또는 저장소의 `AGENTS.md`를 읽는다.
- Slack `@Codex`: Codex Cloud environment에 연결된 저장소의 `AGENTS.md`를 읽는다.

따라서 동기화의 핵심은 파일 내용이 아니라 위치다. Slack에서 쓰려면 `AGENTS.md`가 Codex Cloud가 체크아웃하는 저장소 안에 있어야 한다.

## 운영 방식

대표 지시나 내부 규칙을 바꾸려면:

1. `AGENTS.md`를 수정한다.
2. 연결 저장소에 반영한다.
3. Slack에서 `@Codex`로 새 작업을 시작한다.

기존 Slack 스레드의 과거 실행에는 새 지침이 자동 소급되지 않는다. 새 작업 기준으로 적용된다고 본다.

## 별도 봇이 필요한 경우

다음 조건이 생기기 전까지 별도 Slack 봇 서버는 만들지 않는다.

- `@21lab바이럴` 같은 자체 봇 이름이 반드시 필요하다.
- Slack 사용자별 장기 기억이 필요하다.
- 네이버, 블로그 서버, 사내 DB 같은 내부 운영 도구를 직접 호출해야 한다.
- 승인 버튼, 관리자 라우팅, 작업 큐 같은 커스텀 Slack UX가 필요하다.
- Codex Cloud가 접근할 수 없는 로컬 파일이나 로컬 앱을 반드시 써야 한다.
