import { Logger } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';
import type { DailyFacts } from '@trackpath/db/schema';
import { isNarrativeEnabled } from '../../config/env.schema.js';
import type { BuiltMessage, MessageBuilder } from '../notifications.types.js';

/** Per-request timeout handed to the SDK. */
export const NARRATIVE_TIMEOUT_MS = 20_000;
/** Retries after the first attempt, so at most 3 requests per build. */
export const NARRATIVE_MAX_RETRIES = 2;
/** First backoff delay; doubles on each retry (1s, 2s). */
export const NARRATIVE_BACKOFF_BASE_MS = 1_000;
/** Response size cap: a short update, not an essay. */
// Reasoning models spend the cap on hidden thinking first, so 300 returned empty text; 2000 leaves room for the answer.
export const NARRATIVE_MAX_TOKENS = 2000;

/**
 * Facts the narrative can use, on top of the base DailyFacts. Every extra is optional,
 * so a missing one simply drops its line. Coordinates are deliberately not part of this.
 */
export interface NarrativeFacts extends DailyFacts {
  progress?: { doneKm: number; totalKm: number } | null;
  highlight?: { name: string; offsetKm: number } | null;
  messages?: string[];
  /** Null or absent means no forecast: no weather line is written. */
  forecast?: { summary: string; minC: number; maxC: number } | null;
  /** False means no tracking signal that day. Absent is treated as signal. */
  hasSignal?: boolean;
}

export type ChatClient = Pick<OpenRouter, 'chat'>;

export interface NarrativeBuilderOptions {
  client?: ChatClient;
  sleep?: (ms: number) => Promise<void>;
}

const SYSTEM_PROMPT = [
  'You write a short daily update about a hiker on the Appalachian Trail, for friends and family.',
  'Write in English, in a warm, person-written tone, in the third person ("he"), as 2 to 4 sentences of plain text.',
  'Use kilometres and degrees Celsius only.',
  'Use ONLY the facts provided. Never invent any detail (places, people, feelings, events).',
  'If messages are provided, quote them word for word in quotation marks; never paraphrase or alter them.',
  'If there is no signal for the day, say it was a rest day or that there was no signal and he may be resting.',
  'If no forecast is provided, do not mention the weather at all.',
].join(' ');

function factLines(f: NarrativeFacts): string[] {
  const lines = [`Date: ${f.date}`];
  if (f.hasSignal === false) {
    lines.push('Signal: none today (no tracking points received)');
  } else if (f.distanceKmToday !== null) {
    lines.push(`Distance walked today: ${f.distanceKmToday} km`);
  }
  if (f.progress) lines.push(`Trail progress: ${f.progress.doneKm} km of ${f.progress.totalKm} km`);
  if (f.highlight) lines.push(`Nearest highlight: ${f.highlight.name}, roughly ${f.highlight.offsetKm} km away`);
  for (const m of f.messages ?? []) lines.push(`Message (quote verbatim): "${m}"`);
  if (f.forecast) {
    lines.push(`Forecast: ${f.forecast.summary}, ${f.forecast.minC} to ${f.forecast.maxC} °C`);
  }
  return lines;
}

/** Plain sentence from the same facts, used when the model is off or fails. */
export function templateMessage(f: NarrativeFacts): string {
  const parts: string[] = [];
  if (f.hasSignal === false) {
    parts.push('No signal today, so it was probably a rest day.');
  } else if (f.distanceKmToday !== null) {
    parts.push(`He walked ${f.distanceKmToday} km today.`);
  }
  if (f.progress) parts.push(`Trail progress: ${f.progress.doneKm} km of ${f.progress.totalKm} km.`);
  if (f.highlight) parts.push(`Nearest highlight: ${f.highlight.name}, about ${f.highlight.offsetKm} km away.`);
  for (const m of f.messages ?? []) parts.push(`He wrote: "${m}"`);
  if (f.forecast) {
    parts.push(`Forecast: ${f.forecast.summary}, ${f.forecast.minC} to ${f.forecast.maxC} °C.`);
  }
  return parts.join(' ');
}

/**
 * MessageBuilder that asks an OpenRouter model for the update text and falls back to
 * a template when the feature is off or every attempt fails or comes back empty.
 */
export class NarrativeBuilder implements MessageBuilder {
  private readonly client: ChatClient | null;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly logger = new Logger(NarrativeBuilder.name);

  constructor(
    private readonly env: { OPENROUTER_API_KEY?: string; OPENROUTER_MODEL?: string },
    options: NarrativeBuilderOptions = {},
  ) {
    this.client = options.client ?? (isNarrativeEnabled(env) ? new OpenRouter({ apiKey: env.OPENROUTER_API_KEY }) : null);
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async build(facts: NarrativeFacts): Promise<BuiltMessage> {
    const model = this.env.OPENROUTER_MODEL;
    if (!isNarrativeEnabled(this.env) || !this.client || !model) {
      return { text: templateMessage(facts), fallback: true };
    }
    for (let attempt = 0; attempt <= NARRATIVE_MAX_RETRIES; attempt++) {
      if (attempt > 0) await this.sleep(NARRATIVE_BACKOFF_BASE_MS * 2 ** (attempt - 1));
      try {
        const result = await this.client.chat.send(
          {
            chatRequest: {
              model,
              maxTokens: NARRATIVE_MAX_TOKENS,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: factLines(facts).join('\n') },
              ],
            },
          },
          { timeoutMs: NARRATIVE_TIMEOUT_MS },
        );
        const content = result.choices[0]?.message.content;
        const text = typeof content === 'string' ? content.trim() : '';
        if (text) return { text, fallback: false };
        this.logger.warn(`Narrative attempt ${attempt + 1} returned no text`);
      } catch (error) {
        // try again; after the last attempt we fall through to the template
        this.logger.warn(`Narrative attempt ${attempt + 1} failed: ${String(error)}`);
      }
    }
    return { text: templateMessage(facts), fallback: true };
  }
}
