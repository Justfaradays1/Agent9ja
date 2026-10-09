// sim/query/index.js — read-only views over kernel state (M001).
// Player-facing queries can never return ground truth (no ground truth exists
// yet at M001) and can never mutate: every view is deep-frozen.

export function describeQueryContract() {
  return Object.freeze([
    'time() -> {minutes, day, phase, steps}',
    'flags() -> frozen copy',
    'journal(limit) -> frozen events, limit clamped',
    'event(seq) -> frozen event|null',
    'trace(seq) -> frozen caused_by chain (why-* foundation)',
    'person(id)/people() — M002',
    'rel/stance/tags/standing — M002 (standing favour is 0 until M004)',
    'balance/wallet/transactions/ledger_consistent — M003 integer kobo',
    'obligation/obligations/due_soon/overlaps — M003',
    'what_they_remember — M005 summaries only (kinds+subjects+times, never values)',
    'chats/book/notifications/draft_action — M008 (book carries only said claims; notifications derived+capped)',
    'where_is/world — M009 (presence with reasons; resources + levy ledger)',
  ]);
}
