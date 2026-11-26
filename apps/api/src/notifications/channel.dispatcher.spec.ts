import { ChannelDispatcher } from './channel.dispatcher.js';
import type { NotificationChannel } from './notifications.types.js';

const N = { id: 1, hikeId: 1, text: 'hi' };
const ok: NotificationChannel = { name: 'a', deliver: () => Promise.resolve({ channel: 'a', ok: true }) };
const broken: NotificationChannel = { name: 'b', deliver: () => Promise.reject(new Error('boom')) };

describe('ChannelDispatcher', () => {
  it('reports a channel error without throwing and still runs the other channels', async () => {
    const results = await new ChannelDispatcher([broken, ok]).dispatch(N);
    expect(results).toEqual([{ channel: 'b', ok: false, error: 'boom' }, { channel: 'a', ok: true }]);
  });

  it('passes a null recipient', async () => {
    const seen: unknown[] = [];
    const spy: NotificationChannel = {
      name: 's',
      deliver: (_n, r) => {
        seen.push(r);
        return Promise.resolve({ channel: 's', ok: true });
      },
    };
    await new ChannelDispatcher([spy]).dispatch(N);
    expect(seen).toEqual([null]);
  });
});
