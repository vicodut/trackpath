import { MessagesFacts } from './messages.facts.js';
import type { DrizzleClient } from '../../database/drizzle.types.js';

type Row = { timestamp: string; message: string | null; eventType: string | null };

/** Stubs the Drizzle select().from().where() chain at its edge. */
function make(rows: Row[]): MessagesFacts {
  const db = { select: () => ({ from: () => ({ where: () => Promise.resolve(rows) }) }) };
  return new MessagesFacts(db as unknown as DrizzleClient);
}

describe('MessagesFacts', () => {
  it('reports no signal and no messages for a day without fixes', async () => {
    expect(await make([]).getForDay('2026-06-01')).toEqual({ messages: [], hadSignal: false });
  });

  it('returns messages verbatim in time order, excluding poop points', async () => {
    const result = await make([
      { timestamp: '2026-06-01T15:00:00.000Z', message: '  Second!! ', eventType: null },
      { timestamp: '2026-06-01T12:00:00.000Z', message: 'First', eventType: 'Tracking interval' },
      { timestamp: '2026-06-01T13:00:00.000Z', message: 'dug a cathole, poop', eventType: 'poop' },
      { timestamp: '2026-06-01T14:00:00.000Z', message: null, eventType: null },
    ]).getForDay('2026-06-01');
    expect(result).toEqual({ messages: ['First', '  Second!! '], hadSignal: true });
  });

  it('counts a poop-only day as signal with no messages', async () => {
    const result = await make([
      { timestamp: '2026-06-01T13:00:00.000Z', message: 'poop', eventType: 'poop' },
    ]).getForDay('2026-06-01');
    expect(result).toEqual({ messages: [], hadSignal: true });
  });
});
