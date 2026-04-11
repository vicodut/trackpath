export interface PollOption {
  id: number;
  text: string;
  sortOrder: number;
  voteCount: number;
}

export interface Poll {
  id: number;
  question: string;
  closed: boolean;
  createdAt: string;
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

export const fetchPolls = (): Promise<Poll[]> =>
  fetch('/api/polls').then((r) => r.json());

export const createPoll = (question: string, options: string[]): Promise<Poll> =>
  fetch('/api/polls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, options }),
  }).then((r) => r.json());

export const votePoll = (pollId: number, optionId: number): Promise<VoteResult> =>
  fetch(`/api/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionId }),
  }).then((r) => r.json());

export const closePoll = (pollId: number): Promise<void> =>
  fetch(`/api/polls/${pollId}/close`, { method: 'PATCH' }).then(() => {});

export const deletePoll = (pollId: number): Promise<void> =>
  fetch(`/api/polls/${pollId}`, { method: 'DELETE' }).then(() => {});

export interface PollSuggestion {
  id: number;
  question: string;
  options: string[];
  ipAddress: string;
  createdAt: string;
}

export const suggestPoll = (question: string, options: string[]): Promise<void> =>
  fetch('/api/polls/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, options }),
  }).then(() => {});

export const fetchSuggestions = (): Promise<PollSuggestion[]> =>
  fetch('/api/polls/suggestions').then((r) => r.json());

export const acceptSuggestion = (id: number): Promise<Poll> =>
  fetch(`/api/polls/suggestions/${id}/accept`, { method: 'POST' }).then((r) => r.json());

export const rejectSuggestion = (id: number): Promise<void> =>
  fetch(`/api/polls/suggestions/${id}`, { method: 'DELETE' }).then(() => {});
