// pages/api/threads/index.js
//
// GET  /api/threads?model=meta/...  -> list this user's threads
//        (model filter is optional; omit it to list all threads)
// POST /api/threads { model, title? } -> create a new thread

import { getSql } from '../../../lib/db';
import { getUserId, ensureUser } from '../../../lib/auth';

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
  await ensureUser(sql, userId);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const model = url.searchParams.get('model');

    const rows = model
      ? await sql`
          select id, model, title, created_at, updated_at
          from threads
          where user_id = ${userId} and model = ${model}
          order by updated_at desc
        `
      : await sql`
          select id, model, title, created_at, updated_at
          from threads
          where user_id = ${userId}
          order by updated_at desc
        `;

    return json({ threads: rows });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { model, title } = body || {};
    if (!model) return json({ error: 'model is required' }, 400);

    const rows = await sql`
      insert into threads (user_id, model, title)
      values (${userId}, ${model}, ${title || 'New conversation'})
      returning id, model, title, created_at, updated_at
    `;

    return json({ thread: rows[0] }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
}
