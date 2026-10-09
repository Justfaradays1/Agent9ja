// tools/sim-console.js — headless developer console (M001+).
// Read-only --person/--rel/--balance/--obl/--due/--claims/--card/--menu views.
// --truth is DEV-ONLY ground-truth inspection (never a player path).
// Usage:
//   node tools/sim-console.js --seed demo [--send '<cmd json>'] [--advance N]
//     [--flags] [--journal [N]] [--trace SEQ] [--snapshot]
//     [--person ID] [--rel A B] [--balance ID] [--obl ID] [--due [N]]
//     [--claims] [--card FACT] [--menu ASKER TARGET] [--remember ID] [--truth FACT]
//     [--situations] [--threads] [--chats] [--book] [--notifications]
import { bootWorld } from './world.js';

const args = process.argv.slice(2);
let seed = 'dev-seed';
let booted = bootWorld(seed);
let kernel = booted.kernel;
let knowledgeDebug = booted.knowledge;

function useSeed(s) { seed = s; booted = bootWorld(s); kernel = booted.kernel; knowledgeDebug = booted.knowledge; }

const out = [];
let i = 0;
let advN = 0;
useSeed('dev-seed');
while (i < args.length) {
  const a = args[i++];
  if (a === '--seed') { useSeed(args[i++]); out.push({ seed }); }
  else if (a === '--send') {
    const cmd = JSON.parse(args[i++]);
    const r = kernel.dispatch(cmd);
    out.push({ dispatch: r });
    if (r.status === 'rejected') { console.log(JSON.stringify(out, null, 2)); process.exit(2); }
  }
  else if (a === '--advance') {
    const n = Number(args[i++]);
    const r = kernel.dispatch({ cmd_id: `console_adv_${advN++}_${n}`, type: 'advance_time', actor: 'console', params: { steps: n } });
    out.push({ advance: r, time: kernel.query().time() });
  }
  else if (a === '--flags') out.push({ flags: kernel.query().flags() });
  else if (a === '--journal') {
    const n = args[i] && !args[i].startsWith('--') ? Number(args[i++]) : 50;
    out.push({ journal: kernel.query().journal(n) });
  }
  else if (a === '--trace') out.push({ trace: kernel.query().trace(Number(args[i++])) });
  else if (a === '--snapshot') out.push({ snapshot: kernel.snapshot() });
  else if (a === '--person') out.push({ person: kernel.query().person(args[i++]) });
  else if (a === '--rel') {
    const x = args[i++], y = args[i++];
    out.push({ rel: kernel.query().rel(x, y), stance: kernel.query().stance(x, y) });
  }
  else if (a === '--balance') out.push({ balance: kernel.query().balance(args[i++]) });
  else if (a === '--obl') out.push({ obligation: kernel.query().obligation(args[i++]) });
  else if (a === '--due') {
    const n = args[i] && !args[i].startsWith('--') ? Number(args[i++]) : 1440;
    out.push({ due_soon: kernel.query().due_soon(n) });
  }
  else if (a === '--claims') out.push({ claims: kernel.query().claims() });
  else if (a === '--card') out.push({ claim_card: kernel.query().claim_card(args[i++]) });
  else if (a === '--menu') {
    const x = args[i++], y = args[i++];
    out.push({ interaction_menu: kernel.query().interaction_menu(x, y) });
  }
  else if (a === '--remember') out.push({ remembers: kernel.query().what_they_remember(args[i++]) });
  else if (a === '--chats') out.push(kernel.query().chats());
  else if (a === '--book') out.push({ book: kernel.query().book() });
  else if (a === '--notifications') out.push({ notifications: kernel.query().notifications() });
  else if (a === '--situations') out.push({ situations: kernel.query().situations() });
  else if (a === '--threads') out.push({ threads: kernel.query().threads() });
  else if (a === '--truth') {
    // DEV-ONLY: ground-truth inspection. Never a player path; the query
    // surface has no equivalent (tested). For calibrating content by hand.
    out.push({ truth: knowledgeDebug.debugInspect().facts[args[i++]] ?? null });
  }
  else { console.error(`unknown arg: ${a}`); process.exit(2); }
}
console.log(JSON.stringify(out, null, 2));
