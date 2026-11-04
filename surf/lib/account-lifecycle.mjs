import { createHmac } from 'node:crypto';
import { validNewPassword } from './account-flow.mjs';
import { clientNetwork, consumeLoginAttempt } from './login-limits.mjs';
import { hashPassword, verifyPassword } from './passwords.mjs';
import { isUuid } from './school-access.mjs';

export function accountLifecycleStore(sql) {
  return {
    async credentials(userId) {
      const [person] = await sql`
        SELECT password_hash,auth_version FROM users
        WHERE id=${userId} AND disabled_at IS NULL AND deleted_at IS NULL AND NOT is_demo
      `;
      return person || null;
    },

    async changePassword(userId, current, nextHash) {
      const [row] = await sql`
        WITH changed AS (
          UPDATE users SET password_hash=${nextHash}, auth_version=auth_version+1, updated_at=now()
          WHERE id=${userId} AND password_hash=${current.password_hash} AND auth_version=${current.auth_version}
            AND disabled_at IS NULL AND deleted_at IS NULL AND NOT is_demo
          RETURNING id
        ), revoked AS (
          UPDATE auth_sessions SET revoked_at=now()
          WHERE user_id IN (SELECT id FROM changed) AND revoked_at IS NULL
        )
        SELECT EXISTS(SELECT 1 FROM changed) AS changed
      `;
      return row?.changed === true;
    },

    async requestClosure(userId, current) {
      const [row] = await sql`
        SELECT outcome,request_id AS id,requested_at AS "requestedAt",review_completed_at AS "reviewedAt"
        FROM complete_account_closure(${userId},${current.password_hash},${current.auth_version})
      `;
      return row || null;
    },

    async status(userId) {
      const [row] = await sql`
        SELECT id,requested_at AS "requestedAt",reviewed_at AS "reviewedAt"
        FROM account_closure_requests WHERE user_id=${userId}
        ORDER BY requested_at DESC,id DESC LIMIT 1
      `;
      return row || null;
    },

    async pending(operatorId) {
      return sql`
        SELECT r.id,r.requested_at AS "requestedAt",u.name,u.email
        FROM account_closure_requests r JOIN users u ON u.id=r.user_id
        WHERE r.reviewed_at IS NULL AND account_is_platform(${operatorId}::uuid)
        ORDER BY r.requested_at,r.id LIMIT 50
      `;
    },

    async reviewed(operatorId) {
      return sql`
        SELECT r.id,r.requested_at AS "requestedAt",r.reviewed_at AS "reviewedAt",r.support_case AS "supportCase",u.name,u.email
        FROM account_closure_requests r JOIN users u ON u.id=r.user_id
        WHERE r.reviewed_at IS NOT NULL AND account_is_platform(${operatorId}::uuid)
        ORDER BY r.reviewed_at DESC,r.id LIMIT 50
      `;
    },

    async acknowledge(operatorId, id, supportCase) {
      const [row] = await sql`
        UPDATE account_closure_requests SET reviewed_at=now(),reviewed_by=${operatorId},support_case=${supportCase}
        WHERE id=${id} AND reviewed_at IS NULL AND account_is_platform(${operatorId}::uuid)
        RETURNING id
      `;
      return Boolean(row);
    },
  };
}

export function accountLifecycleHandler({ sql, requireAuth, clearCookie, env = process.env }) {
  const store = accountLifecycleStore(sql);
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ ok: false, error: 'account.unavailable' });
    }

    const session = await requireAuth(req, res);
    if (!session) return;
    const { userId, role, demo } = session;
    const fail = (status, error) => res.status(status).json({ ok: false, error });
    const success = data => res.json({ ok: true, data });
    if (demo) return fail(403, 'account.unavailable');
    try {
      if (req.method === 'GET') {
        if (req.query?.review === '1') {
          if (role !== 'platform_admin') return fail(403, 'account.unavailable');
          const [pending, reviewed] = await Promise.all([store.pending(userId), store.reviewed(userId)]);
          return success({ pending, reviewed });
        }
        return success(await store.status(userId));
      }

      const body = req.body || {};
      if (req.method === 'PATCH') {
        if (role !== 'platform_admin') return fail(403, 'account.unavailable');
        if (!isUuid(body.id) || typeof body.supportCase !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(body.supportCase))
          return fail(400, 'account.invalidSupportCase');
        if (!await store.acknowledge(userId, body.id, body.supportCase)) return fail(409, 'account.unavailable');
        return success(null);
      }

      if (!['password', 'closure'].includes(body.action)) return fail(400, 'account.unavailable');
      if (typeof body.currentPassword !== 'string' || !body.currentPassword || body.currentPassword.length > 256)
        return fail(400, 'account.currentPasswordInvalid');
      if (body.action === 'closure' && body.confirm !== true) return fail(400, 'account.closureConfirm');
      if (body.action === 'password') {
        if (!validNewPassword(body.newPassword)) return fail(400, 'account.passwordHint');
        if (body.newPassword === body.currentPassword) return fail(400, 'account.passwordDifferent');
      }

      if (typeof env.SESSION_SECRET !== 'string' || Buffer.byteLength(env.SESSION_SECRET) < 32)
        return fail(503, 'account.unavailable');
      const digest = (kind, value) => createHmac('sha256', env.SESSION_SECRET)
        .update(JSON.stringify(['account-lifecycle-v1', kind, value])).digest('hex');
      const limit = await consumeLoginAttempt(sql, [
        { key: digest('user', userId), limit: 8 },
        { key: digest('network', clientNetwork(req, env)), limit: 40 },
      ]);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retrySeconds));
        return fail(429, 'login.rateLimit');
      }

      const current = await store.credentials(userId);
      if (!current || !await verifyPassword(body.currentPassword, current.password_hash))
        return fail(400, 'account.currentPasswordInvalid');
      if (body.action === 'closure') {
        const request = await store.requestClosure(userId, current);
        if (!request) return fail(409, 'account.tryAgain');
        if (request.outcome === 'closed') clearCookie(res);
        return success(request);
      }

      const changed = await store.changePassword(userId, current, await hashPassword(body.newPassword));
      if (!changed) return fail(409, 'account.tryAgain');
      clearCookie(res);
      return success(null);
    } catch (error) {
      console.error('account_lifecycle_unavailable', { code: error?.code });
      return fail(503, 'account.unavailable');
    }
  };
}
