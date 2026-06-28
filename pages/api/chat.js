// Single Edge Function: handles model listing + chat completions.
// Talks directly to NVIDIA's OpenAI-compatible endpoint with plain
// fetch, and persists threads/messages to Postgres (Neon) so chats
// survive across visits/devices. No Redis, no real auth — every
// thread belongs to the one fixed demo user from lib/auth.js.

import { getSql } from '../../lib/db';
import { getUserId, ensureUser } from '../../lib/auth';

export const config = {
  runtime: 'edge',
};

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// Curated list of models to show in the dropdown.
const ALLOWED_MODELS = [
  'abacusai/dracarys-llama-3.1-70b-instruct',
  'deepseek-ai/deepseek-v4-flash',
  'deepseek-ai/deepseek-v4-pro',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.2-11b-vision-instruct',
  'meta/llama-3.2-1b-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.2-90b-vision-instruct',
  'meta/llama-3.3-70b-instruct',
  'meta/llama-4-maverick-17b-128e-instruct',
  'meta/llama-guard-4-12b',
  'mistralai/ministral-14b-instruct-2512',
  'mistralai/mistral-large-3-675b-instruct-2512',
  'mistralai/mistral-medium-3.5-128b',
  'mistralai/mistral-small-4-119b-2603',
  'mistralai/mixtral-8x7b-instruct-v0.1',
  'moonshotai/kimi-k2.6',
  'nvidia/llama-3.1-nemoguard-8b-content-safety',
  'nvidia/llama-3.1-nemoguard-8b-topic-control',
];

function isAllowedModel(modelId) {
  return ALLOWED_MODELS.includes(modelId);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
  });
}

function listModels() {
  const byProvider = {};
  ALLOWED_MODELS.forEach((modelId) => {
    const parts = modelId.split('/');
    const provider = parts.length > 1 ? parts[0] : 'nvidia';
    if (!byProvider[provider]) byProvider[provider] = [];
    byProvider[provider].push(modelId);
  });
  return { models: ALLOWED_MODELS, by_provider: byProvider };
}

// ---- thread/message persistence (Neon) ----
// Best-effort: if DATABASE_URL isn't configured, or any call here
// throws, we swallow the error and let the chat response go through
// anyway. Saving history should never be the reason a chat request
// fails.

async function getOrCreateThread(sql, userId, threadId, model) {
  if (threadId) {
    const rows = await sql`
      select id, user_id from threads where id = ${threadId}
    `;
    const thread = rows[0];
    if (thread && thread.user_id === userId) return thread.id;
    // threadId given but not found/owned — fall through and create a new one
  }
  const rows = await sql`
    insert into threads (user_id, model, title)
    values (${userId}, ${model}, 'New conversation')
    returning id
  `;
  return rows[0].id;
}

async function saveMessage(sql, threadId, role, content) {
  await sql`
    insert into messages (thread_id, role, content)
    values (${threadId}, ${role}, ${content})
  `;
  await sql`update threads set updated_at = now() where id = ${threadId}`;
}

async function maybeAutoTitleThread(sql, threadId, firstUserMessage) {
  // Only set a real title if the thread still has the default placeholder.
  const title = firstUserMessage.slice(0, 60).trim() || 'New conversation';
  await sql`
    update threads set title = ${title}
    where id = ${threadId} and title = 'New conversation'
  `;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return json({ error: 'NVIDIA_API_KEY environment variable is not set' }, 500);
  }

  const url = new URL(req.url);

  // GET /api/chat?list=models -> curated model catalog
  if (req.method === 'GET') {
    if (url.searchParams.get('list') === 'models') {
      return json(listModels());
    }
    return json({ error: 'Use GET ?list=models or POST a chat request' }, 400);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const {
    messages,
    model = 'meta/llama-3.1-70b-instruct',
    stream = false,
    temperature = 0.7,
    max_tokens = 2048,
    threadId = null,
  } = body || {};

  if (!messages || !Array.isArray(messages)) {
    return json({ error: 'Messages array is required' }, 400);
  }

  if (!isAllowedModel(model)) {
    return json({ error: `Model "${model}" is not in the allowed list` }, 403);
  }

  // ---- persistence setup (best-effort, never blocks the chat call) ----
  let sql = null;
  let userId = null;
  let resolvedThreadId = null;

  try {
    sql = getSql();
    userId = await getUserId(req);
    await ensureUser(sql, userId);
    resolvedThreadId = await getOrCreateThread(sql, userId, threadId, model);

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      const existing = await sql`select 1 from messages where thread_id = ${resolvedThreadId} limit 1`;
      const isFirstMessageInThread = existing.length === 0;
      await saveMessage(sql, resolvedThreadId, 'user', lastUserMessage.content);
      if (isFirstMessageInThread) {
        await maybeAutoTitleThread(sql, resolvedThreadId, lastUserMessage.content);
      }
    }
  } catch (err) {
    console.error('chat.js: persistence setup failed, continuing without history:', err.message);
    sql = null; // disable further persistence attempts for this request
  }

  const formattedMessages = messages.map((m) => ({ role: m.role, content: m.content }));

  const upstreamPayload = {
    model,
    messages: formattedMessages,
    temperature,
    max_tokens,
    top_p: 1,
    stream: Boolean(stream),
  };

  let upstream;
  try {
    upstream = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamPayload),
    });
  } catch (err) {
    return json({ error: 'Failed to reach NVIDIA API', details: err.message }, 502);
  }

  if (!upstream.ok) {
    const rawText = await upstream.text();
    let details = rawText;
    try {
      details = JSON.parse(rawText);
    } catch (_) {
      // leave details as raw text if it isn't JSON
    }
    return json(
      { error: 'NVIDIA API returned an error', status: upstream.status, details },
      upstream.status,
      resolvedThreadId ? { 'X-Thread-Id': resolvedThreadId } : {}
    );
  }

  // Streaming: pipe NVIDIA's SSE stream straight through to the client,
  // while also tee-ing it so we can accumulate the full assistant text
  // and persist it once the stream ends — without delaying the client.
  if (upstreamPayload.stream) {
    const threadIdForSave = resolvedThreadId;
    const sqlForSave = sql;

    let accumulated = '';
    const decoder = new TextDecoder();
    let sseBuffer = '';

    const passthrough = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        sseBuffer += decoder.decode(chunk, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const data = JSON.parse(payload);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) accumulated += delta;
          } catch (_) {
            // ignore malformed/partial chunk, doesn't affect passthrough
          }
        }
      },
      async flush() {
        if (!sqlForSave || !threadIdForSave || !accumulated) return;
        try {
          await saveMessage(sqlForSave, threadIdForSave, 'assistant', accumulated);
        } catch (err) {
          console.error('chat.js: failed to save assistant message:', err.message);
        }
      },
    });

    const piped = upstream.body.pipeThrough(passthrough);

    return new Response(piped, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...(resolvedThreadId ? { 'X-Thread-Id': resolvedThreadId } : {}),
        ...corsHeaders(),
      },
    });
  }

  // Non-streaming: pass the JSON straight through (already OpenAI-shaped),
  // and persist the assistant reply if we have a thread to attach it to.
  const data = await upstream.json();

  if (sql && resolvedThreadId) {
    const replyText = data.choices?.[0]?.message?.content;
    if (replyText) {
      try {
        await saveMessage(sql, resolvedThreadId, 'assistant', replyText);
      } catch (err) {
        console.error('chat.js: failed to save assistant message:', err.message);
      }
    }
  }

  return json(data, 200, resolvedThreadId ? { 'X-Thread-Id': resolvedThreadId } : {});
}
