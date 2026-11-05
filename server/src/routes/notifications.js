/**
 * Notifications (mounted at /api/notifications) — owner: SERVER-B (docs/mern/api.md §6.1). Ports the
 * /notifications page (list + inline markAllRead action) and src/app/(app)/notifications/[id]/route.ts.
 */
import { Router } from "express";
import { ok } from "../lib/form.js";
import { pageParam, queryString } from "../lib/query.js";
import { requireUser } from "../middleware/auth.js";
import { listNotifications, markRead, openNotification, unreadCount } from "../services/notifications.js";

const router = Router();

router.get("/", requireUser(), async (req, res) => {
  const [data, unreadTotal] = await Promise.all([
    listNotifications(req.actor, { unread: queryString(req, "unread") === "1", page: pageParam(req) }),
    unreadCount(req.actor),
  ]);
  res.json({ ...data, unreadTotal });
});

router.post("/read-all", requireUser(), async (req, res) => {
  await markRead(req.actor, "all");
  ok(res);
});

router.post("/:id/open", requireUser(), async (req, res) => {
  ok(res, { redirectTo: await openNotification(req.actor, req.params.id) });
});

export default router;
