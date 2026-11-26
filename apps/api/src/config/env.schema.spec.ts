import { isNarrativeEnabled, validateEnv } from './env.schema.js';

const base = { DATABASE_URL: 'postgres://x', BETTER_AUTH_SECRET: 'a'.repeat(16) };

describe('env schema: OpenRouter', () => {
  it('parses with neither OpenRouter variable set', () => {
    const env = validateEnv(base);
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.OPENROUTER_MODEL).toBeUndefined();
  });

  it('narrative is enabled when key and model are set', () => {
    const env = validateEnv({ ...base, OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'm' });
    expect(isNarrativeEnabled(env)).toBe(true);
  });

  it('narrative is disabled when key is unset or empty', () => {
    expect(isNarrativeEnabled(validateEnv({ ...base, OPENROUTER_MODEL: 'm' }))).toBe(false);
    expect(
      isNarrativeEnabled(validateEnv({ ...base, OPENROUTER_API_KEY: '', OPENROUTER_MODEL: 'm' })),
    ).toBe(false);
  });

  it('narrative is disabled when key is set but model is unset or empty', () => {
    expect(isNarrativeEnabled(validateEnv({ ...base, OPENROUTER_API_KEY: 'k' }))).toBe(false);
    expect(
      isNarrativeEnabled(validateEnv({ ...base, OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: '' })),
    ).toBe(false);
  });
});
