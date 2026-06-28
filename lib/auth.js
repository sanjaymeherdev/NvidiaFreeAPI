// lib/auth.js
//
// STUB AUTH — there's no login flow in this simple app, so every
// request is attributed to one fixed user id. Threads/messages are
// still stored per-user in the database, so if you add real auth
// later, swap the body of getUserId() and nothing else needs to
// change (threads/index.js and threads/[id].js already key off it).

const DEMO_USER_ID = 'demo-user';

/**
 * @param {Request} req
 * @returns {Promise<string>} userId
 */
export async function getUserId(req) {
  return DEMO_USER_ID;
}

/**
 * Ensures a user row exists (idempotent). Cheap upsert, safe to call
 * on every request.
 */
export async function ensureUser(sql, userId) {
  await sql`
    insert into users (id)
    values (${userId})
    on conflict (id) do nothing
  `;
}
