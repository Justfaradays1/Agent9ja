// game/debug/app.js — crude M010 Phase 1 front end. Owner: game/debug.
// Lists and buttons over read views and validated commands. The single legal
// crossing is game/bridge: this file never touches authoritative modules
// directly (boundary-checked). All world changes go through kernel.dispatch;
// every result, including rejections with reasons, is shown in the log.
import { bootWorld, applyScenario } from '../bridge/world-client.js';
import { createAdapter } from '../bridge/save-adapter.js';

const $ = (id) => document.getElementById(id);
const val = (id) => $(id).value.trim();
let kernel = null;
let cmdN = 0;
const adapter = createAdapter(window.localStorage);
const cmdId = (type) => `ui_${cmdN++}_${type}`;

function log(entry) {
  const li = document.createElement('li');
  li.className = entry.status || '';
  li.textContent = JSON.stringify(entry);
  $('log').prepend(li);
  while ($('log').children.length > 30) $('log').lastChild.remove();
}

function esc(v) {
  return String(v ?? '');
}

function send(type, params, actor = 't') {
  if (!kernel) { showResult(false, 'Boot or load a world first.'); return; }
  // UI-boundary double-submit guard: authoritative idempotency stays in the
  // kernel, but disabled buttons prevent accidental duplicate commands.
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach((b) => { b.disabled = true; });
  try {
    const r = kernel.dispatch({ cmd_id: cmdId(type), type, actor, params });
    if (r.status === 'applied') {
      showResult(true, `${type} applied. See what changed below.`);
    } else {
      showResult(false, `${type} refused: ${r.reason}`);
    }
    log({ cmd: type, status: r.status, reason: r.reason ?? null, seqs: r.produced ?? r.firstSeq ?? null });
    render();
  } finally {
    buttons.forEach((b) => { b.disabled = false; });
  }
}

function showResult(ok, text) {
  const el = $('result');
  el.className = ok ? 'ok' : 'bad';
  el.textContent = text;
}

async function content() {
  const get = async (p) => (await fetch(p)).json();
  const [places, routinesDoc, worldRules, storylets, director, chatter, chatTemplates,
    kinds, stance, memoryRules, disclosure, promiseTemplates, outcomeMapping] = await Promise.all([
    get('/content/places/places.json'), get('/content/people/routines.json'), get('/content/rules/world.json'),
    get('/content/story/slice.json'), get('/content/rules/director.json'), get('/content/rules/chatter.json'),
    get('/content/strings/chat.json'), get('/content/obligations/kinds.json'), get('/content/rules/stance.json'),
    get('/content/rules/memory.json'), get('/content/rules/disclosure.json'),
    get('/content/obligations/promise-templates.json'), get('/content/rules/obligation-outcomes.json'),
  ]);
  return {
    places, routinesDoc, worldRules, storylets, director, chatter, chatTemplates,
    kinds, stance, memoryRules, disclosure, promiseTemplates, outcomeMapping,
  };
}

async function makeKernel(seed) {
  const c = await content();
  return bootWorld({ seed, content: c }).kernel;
}

async function boot(seed) {
  try {
    kernel = await makeKernel(seed);
    cmdN = 0;
    showResult(true, 'World ready. Load the CP1 scenario to begin, or act freely.');
    log({ status: 'applied', booted: seed });
    render();
  } catch (err) {
    log({ status: 'rejected', reason: `boot failed: ${err.message}` });
  }
}

async function loadScenario() {
  if (!kernel) await boot(val('seed') || 'cp1-seed');
  try {
    const sc = await (await fetch('/tests/scenario/proof-m009.json')).json();
    const results = applyScenario(kernel, sc.steps);
    const bad = results.filter((r) => r.status !== 'applied');
    log({ scenario: 'proof-m009', applied: results.length - bad.length, rejected: bad });
    render();
  } catch (err) {
    log({ status: 'rejected', reason: `scenario failed: ${err.message}` });
  }
}

// Situation summary: presentation-only reading of existing queries. It
// invents nothing — every line restates query state and points at the
// control that acts on it.
function renderSituation(q) {
  const w = q.world();
  const lines = [];
  if (w.fault) {
    lines.push(`Transformer fault at ${w.fault.place} — the compound has no light.`);
  }
  if (w.levy) {
    const paid = Object.keys(w.levy.paid);
    lines.push(`Repair levy ${w.levy.id}: ${paid.length} of ${w.levy.members.length} members paid, ${w.levy.collected} kobo collected, due at t=${w.levy.due_t}.`);
    if (w.levy.paid.person_tola === undefined) {
      lines.push('Tola has not paid a share — use Pay my levy share below, or decline to pay and face the consequences.');
    } else {
      lines.push('Tola has paid. Advance time to see others pay, or watch what happens at the deadline.');
    }
  } else if (w.fault) {
    lines.push('No levy is open yet — open one below to fund the repair, or do nothing and live with the darkness.');
  } else {
    const src = w.resources.light.source;
    lines.push(src === 'none' || src === 'fault'
      ? 'No light right now. Routines continue; check the tank and the book.'
      : `Light is on (${src}). No emergency — advance time, talk to people, or check open threads.`);
  }
  const notes = q.notifications();
  if (notes.length > 0) lines.push(`${notes.length} notification${notes.length === 1 ? '' : 's'} need attention below.`);
  $('situation').innerHTML = '<ul>' + lines.map((l) => `<li>${esc(l)}</li>`).join('') + '</ul>';
}

function list(items, fmt) {
  if (!items || items.length === 0) return '<li class="note">none</li>';
  return items.map((x) => `<li>${esc(fmt(x))}</li>`).join('');
}

function render() {
  if (!kernel) return;
  const q = kernel.query();
  const t = q.time();
  $('clock').textContent = `t=${t.minutes} day ${t.day} phase ${t.phase}`;
  renderSituation(q);
  const w = q.world();
  $('world').innerHTML = `<ul>
    <li>places: ${esc(w.places.join(', '))}</li>
    ${Object.entries(w.presence).map(([p, v]) => `<li>${esc(p)}: ${esc(v.place)}${v.anchor ? '/' + esc(v.anchor) : ''} — ${esc(v.activity)} (${esc(v.reason)})</li>`).join('')}
    <li>light=${esc(w.resources.light.source)} gen=${w.resources.gen_on ? 'on' : 'off'} fuel_min=${w.resources.fuel_min} water=${w.resources.water}</li>
    <li>fault=${esc(w.fault ? w.fault.id + '@' + w.fault.place : 'none')}</li>
    <li>levy=${esc(w.levy ? `${w.levy.id} ${w.levy.collected}/${w.levy.per_head}x${w.levy.members.length} due@${w.levy.due_t} paid:${Object.keys(w.levy.paid).join(',')}` : 'none')}</li>
    <li>levy history: ${esc(w.levies_history.map((l) => `${l.id}:${l.status}`).join(', ') || 'none')}</li></ul>`;
  const people = ['person_tola', 'npc_musa', 'npc_seyi', 'npc_tobi'].filter((p) => q.person(p));
  $('people').innerHTML = '<ul>' + people.map((p) => {
    const where = q.where_is(p);
    return `<li>${esc(p)}: balance=${q.balance(p)} where=${esc(where ? where.place + '/' + (where.anchor ?? '?') + ' ' + where.activity : 'unplaced')}</li>`;
  }).join('') + '</ul>';
  $('obligations').innerHTML = '<ul>' + list(q.obligations({}), (o) => `${o.id} ${o.kind} ${o.owes}>${o.owed} ${o.amount ?? ''} paid=${o.paid ?? 0} ${o.status} due@${o.due_t}`) + '</ul>';
  const threads = q.threads({ status: 'open' });
  $('threads').innerHTML = '<ul>' + list(threads, (x) => `${x.id} [${(x.tags || []).join(',')}] deadline@${x.deadline_t}`) + '</ul>'
    + '<ul>' + list(q.situations().slice(0, 8), (s) => esc(typeof s === 'string' ? s : JSON.stringify(s))) + '</ul>';
  const chats = q.chats();
  $('chats').innerHTML = '<ul>'
    + chats.groups.map((g) => `<li><b>${esc(g.id)}</b> [${esc(g.members.join(','))}]<ul>`
      + g.messages.slice(-8).map((m) => `<li>${esc(m.from ?? 'notice')}: ${esc(m.template)} ${esc(JSON.stringify(m.params))}${m.claims?.length ? ' [claim]' : ''}</li>`).join('') + '</ul></li>').join('')
    + chats.dms.map((dm) => `<li><b>${esc(dm.thread)}</b><ul>`
      + dm.messages.slice(-6).map((m) => `<li>${esc(m.from)}: ${esc(m.template)} ${esc(JSON.stringify(m.params))}</li>`).join('') + '</ul></li>').join('') + '</ul>';
  $('book').innerHTML = '<ul>' + list(q.book(), (b) => `${b.fact} = ${b.asserted} (said by ${b.speaker}, ${b.origin_id})`) + '</ul>';
  $('notifications').innerHTML = '<ul>' + list(q.notifications(), (n) => `${n.kind} ref=${n.ref}`) + '</ul>';
  $('requests').textContent = 'open requests: ' + q.requests({ status: 'open' }).slice(0, 6).map((r) => r.id).join(', ');
  $('slots').textContent = 'slots: ' + adapter.slots().join(', ');
  $('journal').innerHTML = '<ul>' + q.journal(15).slice().reverse().map((e) =>
    `<li>#${e.seq} ${esc(e.kind)} ${esc(e.data && (e.data.reason || e.data.resolution || e.data.id || ''))}</li>`).join('') + '</ul>';
}

$('boot').onclick = () => boot(val('seed') || 'cp1-seed');
$('scenario').onclick = loadScenario;
$('adv1').onclick = () => send('advance_time', { steps: 1 });
$('adv12').onclick = () => send('advance_time', { steps: 12 });
$('adv48').onclick = () => send('advance_time', { steps: 48 });

$('go_ask').onclick = () => send('ask', { asker: val('ask_asker'), target: val('ask_target'), topic: val('ask_topic'), ...(val('ask_fact') ? { fact: val('ask_fact') } : {}) });
$('go_promise').onclick = () => send('promise', { template: val('pr_template'), owes: val('pr_owes'), owed: val('pr_owed') });
$('go_vouch').onclick = () => send('vouch', { voucher: val('v_voucher'), subject: val('v_subject'), audience: val('v_audience') });
$('go_repay').onclick = () => send('repay', { obligation: val('rp_obligation'), ...(val('rp_amount') ? { amount: Number(val('rp_amount')) } : {}) });
$('go_decline').onclick = () => send('decline', { request: val('dc_request') });

$('go_move').onclick = () => send('move_person', { person: val('mv_person'), place: val('mv_place') });
$('go_routine').onclick = () => send('set_routine', { person: val('rt_person'), template: val('rt_template'), home: val('rt_home') });
$('go_fault').onclick = () => send('trigger_fault', { fault_id: val('f_id'), place: val('f_place'), kind: 'transformer' });
$('go_levy').onclick = () => send('open_levy', { levy_id: val('l_id'), convenor: val('l_convenor'), collector: val('l_collector'), per_head: Number(val('l_head')), due_in_min: Number(val('l_due')), cause: val('l_cause') });
$('go_pay').onclick = () => send('pay_levy', { person: val('p_person'), levy_id: val('p_levy'), amount: Number(val('p_amount')) });
$('go_gen_on').onclick = () => send('set_generator', { person: 'person_tola', on: true });
$('go_gen_off').onclick = () => send('set_generator', { person: 'person_tola', on: false });
$('go_refill').onclick = () => send('refill_tank', { person: 'person_tola' });
$('go_tell').onclick = () => send('dm_tell', { from: val('dt_from'), to: val('dt_to'), fact: val('dt_fact') });
$('go_request').onclick = () => send('dm_request', { from: val('dr_from'), to: val('dr_to'), topic: val('dr_topic') });
$('go_raw').onclick = () => {
  try {
    const c = JSON.parse(val('raw'));
    send(c.type, c.params ?? {});
  } catch { log({ status: 'rejected', reason: 'raw box is not JSON' }); }
};

$('go_save').onclick = () => {
  if (!kernel) return log({ status: 'rejected', reason: 'nothing to save' });
  try {
    const r = adapter.save(val('slot') || 'cp1', kernel.snapshot());
    showResult(true, `Saved to slot ${val('slot')} (${r.bytes} bytes). Safe to reload the page.`);
    log({ status: 'applied', saved: val('slot'), bytes: r.bytes });
  } catch (err) { showResult(false, `Save failed: ${err.message}`); log({ status: 'rejected', reason: err.message }); }
  render();
};
$('go_load').onclick = async () => {
  try {
    const loaded = adapter.load(val('slot') || 'cp1');
    const fresh = await makeKernel('loaded');
    try {
      fresh.restore(loaded.snapshot);
      kernel = fresh;
      showResult(true, `Loaded ${loaded.source}${loaded.migratedFrom !== null ? ` (migrated from v${loaded.migratedFrom})` : ''}. Continue playing.`);
      log({ status: 'applied', loaded: loaded.source, migratedFrom: loaded.migratedFrom });
    } catch (err) { showResult(false, `Load refused: ${err.message}. Live world untouched.`); log({ status: 'rejected', reason: `restore failed, live world untouched: ${err.message}` }); }
  } catch (err) { log({ status: 'rejected', reason: err.message }); }
  render();
};
$('go_delete').onclick = () => { try { adapter.remove(val('slot') || 'cp1'); log({ status: 'applied', deleted: val('slot') }); } catch (err) { log({ status: 'rejected', reason: err.message }); } render(); };

boot('m009-proof');
