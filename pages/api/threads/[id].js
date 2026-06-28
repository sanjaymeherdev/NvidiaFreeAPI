// pages/api/threads/[id].js
//
// GET    /api/threads/:id -> thread metadata + full message history
// PATCH  /api/threads/:id { title } -> rename a thread
// DELETE /api/threads/:id -> delete thread (cascades to messages)

import { getSql } from '../../../lib/db';
import { getUserId } from '../../../lib/auth';

export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  let sql;
  try {
    sql = getSql();
  } catch (err) {
    return json({ error: err.message }, 500);
  }

  const userId = await getUserId(req);
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop();

  // Ownership check on every method — never trust the id alone.
  const [thread] = await sql`
    select id, user_id, model, title, created_at, updated_at
    from threads where id = ${id}
  `;
  if (!thread || thread.user_id !== userId) {
    return json({ error: 'Thread not found' }, 404);
  }

  if (req.method === 'GET') {
    const messages = await sql`
      select id, role, content, created_at
      from messages where thread_id = ${id}
      order by created_at asc
    `;
    return json({ thread, messages });
  }

  if (req.method === 'PATCH') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    const { title } = body || {};

    const rows = await sql`
      update threads set title = coalesce(${title}, title)
      where id = ${id}
      returning id, model, title, created_at, updated_at
    `;
    return json({ thread: rows[0] });
  }

  if (req.method === 'DELETE') {
    await sql`delete from threads where id = ${id}`;
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
