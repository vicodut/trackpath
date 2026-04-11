import { useState, useCallback, useEffect } from 'react';
import type { Poll, PollOption, PollSuggestion } from '../api/polls';
import {
  fetchPolls, createPoll, votePoll, closePoll, deletePoll,
  suggestPoll, fetchSuggestions, acceptSuggestion, rejectSuggestion,
} from '../api/polls';

export function usePolls() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [suggestions, setSuggestions] = useState<PollSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchPolls();
    setPolls(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const vote = useCallback(async (pollId: number, optionId: number) => {
    const result = await votePoll(pollId, optionId);
    setPolls((prev) =>
      prev.map((p) =>
        p.id === pollId
          ? { ...p, options: result.options as PollOption[], totalVotes: result.totalVotes, votedOptionId: result.votedOptionId }
          : p,
      ),
    );
  }, []);

  const create = useCallback(async (question: string, options: string[]) => {
    await createPoll(question, options);
    await load();
  }, [load]);

  const close = useCallback(async (pollId: number) => {
    await closePoll(pollId);
    setPolls((prev) => prev.map((p) => (p.id === pollId ? { ...p, closed: true } : p)));
  }, []);

  const remove = useCallback(async (pollId: number) => {
    await deletePoll(pollId);
    setPolls((prev) => prev.filter((p) => p.id !== pollId));
  }, []);

  const suggest = useCallback(async (question: string, options: string[]) => {
    await suggestPoll(question, options);
  }, []);

  const loadSuggestions = useCallback(async () => {
    const data = await fetchSuggestions();
    setSuggestions(data);
  }, []);

  const accept = useCallback(async (id: number) => {
    await acceptSuggestion(id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await load();
  }, [load]);

  const reject = useCallback(async (id: number) => {
    await rejectSuggestion(id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { polls, suggestions, loading, vote, create, close, remove, suggest, loadSuggestions, accept, reject };
}
