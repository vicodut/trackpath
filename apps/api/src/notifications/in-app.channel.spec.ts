import { InAppChannel } from './in-app.channel.js';
import type { DrizzleClient } from '../database/drizzle.types.js';

function setup(fail = false) {
  const sets: Record<string, unknown>[] = [];
  const db = {
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: () => {
          sets.push(v);
          return fail ? Promise.reject(new Error('db down')) : Promise.resolve();
        },
      }),
    }),
  };
  // The stub is the Drizzle edge; the channel only calls update().set().where().
  return { channel: new InAppChannel(db as unknown as DrizzleClient), sets };
}

const N = { id: 1, hikeId: 1, text: 'hi' };

describe('InAppChannel', () => {
  it('marks the update delivered so the pane shows it', async () => {
    const { channel, sets } = setup();
    expect(await channel.deliver(N, null)).toEqual({ channel: 'in-app', ok: true });
    expect(sets).toEqual([{ delivered: true }]);
  });

  it('ignores the recipient', async () => {
    const a = setup();
    const b = setup();
    expect(await a.channel.deliver(N, null)).toEqual(await b.channel.deliver(N, { address: 'x@y.z' }));
    expect(b.sets).toEqual(a.sets);
  });

  it('rejects when the store fails, for the dispatcher to report', async () => {
    await expect(setup(true).channel.deliver(N, null)).rejects.toThrow('db down');
  });
});
