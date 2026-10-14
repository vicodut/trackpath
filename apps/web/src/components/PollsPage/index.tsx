import { useState } from 'react';
import type { Poll } from '../../api/polls';
import styles from './PollsPage.module.css';

interface PollsPageProps {
  polls: Poll[];
  isAdmin: boolean;
  onVote: (pollId: number, optionId: number) => void;
  onSuggest: (question: string, options: string[]) => Promise<void>;
  onClose: () => void;
}

const STORAGE_KEY = 'trackpath:poll-suggestion';

interface StoredSuggestion { question: string; options: string[] }

function readStored(): StoredSuggestion | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); }
  catch { return null; }
}

function SuggestForm({ onSuggest }: { onSuggest: (q: string, opts: string[]) => Promise<void> }) {
  const [pending, setPending] = useState<StoredSuggestion | null>(() => readStored());
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const canSubmit = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const suggestion: StoredSuggestion = {
      question: question.trim(),
      options: options.filter((o) => o.trim()),
    };
    await onSuggest(suggestion.question, suggestion.options);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(suggestion));
    setPending(suggestion);
    setQuestion('');
    setOptions(['', '']);
    setOpen(false);
  };

  const handleDismiss = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPending(null);
  };

  if (pending) {
    return (
      <div className={styles.pendingCard}>
        <div className={styles.pendingHeader}>
          <span className={styles.pendingLabel}>Your suggestion · pending review</span>
          <button className={styles.pendingDismiss} onClick={handleDismiss} title="Dismiss">✕</button>
        </div>
        <p className={styles.pendingQuestion}>{pending.question}</p>
        <ul className={styles.pendingOptions}>
          {pending.options.map((o, i) => <li key={i}>{o}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.suggestBox}>
      {!open ? (
        <button className={styles.suggestToggle} onClick={() => { setOpen(true); }}>
          💡 Suggest a poll
        </button>
      ) : (
        <div className={styles.suggestForm}>
          <p className={styles.suggestTitle}>Suggest a poll</p>
          <input
            className={styles.suggestInput}
            placeholder="Your question…"
            value={question}
            onChange={(e) => { setQuestion(e.target.value); }}
          />
          <div className={styles.suggestOptions}>
            {options.map((o, i) => (
              <input
                key={i}
                className={styles.suggestInput}
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => { setOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p))); }}
              />
            ))}
          </div>
          {options.length < 6 && (
            <button className={styles.suggestAddOption} onClick={() => { setOptions((p) => [...p, '']); }}>
              + add option
            </button>
          )}
          <div className={styles.suggestActions}>
            <button className="primary" disabled={!canSubmit} onClick={handleSubmit}>
              Send suggestion
            </button>
            <button className={styles.suggestCancel} onClick={() => { setOpen(false); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PollsPage({ polls, isAdmin, onVote, onSuggest, onClose }: PollsPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>POLLS</h2>
        <button onClick={onClose}>✕</button>
      </div>

      <div className={styles.list}>
        {!isAdmin && <SuggestForm onSuggest={onSuggest} />}
        {polls.length === 0 && (
          <p className={styles.empty}>No polls yet.</p>
        )}
        {polls.map((poll) => {
          const voted = poll.votedOptionId != null;
          const showResults = voted || poll.closed;
          const maxVotes = Math.max(...poll.options.map((o) => o.voteCount), 1);

          return (
            <div key={poll.id} className={`${styles.pollCard} ${poll.closed ? styles.pollClosed : ''}`}>
              <div className={styles.pollTop}>
                <p className={styles.pollQuestion}>{poll.question}</p>
                {poll.closed && <span className={styles.closedBadge}>CLOSED</span>}
              </div>

              {!showResults ? (
                <div className={styles.options}>
                  {poll.options.map((opt) => (
                    <button
                      key={opt.id}
                      className={styles.optionBtn}
                      onClick={() => { onVote(poll.id, opt.id); }}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.results}>
                  {poll.options.map((opt) => {
                    const pct = poll.totalVotes > 0
                      ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                      : 0;
                    const isVoted = opt.id === poll.votedOptionId;
                    return (
                      <div key={opt.id} className={`${styles.resultRow} ${isVoted ? styles.resultVoted : ''}`}>
                        <span className={styles.resultLabel}>{opt.text}</span>
                        <div className={styles.bar}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${(opt.voteCount / maxVotes) * 100}%` }}
                          />
                        </div>
                        <span className={styles.pct}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className={styles.meta}>
                {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
                {voted && !poll.closed && <span> · thanks for voting!</span>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
