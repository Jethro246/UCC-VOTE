import { Router } from 'express';
import type { Request, Response } from 'express';
import { MOCK_CALENDAR_EVENTS, MOCK_NOTIFICATIONS } from '../data/mockData.ts';
import type { CalendarEvent, DomainId, Election, NotificationItem } from '../types/index.ts';
import { broadcastSyncEvent } from './realtimeBus.ts';
import { persistPlatformState } from './statePersistence.ts';

export const NOTIFICATIONS_STORE: NotificationItem[] = MOCK_NOTIFICATIONS.map((n) => ({ ...n }));

export function pushPlatformNotification(input: {
  title: string;
  message: string;
  category: NotificationItem['category'];
  domainId?: DomainId;
  linkAction?: string;
}): NotificationItem {
  const newItem: NotificationItem = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: input.title,
    message: input.message,
    category: input.category,
    domainId: input.domainId,
    timestamp: 'Just now',
    read: false,
    linkAction: input.linkAction || 'elections_directory'
  };

  NOTIFICATIONS_STORE.unshift(newItem);
  if (NOTIFICATIONS_STORE.length > 100) {
    NOTIFICATIONS_STORE.pop();
  }

  persistPlatformState();
  broadcastSyncEvent('notification:created', { domainId: input.domainId });
  return newItem;
}

export function buildDynamicCalendarEvents(
  visibleElections: Election[],
  domainIdFilter?: DomainId
): CalendarEvent[] {
  const visibleMap = new Map<string, Election>();
  visibleElections.forEach((el) => visibleMap.set(el.id, el));

  // Derive live voting/results events directly from visible elections
  const electionEvents: CalendarEvent[] = visibleElections
    .filter((el) => (domainIdFilter ? el.domainId === domainIdFilter : true))
    .map((el) => ({
      id: `cal-el-${el.id}`,
      title:
        el.status === 'results_published'
          ? `${el.title} — Certified Results Declaration`
          : el.status === 'live'
          ? `${el.title} — Live Voting Window`
          : `${el.title} — Scheduled Polling`,
      electionCategory: el.category,
      domainId: el.domainId,
      subdomainLabel: el.subdomainLabel,
      startDate: el.startDate,
      endDate: el.endDate,
      type: el.status === 'results_published' ? 'results' : 'voting',
      location: 'UCC VOTE Digital Portal & Campus Accredited Kiosks',
      description: el.description
    }));

  // Include non-voting statutory milestones (vetting/campaign/debates) only if not already duplicated by live election entries
  const statutoryMilestones = MOCK_CALENDAR_EVENTS.filter((ev) => {
    if (domainIdFilter && ev.domainId !== domainIdFilter) return false;
    return ev.type !== 'voting' && ev.type !== 'results';
  });

  return [...electionEvents, ...statutoryMilestones].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
}

export const notificationRouter = Router();

notificationRouter.get('/', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    notifications: NOTIFICATIONS_STORE
  });
});

notificationRouter.post('/read-all', (_req: Request, res: Response) => {
  NOTIFICATIONS_STORE.forEach((n) => {
    n.read = true;
  });
  persistPlatformState();
  return res.json({
    success: true,
    notifications: NOTIFICATIONS_STORE
  });
});

notificationRouter.post('/:id/read', (req: Request, res: Response) => {
  const { id } = req.params;
  const item = NOTIFICATIONS_STORE.find((n) => n.id === id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Notification not found.' });
  }
  item.read = true;
  persistPlatformState();
  return res.json({
    success: true,
    notification: item
  });
});
