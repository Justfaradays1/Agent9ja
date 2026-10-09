// sim/economy/index.js — wallet + transactions. Owner: sim/economy (M003).
//
// Money is INTEGER minor units (kobo). No floats in authority, ever.
// Balance authoritative; history supports it. Boundedness (doctrine §1):
// per-account txn lists compact past TXN_CAP into a carried checkpoint, so the
// invariant `balance == carried.balance + signed(txns)` always holds.
// NPC bands are coarse query labels; exact settlement stays integer-exact.

import { assertId } from '../kernel/ids.js';

const TXN_CAP = 2000;
const TXN_TRIM_TO = 1000;
const TAG_RE = /^[a-z][a-z0-9_]{0,31}$/;

export function bandOf(balance) {
  if (balance < 1000) return 'broke';
  if (balance < 10000) return 'tight';
  if (balance < 100000) return 'comfortable';
  return 'flush';
}

/** Positive-int kobo. allowZero only for openings. */
export function checkAmount(v, { allowZero = false } = {}) {
  if (typeof v !== 'number' || !Number.isInteger(v)) return 'bad_amount: integer kobo required';
  if (v < 0 || (!allowZero && v === 0)) return 'bad_amount: must be positive';
  return null;
}

export function createEconomy(kernel) {
  const accounts = {}; // person -> {balance, carried:{balance,count}, txns:[]}

  kernel.registerStore('economy', {
    getState: () => ({ accounts }),
    setState: (s) => {
      for (const k of Object.keys(accounts)) delete accounts[k];
      Object.assign(accounts, s.accounts);
    },
  });

  const signed = (acct, t) => (t.to === acct ? t.amount : -t.amount);
  const compact = (id) => {
    const a = accounts[id];
    while (a.txns.length > TXN_CAP) {
      const drop = a.txns.splice(0, a.txns.length - TXN_TRIM_TO);
      for (const t of drop) a.carried.balance += signed(id, t);
      a.carried.count += drop.length;
    }
  };

  kernel.registerCommand('open_account', {
    validate: (p) => {
      if (!p || typeof p.person !== 'string') return 'open_account needs {person}';
      try { assertId(p.person, 'person'); } catch { return 'open_account needs a stable person id'; }
      const opening = p.opening === undefined ? 0 : p.opening;
      const bad = checkAmount(opening, { allowZero: true });
      if (bad) return bad;
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!q.person(p.person)) return { rejected: `unknown_person: ${p.person}` };
      if (accounts[p.person]) return { rejected: `account_exists: ${p.person}` };
      const origin = p.origin_id === undefined ? 'origin_dev' : p.origin_id;
      try { assertId(origin, 'origin_id'); } catch { return { rejected: 'bad origin_id' }; }
      return [{ kind: 'AccountOpened', data: { person: p.person, opening: p.opening ?? 0, origin_id: origin } }];
    },
  });

  kernel.registerCommand('transfer', {
    validate: (p) => {
      if (!p || typeof p.from !== 'string' || typeof p.to !== 'string') return 'transfer needs {from, to, amount}';
      try { assertId(p.from, 'from'); assertId(p.to, 'to'); } catch { return 'transfer needs stable person ids'; }
      if (p.from === p.to) return 'no_self_transfer';
      const bad = checkAmount(p.amount);
      if (bad) return bad;
      if (p.memo !== undefined && (typeof p.memo !== 'string' || p.memo.length > 140)) return 'bad_memo';
      if (p.obligation !== undefined) { try { assertId(p.obligation, 'obligation'); } catch { return 'bad obligation ref'; } }
      return null;
    },
    resolve: (cmd, q) => {
      const p = cmd.params;
      if (!accounts[p.from]) return { rejected: `no_account: ${p.from}` };
      if (!accounts[p.to]) return { rejected: `no_account: ${p.to}` };
      if (accounts[p.from].balance < p.amount) return { rejected: `insufficient_funds: ${p.from}` };
      const origin = p.origin_id === undefined ? 'origin_dev' : p.origin_id;
      return [{
        kind: 'MoneyMoved',
        data: { from: p.from, to: p.to, amount: p.amount, memo: p.memo ?? null, obligation: p.obligation ?? null, origin_id: origin },
      }];
    },
  });

  kernel.onApply('AccountOpened', (ev) => {
    const d = ev.data;
    accounts[d.person] = { balance: d.opening, carried: { balance: 0, count: 0 }, txns: [] };
    if (d.opening > 0) {
      accounts[d.person].txns.push({ id: `txn_${ev.seq}_open`, from: null, to: d.person, amount: d.opening, memo: 'opening', obligation: null, origin_id: d.origin_id, t: ev.t });
    }
  });

  kernel.onApply('MoneyMoved', (ev) => {
    const d = ev.data;
    const from = accounts[d.from], to = accounts[d.to];
    // Resolver validated; missing here is a programmer bug → fail loud.
    if (!from || !to) throw new Error('missing_account_in_apply');
    // Atomic by construction: synchronous, no yield points between debit/credit.
    from.balance -= d.amount;
    to.balance += d.amount;
    if (from.balance < 0) throw new Error('negative_balance_in_apply');
    const txn = { id: `txn_${ev.seq}`, from: d.from, to: d.to, amount: d.amount, memo: d.memo, obligation: d.obligation, origin_id: d.origin_id, t: ev.t };
    from.txns.push({ ...txn });
    to.txns.push({ ...txn });
    compact(d.from);
    compact(d.to);
  });

  kernel.registerQuery('balance', (person) => (accounts[person] ? accounts[person].balance : null));
  kernel.registerQuery('wallet', (person) => {
    const a = accounts[person];
    if (!a) return null;
    return { balance: a.balance, band: bandOf(a.balance), txnCount: a.txns.length, carriedCount: a.carried.count };
  });
  kernel.registerQuery('transactions', (person, limit = 50) => {
    const a = accounts[person];
    if (!a) return null;
    const n = Math.min(Math.max(limit, 0), 200);
    return n === 0 ? [] : a.txns.slice(-n).map((t) => ({ ...t }));
  });
  kernel.registerQuery('ledger_consistent', (person) => {
    const a = accounts[person];
    if (!a) return null;
    const sum = a.txns.reduce((s, t) => s + signed(person, t), 0);
    return a.balance === a.carried.balance + sum;
  });

  return {};
}

/** Seed helper through the pipeline (journaled, idempotent via stable cmd_ids). */
export function seedAccounts(kernel, defs) {
  return defs.map((d, i) => kernel.dispatch({
    cmd_id: `seed_acct_${d.person}_${i}`, type: 'open_account', actor: 'seed', params: d,
  }));
}
