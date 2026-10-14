import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { polls, pollOptions, pollVotes, pollSuggestions } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import type { CreatePollDto, SuggestPollDto } from './polls.dto.js';

export interface PollOption {
  id: number;
  text: string;
  sortOrder: number;
  voteCount: number;
}

export interface PollResult {
  id: number;
  question: string;
  closed: boolean;
  createdAt: Date;
  options: PollOption[];
  totalVotes: number;
  votedOptionId: number | null;
}

export interface VoteResult {
  alreadyVoted: boolean;
  options: PollOption[];
  totalVotes: number;
  votedOptionId: number;
}

@Injectable()
export class PollsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async getAll(ipAddress: string): Promise<PollResult[]> {
    const allPolls = await this.db
      .select()
      .from(polls)
      .orderBy(sql`${polls.createdAt} DESC`);

    return Promise.all(allPolls.map((poll) => this.hydrate(poll, ipAddress)));
  }

  async create(dto: CreatePollDto): Promise<PollResult> {
    const [poll] = await this.db
      .insert(polls)
      .values({ question: dto.question })
      .returning();

    await this.db.insert(pollOptions).values(
      dto.options.map((text, i) => ({
        pollId: poll.id,
        text,
        sortOrder: i,
      })),
    );

    return this.hydrate(poll, '');
  }

  async vote(pollId: number, optionId: number, ipAddress: string): Promise<VoteResult> {
    const existing = await this.db
      .select()
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.ipAddress, ipAddress)))
      .limit(1);

    if (existing.length > 0) {
      const options = await this.getOptions(pollId);
      const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
      return { alreadyVoted: true, options, totalVotes, votedOptionId: existing[0].optionId };
    }

    await this.db.insert(pollVotes).values({ pollId, optionId, ipAddress });

    const options = await this.getOptions(pollId);
    const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
    return { alreadyVoted: false, options, totalVotes, votedOptionId: optionId };
  }

  async close(id: number): Promise<void> {
    const result = await this.db
      .update(polls)
      .set({ closed: true })
      .where(eq(polls.id, id))
      .returning();
    if (result.length === 0) throw new NotFoundException(`Poll ${id} not found`);
  }

  async deletePoll(id: number): Promise<void> {
    await this.db.delete(polls).where(eq(polls.id, id));
  }

  // ── Suggestions ──────────────────────────────────────────────────────────────

  async suggest(dto: SuggestPollDto, ipAddress: string): Promise<void> {
    await this.db.insert(pollSuggestions).values({
      question: dto.question,
      options: JSON.stringify(dto.options),
      ipAddress,
    });
  }

  async getSuggestions() {
    const rows = await this.db
      .select()
      .from(pollSuggestions)
      .orderBy(sql`${pollSuggestions.createdAt} DESC`);
    return rows.map((r) => ({ ...r, options: JSON.parse(r.options) as string[] }));
  }

  async acceptSuggestion(id: number): Promise<PollResult> {
    const [row] = await this.db
      .select()
      .from(pollSuggestions)
      .where(eq(pollSuggestions.id, id))
      .limit(1);
    if (!row) throw new NotFoundException(`Suggestion ${id} not found`);
    const options = JSON.parse(row.options) as string[];
    const poll = await this.create({ question: row.question, options });
    await this.db.delete(pollSuggestions).where(eq(pollSuggestions.id, id));
    return poll;
  }

  async rejectSuggestion(id: number): Promise<void> {
    await this.db.delete(pollSuggestions).where(eq(pollSuggestions.id, id));
  }

  private async getOptions(pollId: number): Promise<PollOption[]> {
    const rows = await this.db
      .select({
        id: pollOptions.id,
        text: pollOptions.text,
        sortOrder: pollOptions.sortOrder,
        voteCount: sql<number>`cast(count(${pollVotes.id}) as int)`,
      })
      .from(pollOptions)
      .leftJoin(pollVotes, eq(pollVotes.optionId, pollOptions.id))
      .where(eq(pollOptions.pollId, pollId))
      .groupBy(pollOptions.id)
      .orderBy(pollOptions.sortOrder);

    return rows;
  }

  private async hydrate(
    poll: { id: number; question: string; closed: boolean; createdAt: Date },
    ipAddress: string,
  ): Promise<PollResult> {
    const options = await this.getOptions(poll.id);
    const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);

    let votedOptionId: number | null = null;
    if (ipAddress) {
      const vote = await this.db
        .select()
        .from(pollVotes)
        .where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.ipAddress, ipAddress)))
        .limit(1);
      votedOptionId = vote[0]?.optionId ?? null;
    }

    return { ...poll, options, totalVotes, votedOptionId };
  }
}
