/**
 * Realtime push over Server-Sent Events.
 *
 * Each signed-in tab keeps one GET /api/notifications/stream open. The server
 * pushes:
 *   - `notification`: a new notification for that user (shows up instantly)
 *   - `unread`:       the user's current unread count (after reads/deletes)
 *   - `changed`:      { topics: ['schedule', 'classes', ...] } so open pages
 *                     refetch the data that just changed
 *
 * Connections live in this process's memory, which fits the single API server
 * this app runs on. Anything sent to a user with no open tab is simply
 * dropped; the notification itself is still saved and shows on next load.
 */

const HEARTBEAT_MS = 25000;

// userId -> Set<{ res, role, program }>
const clients = new Map();

const send = (res, event, data) => {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
    return true;
  } catch (_) {
    return false;
  }
};

/** Open a stream for the authenticated request. */
const subscribe = (req, res, initial = {}) => {
  const userId = String(req.user._id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform keeps the compression middleware from buffering events
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Proxies (nginx, Render) must not buffer the stream either
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');

  const client = { res, role: req.user.role, program: req.user.program || null };
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(client);

  send(res, 'ready', { at: new Date().toISOString(), ...initial });

  // Comments keep idle connections from being closed by proxies
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { /* closed */ }
  }, HEARTBEAT_MS);

  const close = () => {
    clearInterval(heartbeat);
    const set = clients.get(userId);
    if (set) {
      set.delete(client);
      if (!set.size) clients.delete(userId);
    }
  };
  req.on('close', close);
  res.on('error', close);
};

/** Push an event to every open tab of these users. */
const publish = (userIds, event, data) => {
  let delivered = 0;
  for (const id of new Set((userIds || []).filter(Boolean).map(String))) {
    for (const client of clients.get(id) || []) {
      if (send(client.res, event, data)) delivered += 1;
    }
  }
  return delivered;
};

/** Push to connected users matching a test on { role, program }. */
const publishWhere = (test, event, data) => {
  let delivered = 0;
  for (const set of clients.values()) {
    for (const client of set) {
      if (test(client) && send(client.res, event, data)) delivered += 1;
    }
  }
  return delivered;
};

/** Tell users that some data changed so open pages can refetch it. */
const changed = (userIds, topics) => publish(userIds, 'changed', { topics: [].concat(topics) });

const isOnline = (userId) => clients.has(String(userId));
const stats = () => ({
  users: clients.size,
  connections: [...clients.values()].reduce((n, s) => n + s.size, 0),
});

module.exports = { subscribe, publish, publishWhere, changed, isOnline, stats };
