import type { Request, Response } from 'express';

export type SyncEventType =
  | 'connected'
  | 'election:created'
  | 'election:updated'
  | 'election:deleted'
  | 'election:status'
  | 'position:updated'
  | 'candidate:created'
  | 'candidate:updated'
  | 'candidate:approved'
  | 'candidate:rejected'
  | 'candidate:status'
  | 'results:updated'
  | 'results:published'
  | 'vote:cast'
  | 'domain:updated'
  | 'notification:created'
  | 'student:status'
  | 'student:registered';

export interface SyncEventPayload {
  type: SyncEventType;
  electionId?: string;
  domainId?: string;
  candidateId?: string;
  positionId?: string;
  timestamp: string;
}

const sseClients = new Set<Response>();

export function sseEventsHandler(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  sseClients.add(res);

  const initialEvent: SyncEventPayload = {
    type: 'connected',
    timestamp: new Date().toISOString()
  };
  res.write(`event: sync\ndata: ${JSON.stringify(initialEvent)}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

export function broadcastSyncEvent(
  type: SyncEventType,
  meta?: Omit<SyncEventPayload, 'type' | 'timestamp'>
): void {
  if (sseClients.size === 0) return;

  const payload: SyncEventPayload = {
    type,
    ...meta,
    timestamp: new Date().toISOString()
  };
  const serialized = `event: sync\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(serialized);
    } catch {
      sseClients.delete(client);
    }
  }
}
