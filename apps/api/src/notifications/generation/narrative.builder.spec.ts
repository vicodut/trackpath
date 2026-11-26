import { describe, expect, it, jest } from '@jest/globals';
import { NarrativeBuilder, type ChatClient, type NarrativeFacts } from './narrative.builder.js';

const facts: NarrativeFacts = {
  hikeId: 1,
  date: '2026-05-01',
  distanceKmToday: 21.4,
  progress: { doneKm: 412.3, totalKm: 3500 },
  highlight: { name: 'Springer Mountain Shelter', offsetKm: 3 },
  messages: ['Feet hurt but the views are unreal!', 'Found a great spring.'],
  forecast: { summary: 'light rain', minC: 6, maxC: 14 },
  hasSignal: true,
};

const on = { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'some/model' };
const reply = (content: string | null) => ({ choices: [{ message: { content } }] });

function setup(env: Record<string, string | undefined>, ...results: (string | null | Error)[]) {
  const send = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  for (const r of results) {
    if (r instanceof Error) send.mockRejectedValueOnce(r);
    else send.mockResolvedValueOnce(reply(r));
  }
  const client = { chat: { send } } as unknown as ChatClient;
  const builder = new NarrativeBuilder(env, { client, sleep: () => Promise.resolve() });
  return { builder, send };
}

describe('NarrativeBuilder', () => {
  it('uses the template and never calls the SDK when the feature is off', async () => {
    const { builder, send } = setup({});
    const out = await builder.build(facts);
    expect(out.fallback).toBe(true);
    expect(out.text).toContain('21.4 km');
    expect(out.text).toContain('412.3 km of 3500 km');
    expect(send).not.toHaveBeenCalled();
  });

  it('returns the model text with fallback false', async () => {
    const { builder, send } = setup(on, 'A good day on trail.');
    expect(await builder.build(facts)).toEqual({ text: 'A good day on trail.', fallback: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries twice: two failures then success', async () => {
    const { builder, send } = setup(on, new Error('a'), new Error('b'), 'Third time lucky.');
    expect(await builder.build(facts)).toEqual({ text: 'Third time lucky.', fallback: false });
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('falls back to the template when all attempts fail', async () => {
    const { builder, send } = setup(on, new Error('a'), new Error('b'), new Error('c'));
    const out = await builder.build(facts);
    expect(out.fallback).toBe(true);
    expect(out.text).toContain('21.4 km');
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('falls back when the model returns empty text', async () => {
    const { builder } = setup(on, '  ', '', null);
    expect((await builder.build(facts)).fallback).toBe(true);
  });

  it('prompt has the messages verbatim, the facts, and no coordinates', async () => {
    const withCoords = { ...facts, latitude: 34.6268, longitude: -84.1938 } as NarrativeFacts;
    const { builder, send } = setup(on, 'ok');
    await builder.build(withCoords);
    const request = (send.mock.calls[0] as [{ chatRequest: { messages: unknown; maxTokens: number } }])[0].chatRequest;
    const prompt = JSON.stringify(request.messages);
    expect(prompt).toContain('Feet hurt but the views are unreal!');
    expect(prompt).toContain('Found a great spring.');
    expect(prompt).toContain('412.3 km of 3500 km');
    expect(prompt).toContain('Springer Mountain Shelter');
    expect(prompt).not.toMatch(/34\.6268|84\.1938|latitude|longitude/i);
    expect(request.maxTokens).toBeGreaterThan(0);
  });

  it('no signal: template says rest day; no forecast: no weather line', async () => {
    const { builder } = setup({});
    const rest = await builder.build({ ...facts, hasSignal: false, forecast: null });
    expect(rest.text).toMatch(/rest/i);
    expect(rest.text).not.toMatch(/°C|forecast|weather/i);
  });
});
