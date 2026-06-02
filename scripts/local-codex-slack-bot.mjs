#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const openClawConfigPath = process.env.OPENCLAW_CONFIG_PATH || '/Users/gyunggyugang/.openclaw/openclaw.json';
const workspace = process.env.CODEX_WORKSPACE || repoRoot;
const logDir = process.env.CODEX_SLACK_LOG_DIR || '/Users/gyunggyugang/.codex/slack-direct/logs';
const stateDir = process.env.CODEX_SLACK_STATE_DIR || '/Users/gyunggyugang/.codex/slack-direct/state';
const sessionStoreFile = join(stateDir, 'sessions.json');
const codexBin = process.env.CODEX_BIN || '/opt/homebrew/bin/codex';
const maxSlackChunk = 3500;
const seenEvents = new Set();
const queue = [];
const processStartedAtTs = Date.now() / 1000;
let processing = false;
let botUserId = '';

function nowId() {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  return `${stamp}-${process.pid}-${Math.random().toString(16).slice(2, 8)}`;
}

async function readConfig() {
  const raw = JSON.parse(await readFile(openClawConfigPath, 'utf8'));
  const slack = raw.channels?.slack || {};
  const appToken = process.env.SLACK_APP_TOKEN || slack.appToken;
  const botToken = process.env.SLACK_BOT_TOKEN || slack.botToken;
  if (!appToken || !botToken) {
    throw new Error('Missing Slack app/bot token. Set SLACK_APP_TOKEN and SLACK_BOT_TOKEN or keep them in OpenClaw config.');
  }
  return {
    appToken,
    botToken,
    allowFrom: new Set(slack.allowFrom || []),
    dmPolicy: slack.dmPolicy || 'open',
    requireMention: slack.requireMention !== false,
  };
}

async function slackApi(token, method, body = {}) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`${method} failed: ${data.error || 'unknown_error'}`);
  }
  return data;
}

function stripBotMention(text) {
  if (!botUserId) return text.trim();
  return text.replace(new RegExp(`<@${botUserId}>`, 'g'), '').trim();
}

function conversationKey(event) {
  if (event.channel_type === 'im') return `dm:${event.channel}`;
  return `thread:${event.channel}:${event.thread_ts || event.ts}`;
}

async function loadSessionStore() {
  try {
    return JSON.parse(await readFile(sessionStoreFile, 'utf8'));
  } catch {
    return {};
  }
}

async function saveSessionStore(store) {
  await mkdir(stateDir, { recursive: true });
  await writeFile(sessionStoreFile, JSON.stringify(store, null, 2), 'utf8');
}

function extractCodexThreadId(events) {
  for (const line of events.split('\n')) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === 'thread.started' && event.thread_id) return event.thread_id;
    } catch {
      continue;
    }
  }
  return '';
}

function shouldHandle(event, cfg) {
  if (!event || event.type !== 'message') return false;
  const eventTs = Number.parseFloat(event.event_ts || event.ts || '0');
  if (Number.isFinite(eventTs) && eventTs > 0 && eventTs < processStartedAtTs - 60) return false;
  if (event.subtype || event.bot_id || event.user === botUserId) return false;

  const isDm = event.channel_type === 'im';
  if (isDm) {
    if (cfg.dmPolicy === 'allowlist' && cfg.allowFrom.size > 0 && !cfg.allowFrom.has(event.user)) return false;
    return true;
  }

  if (!cfg.requireMention) return true;
  return Boolean(botUserId && event.text?.includes(`<@${botUserId}>`));
}

function formatSlackMessages(messages = []) {
  return messages
    .filter((message) => !message.subtype && (message.text || '').trim())
    .slice(-16)
    .map((message) => {
      const speaker = message.user === botUserId ? 'assistant' : `user:${message.user || 'unknown'}`;
      const text = stripBotMention(message.text || '').replace(/\s+/g, ' ').trim();
      return `- ${speaker} [${message.ts}]: ${text.slice(0, 1000)}`;
    })
    .join('\n');
}

async function readSlackContext(cfg, event) {
  try {
    if (event.thread_ts) {
      const replies = await slackApi(cfg.botToken, 'conversations.replies', {
        channel: event.channel,
        ts: event.thread_ts,
        limit: 20,
      });
      return formatSlackMessages(replies.messages || []);
    }

    if (event.channel_type === 'im') {
      const history = await slackApi(cfg.botToken, 'conversations.history', {
        channel: event.channel,
        limit: 12,
      });
      return formatSlackMessages((history.messages || []).reverse());
    }
  } catch (error) {
    return `Slack context read failed: ${error.message}`;
  }

  return '';
}

function makePrompt(event, requestText, { conversation, slackContext, isResume }) {
  return `Slack에서 로컬 Codex Slack Bot을 통해 전달된 요청입니다.

역할:
- 당신은 21lab 바이럴 파트 Codex 에이전트입니다.
- 이 작업 폴더의 AGENTS.md 지침을 우선 적용하십시오.
- Slack으로 돌아갈 답변이므로 짧고 실행 중심으로 작성하십시오.
- 외부 발송, 삭제, 결제, 공개 게시, 운영 서버 변경은 승인 전 실행하지 마십시오.

로컬 프로젝트 탐색 기준:
- 현재 작업 폴더는 Slack-Codex 게이트웨이 기준 폴더입니다. 전체 프로젝트 목록이 아닙니다.
- 주요 개발 프로젝트 루트: /Users/gyunggyugang/Programing
- Codex 작업 세션/복제본 루트: /Users/gyunggyugang/Documents/Codex
- OpenClaw 설정/자동화 확인이 필요하면 /Users/gyunggyugang/.openclaw 를 확인하십시오. 단, 토큰/인증정보 값은 읽거나 출력하지 마십시오.
- Codex 커스텀 스킬은 /Users/gyunggyugang/.codex/skills 를 확인하십시오.
- 사용자가 프로젝트, 저장소, 파일 위치, 로컬 상태를 물으면 Desktop만 보고 단정하지 말고 위 루트를 실제로 확인하십시오.

Slack 메타:
- channel: ${event.channel}
- user: ${event.user || 'unknown'}
- ts: ${event.ts}
- conversation: ${conversation}
- resumed_codex_session: ${isResume ? 'yes' : 'no'}

대화 지속 지침:
- 같은 Slack DM 또는 같은 Slack thread의 이전 대화를 이어서 이해하십시오.
- resumed_codex_session이 yes이면 이전 Codex 세션 문맥을 유지한 상태입니다.
- 아래 Slack 최근 대화는 보조 문맥입니다. 현재 요청과 충돌하면 최신 사용자 요청을 우선하십시오.

Slack 최근 대화:
${slackContext || '(없음)'}

요청:
${requestText}
`;
}

async function runCodex(event, requestText, cfg) {
  await mkdir(logDir, { recursive: true });
  const id = nowId();
  const promptFile = join(logDir, `${id}.prompt.txt`);
  const outputFile = join(logDir, `${id}.answer.txt`);
  const eventsFile = join(logDir, `${id}.events.jsonl`);
  const stderrFile = join(logDir, `${id}.stderr.log`);
  const store = await loadSessionStore();
  const key = conversationKey(event);
  const savedSession = store[key];
  const slackContext = await readSlackContext(cfg, event);
  const isResume = Boolean(savedSession?.threadId);
  const prompt = makePrompt(event, requestText, {
    conversation: key,
    slackContext,
    isResume,
  });
  await writeFile(promptFile, prompt, 'utf8');

  const baseArgs = [
    '--ask-for-approval',
    'never',
    '--sandbox',
    'danger-full-access',
    '--cd',
    workspace,
  ];
  const args = isResume ? [
    ...baseArgs,
    'exec',
    'resume',
    '--skip-git-repo-check',
    '--output-last-message',
    outputFile,
    '--json',
    savedSession.threadId,
    '-',
  ] : [
    ...baseArgs,
    'exec',
    '--skip-git-repo-check',
    '--output-last-message',
    outputFile,
    '--json',
    '-',
  ];

  let events = '';
  await new Promise((resolve, reject) => {
    const child = spawn(codexBin, args, {
      cwd: workspace,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      },
    });
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      events += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', async (code) => {
      await Promise.all([
        writeFile(eventsFile, events, 'utf8'),
        writeFile(stderrFile, stderr, 'utf8'),
      ]);
      if (code === 0) resolve();
      else reject(new Error(`codex exited with ${code}`));
    });
    child.stdin.end(prompt);
  });

  const threadId = extractCodexThreadId(events) || savedSession?.threadId;
  if (threadId) {
    store[key] = {
      threadId,
      channel: event.channel,
      user: event.user || '',
      lastSlackTs: event.ts,
      updatedAt: new Date().toISOString(),
    };
    await saveSessionStore(store);
  }

  const answer = (await readFile(outputFile, 'utf8')).trim();
  if (!answer) throw new Error('codex returned empty answer');
  return answer;
}

function splitSlackMessage(text) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > maxSlackChunk) {
    let cut = rest.lastIndexOf('\n', maxSlackChunk);
    if (cut < 1000) cut = maxSlackChunk;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function postAnswer(cfg, event, answer) {
  const threadTs = event.thread_ts || event.ts;
  for (const chunk of splitSlackMessage(answer)) {
    await slackApi(cfg.botToken, 'chat.postMessage', {
      channel: event.channel,
      text: chunk,
      thread_ts: threadTs,
    });
  }
}

async function handleEvent(cfg, event) {
  const dedupeKey = `${event.channel}:${event.ts}`;
  if (seenEvents.has(dedupeKey)) return;
  seenEvents.add(dedupeKey);

  const requestText = stripBotMention(event.text || '');
  if (!requestText) return;

  queue.push({ cfg, event, requestText });
  void processQueue();
}

async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const { cfg, event, requestText } = queue.shift();
    try {
      const answer = await runCodex(event, requestText, cfg);
      await postAnswer(cfg, event, answer);
    } catch (error) {
      await slackApi(cfg.botToken, 'chat.postMessage', {
        channel: event.channel,
        text: `Codex 처리 실패: ${error.message}`,
        thread_ts: event.thread_ts || event.ts,
      }).catch(() => {});
    }
  }
  processing = false;
}

async function connectSocketMode(cfg) {
  const auth = await slackApi(cfg.botToken, 'auth.test');
  botUserId = auth.user_id;
  const conn = await slackApi(cfg.appToken, 'apps.connections.open');
  const ws = new WebSocket(conn.url);

  ws.onopen = () => {
    console.log(`[${new Date().toISOString()}] connected as ${auth.user} (${botUserId})`);
  };

  ws.onmessage = async (message) => {
    let envelope;
    try {
      envelope = JSON.parse(message.data);
    } catch {
      return;
    }

    if (envelope.envelope_id) {
      ws.send(JSON.stringify({ envelope_id: envelope.envelope_id }));
    }

    const event = envelope.payload?.event;
    if (shouldHandle(event, cfg)) {
      await handleEvent(cfg, event);
    }
  };

  ws.onclose = () => {
    console.error(`[${new Date().toISOString()}] socket closed; reconnecting`);
    setTimeout(() => connectSocketMode(cfg).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    }), 3000);
  };

  ws.onerror = (error) => {
    console.error(`[${new Date().toISOString()}] socket error`, error?.message || error);
  };
}

async function main() {
  const cfg = await readConfig();
  await connectSocketMode(cfg);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
