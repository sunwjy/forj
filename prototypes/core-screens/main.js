// PROTOTYPE — throwaway. sunwjy/forj#9 핵심 화면 구성 프로토타입.
// 질문: 여행 생성부터 일정 항목 편집까지의 화면을 어떻게 구성하나?
// ?variant=A 시트형 | B 페이지형 | C 인라인형. 시각 스타일은 고정(docs/design/visual-design.md), 데이터는 메모리에만 있다.

const TODAY = '2026-10-17';
const HOST = 'forj.app';
const EMOJIS = ['✈️', '🏨', '🍜', '📸', '🎢', '🛍️', '🚃', '☕️', '🍁', '🌇'];

const VARIANTS = {
  A: { name: '시트형', notes: [
    '<b>일정 편집</b>: 카드나 「＋ 일정 추가」를 누르면 바텀시트가 올라옵니다. 「저장」을 눌러야 반영됩니다. 뒤의 타임라인이 보이므로 맥락을 잃지 않습니다.',
    '<b>여행 만들기</b>: 최근 여행이 없으면 첫 화면에 폼이 바로 있고, 있으면 「새 여행 만들기」가 시트를 엽니다.',
    '<b>공유</b>: 상단 바의 🔗 아이콘을 누르면 바로 복사하고 토스트로 알립니다. 만든 직후에는 토스트로만 안내합니다.',
    '<b>여행 정보 수정</b>: 제목 옆 ✏️ → 시트.',
  ]},
  B: { name: '페이지형', notes: [
    '<b>일정 편집</b>: 전체 화면 페이지(<code>/t/…/items/…</code>)로 이동합니다. 상단 「저장」, 뒤로가기는 취소입니다. 입력 공간이 가장 넓고 URL이 생깁니다.',
    '<b>여행 만들기</b>: 별도 페이지 <code>/new</code>. 첫 화면은 버튼과 최근 여행만 둡니다.',
    '<b>공유</b>: 여행 화면 위쪽의 버터색 공유 링크 배너가 항상 보입니다. ×로 접으면 상단 바의 🔗 아이콘으로 바뀝니다.',
    '<b>여행 정보 수정</b>: 별도 페이지 <code>/t/…/settings</code>.',
  ]},
  C: { name: '인라인형', notes: [
    '<b>일정 편집</b>: 카드가 그 자리에서 펼쳐져 폼이 됩니다. <b>저장 버튼이 없고</b>, 필드에서 벗어나면 바로 저장됩니다(필드 단위 LWW와 잘 맞습니다).',
    '<b>일정 추가</b>: 일차 끝의 「＋ 일정 추가」 줄에 제목만 쓰고 Enter. 시각은 나중에 카드를 눌러 채웁니다. 플로팅 버튼이 없습니다.',
    '<b>여행 만들기</b>: 첫 화면 위쪽의 접힌 카드가 그 자리에서 폼으로 펼쳐집니다.',
    '<b>공유</b>: 여행을 만든 직후 "링크를 보내세요" 시트가 한 번 뜨고, 이후에는 상단 🔗 아이콘을 씁니다.',
    '<b>여행 정보 수정</b>: 헤더가 그 자리에서 폼으로 바뀝니다.',
  ]},
};
const KEYS = Object.keys(VARIANTS);
const params = new URLSearchParams(location.search);
let V = VARIANTS[params.get('variant')] ? params.get('variant') : 'A';

// ── date helpers ───────────────────────────────
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const addDays = (iso, n) => new Date(utc(iso) + n * 864e5).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
const dates = (s, e) => Array.from({ length: diffDays(s, e) + 1 }, (_, i) => addDays(s, i));
const md = (iso) => `${+iso.slice(5, 7)}.${iso.slice(8, 10)}`;
const dow = (iso) => DOW[new Date(utc(iso)).getUTCDay()];
const period = (s, e) => {
  const n = diffDays(s, e);
  return `${md(s)} (${dow(s)}) – ${md(e)} (${dow(e)}) · ${n === 0 ? '당일' : `${n}박 ${n + 1}일`}`;
};
const dday = (s, e) => {
  if (TODAY < s) return `D-${diffDays(TODAY, s)}`;
  if (TODAY <= e) return `${diffDays(s, TODAY) + 1}일차 여행 중`;
  return '다녀온 여행';
};
const periodError = (s, e) => {
  if (!s || !e) return '시작일과 종료일을 골라 주세요.';
  if (e < s) return '종료일이 시작일보다 빨라요.';
  if (diffDays(s, e) + 1 > 30) return '여행 기간은 최대 30일이에요.';
  return '';
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rid = (n) => Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[Math.random() * 64 | 0]).join('');

// ── seed data ──────────────────────────────────
let seq = 0;
const it = (date, start, end, title, memo, emoji) => ({ id: `i${++seq}`, date, start, end, title, memo, emoji });
function seed() {
  return {
    trips: {
      k7Qx2mR9vLp4Tn8sWb3eYa: { title: '오사카 먹방 여행', start: '2026-11-20', end: '2026-11-23', items: [
        it('2026-11-20', '09:40', '11:55', 'ICN → KIX', '피치항공 MM702', '✈️'),
        it('2026-11-20', '13:00', '', '난바 호텔 체크인', '호텔 몬테레이 그라스미어', '🏨'),
        it('2026-11-20', '15:00', '17:00', '도톤보리 산책', '글리코 사인 앞에서 사진 찍기', '📸'),
        it('2026-11-20', '16:30', '18:00', '이치란 라멘', '대기 30분 예상', '🍜'),
        it('2026-11-20', '', '', '편의점 간식 털기', '', '🛍️'),
        it('2026-11-21', '09:00', '19:00', '유니버설 스튜디오', '익스프레스 패스 4', '🎢'),
        it('2026-11-22', '10:00', '12:00', '오사카성 공원', '단풍 절정 예상', '🍁'),
        it('2026-11-22', '16:00', '', '우메다 공중정원', '해 질 녘 전망대', '🌇'),
        it('2026-11-23', '10:00', '', '신사이바시 쇼핑', '', '🛍️'),
        it('2026-11-23', '15:20', '17:10', 'KIX → ICN', '피치항공 MM707', '✈️'),
      ]},
      Jd9fPq2LxV7mNc4RtH6uZw: { title: '제주 가족 여행', start: '2026-12-24', end: '2026-12-26', items: [
        it('2026-12-24', '08:00', '09:10', 'GMP → CJU', '', '✈️'),
        it('2026-12-25', '', '', '오름 하나 오르기', '날씨 보고 정하기', '🍁'),
      ]},
    },
    recent: [
      { token: 'k7Qx2mR9vLp4Tn8sWb3eYa', title: '오사카 먹방 여행', start: '2026-11-20', end: '2026-11-23' },
      { token: 'Jd9fPq2LxV7mNc4RtH6uZw', title: '제주 가족 여행', start: '2026-12-24', end: '2026-12-26' },
      { token: 'Xg3hDeletedTrip0000001', title: '부산 당일치기', start: '2026-09-05', end: '2026-09-05' },
    ],
  };
}

// ── state ──────────────────────────────────────
const S = {
  ...seed(),
  route: { name: 'home' },
  online: true, queue: 0, rejectNext: false,
  day: null,
  sheet: null,      // 'create' | 'item' | 'trip' | 'share'
  edit: null,       // { itemId, isNew, base, draft, touched:Set, remote:{}, deleted, error }
  tripEdit: null,   // { draft:{title,start,end}, error }
  create: null,     // { title, start, end, error }  (C: inline open 여부도 겸함)
  confirm: null,    // { title, body, list, okLabel, ok }
  quick: null,      // C: 빠른 추가가 열린 날짜
  toast: null,
  flash: null,
  bannerOpen: true,
  lastRemoved: null,
};
const trip = () => S.trips[S.route.token];
const linkOf = (tok) => `${HOST}/t/${tok}`;

function path() {
  const r = S.route;
  if (r.name === 'home') return '/';
  if (r.name === 'create') return '/new';
  if (r.name === 'item') return `/t/${r.token}/items/${S.edit?.isNew ? 'new' : S.edit?.itemId}`;
  if (r.name === 'settings') return `/t/${r.token}/settings`;
  return `/t/${r.token}`;
}

// ── navigation ─────────────────────────────────
function go(route) {
  S.route = route; S.sheet = null; S.edit = null; S.tripEdit = null; S.quick = null; S.confirm = null;
  if (route.name === 'home') S.create = null;
  render();
  document.querySelector('.screen')?.scrollTo(0, 0);
}
function openTrip(token) {
  const t = S.trips[token];
  if (!t) {
    S.recent = S.recent.filter((r) => r.token !== token);  // 찾을 수 없는 여행은 목록에서 자동으로 빠진다 (#8)
    return go({ name: 'notfound', token });
  }
  touchRecent(token);
  S.day = dates(t.start, t.end).includes(S.day) ? S.day : t.start;
  S.animate = true;
  go({ name: 'trip', token });
}
function touchRecent(token) {
  const t = S.trips[token];
  S.recent = [{ token, title: t.title, start: t.start, end: t.end }, ...S.recent.filter((r) => r.token !== token)].slice(0, 50);
}

// ── toast ──────────────────────────────────────
let toastTimer;
function toast(msg, actions = []) {
  S.toast = { msg, actions };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; render(); }, actions.length ? 6000 : 1800);
  render();
}
function copyLink(token) {
  navigator.clipboard?.writeText(`https://${linkOf(token)}`).catch(() => {});
  toast('공유 링크를 복사했어요');
}

// ── server simulation (optimistic) ─────────────
function send(label, revert, onReject) {
  if (!S.online) { S.queue++; return; }
  if (!S.rejectNext) return;
  S.rejectNext = false;
  setTimeout(() => { revert(); onReject(); }, 700);  // 낙관적으로 반영한 뒤, 거부되면 되돌린다
}

// ── item edit ──────────────────────────────────
const blankDraft = (date) => ({ title: '', date, start: '', end: '', memo: '', emoji: '' });
function openItem(itemId) {
  const item = trip().items.find((i) => i.id === itemId);
  S.edit = { itemId, isNew: false, base: { ...item }, draft: { ...item }, touched: new Set(), remote: {}, deleted: false };
  if (V === 'A') S.sheet = 'item';
  if (V === 'B') S.route = { name: 'item', token: S.route.token };
  render();
}
function openNew(draft) {
  S.edit = { itemId: `i${++seq}`, isNew: true, base: null, draft, touched: new Set(), remote: {}, deleted: false };
  if (V === 'A') S.sheet = 'item';
  if (V === 'B') S.route = { name: 'item', token: S.route.token };
  if (V === 'C') {  // C는 새 일정을 먼저 만들고 그 자리에서 펼친다
    if (!draft.title) draft.title = '새 일정';
    const item = { id: S.edit.itemId, ...draft };
    trip().items.push(item);
    S.edit = { itemId: item.id, isNew: false, base: { ...item }, draft: { ...item }, touched: new Set(), remote: {}, deleted: false };
    S.day = draft.date;
  }
  render();
}
function closeEdit() {
  S.edit = null; S.sheet = null;
  if (S.route.name === 'item') S.route = { name: 'trip', token: S.route.token };
  render();
}
function commitEdit({ close = true } = {}) {
  const e = S.edit, t = trip(), d = e.draft;
  if (!d.title.trim()) { e.error = '제목을 입력해 주세요.'; return render(); }
  if (d.end && !d.start) { e.error = '종료 시각만 둘 수는 없어요. 시작 시각을 먼저 골라 주세요.'; return render(); }
  if (d.end && d.end < d.start) { e.error = '종료 시각이 시작 시각보다 빨라요.'; return render(); }
  e.error = '';
  const draftCopy = { ...d };
  if (e.isNew) {
    const item = { id: e.itemId, ...d };
    t.items.push(item);
    send('create', () => { t.items = t.items.filter((i) => i !== item); }, () => rejected(draftCopy, null));
  } else {
    const item = t.items.find((i) => i.id === e.itemId);
    const patch = {};
    for (const k of ['title', 'date', 'memo', 'emoji']) if (d[k] !== e.base[k]) patch[k] = d[k];
    if (d.start !== e.base.start || d.end !== e.base.end) Object.assign(patch, { start: d.start, end: d.end });  // 시각은 한 묶음 (ADR 0003)
    if (!item || !Object.keys(patch).length) { if (close) closeEdit(); return; }
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, item[k]]));
    Object.assign(item, patch);
    e.base = { ...item };
    send('update', () => Object.assign(item, before), () => rejected(draftCopy, item.id));
  }
  S.day = d.date;
  if (close) closeEdit(); else render();
}
function rejected(draft, itemId) {
  render();
  toast(`「${draft.title}」 변경을 저장하지 못했어요.`, [
    ...(itemId && trip().items.some((i) => i.id === itemId) ? [{ label: '다시 편집', fn: () => {
      openItem(itemId); Object.assign(S.edit.draft, draft); render();
    } }] : []),
    { label: '새 일정으로 추가', fn: () => openNewFromDraft(draft) },
  ]);
}
function openNewFromDraft(draft) {
  const t = trip();
  const date = dates(t.start, t.end).includes(draft.date) ? draft.date : t.start;
  S.edit = null; S.sheet = null;
  if (V === 'C') return openNew({ ...draft, date });
  openNew({ ...draft, date });
}
function deleteItem() {
  const e = S.edit;
  S.confirm = { title: '이 일정을 삭제할까요?', body: `「${esc(e.draft.title)}」을 함께 쓰는 모든 사람의 일정표에서 지웁니다. 되돌릴 수 없어요.`, okLabel: '삭제', danger: true, ok: () => {
    const t = trip(); const item = t.items.find((i) => i.id === e.itemId);
    t.items = t.items.filter((i) => i !== item);
    send('delete', () => item && t.items.push(item), () => toast('일정을 삭제하지 못했어요.'));
    closeEdit();
  } };
  render();
}
function overlapText() {
  const e = S.edit; if (!e) return '';
  const d = e.draft; if (!d.start) return '';
  const s1 = d.start, e1 = d.end || d.start;
  const hits = trip().items.filter((i) => i.id !== e.itemId && i.date === d.date && i.start).filter((i) => {
    const s2 = i.start, e2 = i.end || i.start;
    return s1 === s2 || (s1 < e2 && s2 < e1);
  });
  return hits.length ? `⏰ ${hits.map((i) => `「${esc(i.title)}」`).join(', ')}과 시간이 겹쳐요. 그대로 저장할 수 있어요.` : '';
}

// ── trip create / edit ─────────────────────────
function createTrip() {
  const c = S.create;
  if (!c.title.trim()) { c.error = '여행 제목을 입력해 주세요.'; return render(); }
  const err = periodError(c.start, c.end); if (err) { c.error = err; return render(); }
  const token = rid(22);
  S.trips[token] = { title: c.title.trim(), start: c.start, end: c.end, items: [] };
  S.create = null; S.bannerOpen = true;
  openTrip(token);
  if (V === 'A') toast('여행을 만들었어요. 🔗를 눌러 링크를 보내 보세요.');
  if (V === 'C') { S.sheet = 'share'; render(); }
}
function openTripEdit() {
  const t = trip();
  S.tripEdit = { draft: { title: t.title, start: t.start, end: t.end }, error: '' };
  if (V === 'A') S.sheet = 'trip';
  if (V === 'B') S.route = { name: 'settings', token: S.route.token };
  render();
}
function closeTripEdit() {
  S.tripEdit = null; S.sheet = null;
  if (S.route.name === 'settings') S.route = { name: 'trip', token: S.route.token };
  render();
}
function saveTrip() {
  const te = S.tripEdit, d = te.draft, t = trip();
  if (!d.title.trim()) { te.error = '여행 제목을 입력해 주세요.'; return render(); }
  const err = periodError(d.start, d.end); if (err) { te.error = err; return render(); }
  const keep = new Set(dates(d.start, d.end));
  const doomed = t.items.filter((i) => !keep.has(i.date));
  const apply = () => {
    t.items = t.items.filter((i) => keep.has(i.date));
    Object.assign(t, { title: d.title.trim(), start: d.start, end: d.end });
    touchRecent(S.route.token);
    if (!keep.has(S.day)) S.day = d.start;
    S.confirm = null; closeTripEdit();
  };
  if (!doomed.length) return apply();
  const lost = [...new Set(doomed.map((i) => i.date))].sort();
  S.confirm = {
    title: `일정 ${doomed.length}개가 함께 삭제돼요`,
    body: `${lost.map((x) => `${md(x)} (${dow(x)})`).join(', ')}이 여행 기간에서 빠져요. 이 날짜의 일정이 모든 사람의 일정표에서 사라지며, 되돌릴 수 없어요.`,
    list: doomed.map((i) => `${i.emoji || '•'} ${esc(i.title)}`),
    okLabel: '삭제하고 기간 변경', danger: true, ok: apply,
  };
  render();
}

// ── render: pieces ─────────────────────────────
const field = (form, name, label, input, extra = '') => {
  const remote = form === 'edit' && S.edit?.remote[name];
  const note = remote ? `<span class="remote-note">${remote}</span>` : '';
  return `<div class="field${remote ? ' remote' : ''}"><label>${label}</label>${input}${note}${extra}</div>`;
};
const inp = (form, f, val, attrs = '') => `<input data-form="${form}" data-f="${f}" value="${esc(val)}" ${attrs}>`;

function itemForm() {
  const e = S.edit, d = e.draft, t = trip();
  const ds = dates(t.start, t.end);
  const deleted = e.deleted ? `<div class="deleted-banner">삭제된 일정입니다. 다른 사람이 이 일정을 지웠어요.
    <div style="display:flex;gap:8px"><button class="btn btn-sm btn-soft" data-act="readd">새 일정으로 추가</button><button class="btn btn-sm btn-ghost" data-act="close-edit">닫기</button></div></div>` : '';
  return `<div class="form">
    ${deleted}
    <div class="field"><span class="lbl">아이콘</span><div class="emojis">${EMOJIS.map((x) => `<button data-act="emoji" data-e="${x}" aria-pressed="${d.emoji === x}">${x}</button>`).join('')}</div></div>
    ${field('edit', 'title', '제목', inp('edit', 'title', d.title, 'placeholder="예: 이치란 라멘" maxlength="60"'))}
    ${field('edit', 'date', '일차', `<select data-form="edit" data-f="date">${ds.map((x, i) => `<option value="${x}" ${x === d.date ? 'selected' : ''}>${i + 1}일차 · ${md(x)} (${dow(x)})</option>`).join('')}</select>`)}
    ${field('edit', 'time', '시각 <span style="font-weight:500">(비워 두면 「시간 미정」)</span>', `<div class="row2">${inp('edit', 'start', d.start, 'type="time" aria-label="시작 시각"')}${inp('edit', 'end', d.end, 'type="time" aria-label="종료 시각"')}</div>`, `<div class="hint" id="overlap">${overlapText()}</div>`)}
    ${field('edit', 'memo', '메모', `<textarea data-form="edit" data-f="memo" placeholder="예약 번호, 주소, 준비물">${esc(d.memo)}</textarea>`)}
    ${e.error ? `<p class="err">${e.error}</p>` : ''}
  </div>`;
}
function tripForm(form, d, error) {
  return `<div class="form">
    ${field(form, 'title', '여행 제목', inp(form, 'title', d.title, 'placeholder="예: 오사카 먹방 여행" maxlength="40"'))}
    <div class="row2">
      ${field(form, 'start', '시작일', inp(form, 'start', d.start, 'type="date"'))}
      ${field(form, 'end', '종료일', inp(form, 'end', d.end, 'type="date"'))}
    </div>
    <p class="small muted">${d.start && d.end && !periodError(d.start, d.end) ? period(d.start, d.end) : '기간은 최대 30일까지 정할 수 있어요.'}</p>
    ${error ? `<p class="err">${error}</p>` : ''}
  </div>`;
}

function topbar({ back = 'go-home', share = true } = {}) {
  const t = trip();
  return `<div class="topbar">
    <button class="btn-icon" data-act="${back}" aria-label="뒤로">←</button>
    <div class="mid">${S.online ? `<span class="dday">${dday(t.start, t.end)}</span>` : '<span class="offline">연결 끊김 · 다시 연결하는 중</span>'}</div>
    ${share ? '<button class="btn-icon" data-act="share" aria-label="공유 링크 복사">🔗</button>' : '<span style="width:44px"></span>'}
  </div>`;
}

function card(i, k) {
  const editing = V === 'C' && S.edit?.itemId === i.id;
  if (editing) {
    return `<div class="item-card editing">${itemForm()}
      <div class="form-actions"><button class="btn btn-sm btn-danger" data-act="delete-item">삭제</button>
      <button class="btn btn-sm btn-soft" data-act="close-edit">완료</button></div></div>`;
  }
  const time = i.start ? `${i.start}${i.end ? `–${i.end}` : ''}` : '';
  const sub = [time, i.memo].filter(Boolean).join(' · ');
  return `<button class="item-card${S.flash === i.id ? ' flash' : ''}" style="animation-delay:${k * 60}ms" data-act="open-item" data-id="${i.id}">
    <h4><span class="item-icon">${i.emoji || '•'}</span>${esc(i.title)}</h4>${sub ? `<p class="num">${esc(sub)}</p>` : ''}</button>`;
}
function timeline(t) {
  const items = t.items.filter((i) => i.date === S.day);
  const timed = items.filter((i) => i.start).sort((a, b) => a.start.localeCompare(b.start) || (a.end || '').localeCompare(b.end || ''));
  const untimed = items.filter((i) => !i.start);
  const row = (i, k, hollow) => `<div class="tl-row"><div class="tl-time num">${i.start || ''}</div><div class="tl-rail"><span class="tl-dot${hollow ? ' hollow' : ''}"></span></div><div>${card(i, k)}</div></div>`;
  let html = '';
  if (!items.length) html += `<div class="empty-day">아직 일정이 없어요.<br>${V === 'C' ? '아래에서 첫 일정을 추가해 보세요.' : '「＋ 일정 추가」로 첫 일정을 넣어 보세요.'}</div>`;
  if (timed.length) html += `<div class="tl-group">${timed.map((i, k) => row(i, k)).join('')}</div>`;
  if (untimed.length) html += `<div class="tl-label">시간 미정</div><div class="tl-group">${untimed.map((i, k) => row(i, timed.length + k, true)).join('')}</div>`;
  if (V === 'C') {
    html += S.quick === S.day
      ? `<div class="quick-add"><input data-quick="1" placeholder="일정 제목을 쓰고 Enter" maxlength="60" autofocus></div><p class="small muted" style="margin:6px 0 0 56px">시각과 메모는 추가한 뒤 카드를 눌러 채워요.</p>`
      : '<div class="quick-add"><button class="add" data-act="quick-open">＋ 일정 추가</button></div>';
  }
  return html;
}

// ── render: screens ────────────────────────────
function homeScreen() {
  const list = S.recent.length ? `<div class="section-title">최근 여행</div><div class="recent">${S.recent.map((r) => `
    <div class="recent-row"><button class="open" data-act="open-trip" data-token="${r.token}"><b>${esc(r.title)}</b><span class="num">${period(r.start, r.end)}</span></button>
    <button class="btn-icon plain" data-act="remove-recent" data-token="${r.token}" aria-label="목록에서 지우기">×</button></div>`).join('')}</div>
    <p class="small muted" style="margin-top:10px">이 브라우저에서 만들거나 열었던 여행이에요. 목록에서 지워도 여행은 남아 있어요.</p>` : '';
  const hero = `<div class="hero"><div class="big">🧳</div><h1>함께 짜는 여행 일정표</h1><p>가입 없이 링크 하나로 일행과 함께 편집해요.</p></div>`;
  const form = (title) => `<div class="card">${title ? `<h3 style="margin-bottom:6px">${title}</h3>` : ''}${tripForm('create', S.create, S.create.error)}
    <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="create">여행 만들기</button></div>`;

  if (V === 'A') {
    if (!S.recent.length) { S.create ??= { title: '', start: '', end: '' }; return `<div class="brand">forj</div>${hero}${form('')}`; }
    return `<div class="brand">forj</div><button class="btn btn-primary btn-block" style="margin-top:12px" data-act="open-create">＋ 새 여행 만들기</button>${list}`;
  }
  if (V === 'B') {
    if (!S.recent.length) return `<div class="brand">forj</div>${hero}<button class="btn btn-primary btn-block" data-act="open-create">＋ 새 여행 만들기</button>`;
    return `<div class="brand">forj</div><button class="btn btn-primary btn-block" style="margin-top:12px" data-act="open-create">＋ 새 여행 만들기</button>${list}`;
  }
  if (!S.recent.length) S.create ??= { title: '', start: '', end: '' };
  return `<div class="brand">forj</div>${S.recent.length ? '' : hero}
    ${S.create ? `${form('새 여행')}${S.recent.length ? '<button class="btn btn-ghost btn-block" data-act="cancel-create">접기</button>' : ''}` : '<button class="collapsed-create" data-act="open-create">＋ 새 여행 만들기</button>'}${list}`;
}
function createPage() {
  return `<div class="page-head"><button class="btn-icon" data-act="go-home" aria-label="뒤로">←</button><h2>새 여행</h2></div>
    <div class="hero" style="padding:12px 0 18px"><div class="big">🧳</div></div>
    ${tripForm('create', S.create, S.create.error)}
    <button class="btn btn-primary btn-block" style="margin-top:16px" data-act="create">여행 만들기</button>`;
}
function tripScreen() {
  const t = trip(); const ds = dates(t.start, t.end);
  if (!ds.includes(S.day)) S.day = ds[0];
  const idx = ds.indexOf(S.day);
  const banner = V === 'B' && S.bannerOpen ? `<div class="share-banner"><span>🔗</span><span class="txt"><span class="link-txt">${linkOf(S.route.token)}</span><span class="cap">이 링크를 가진 사람은 누구나 보고 편집할 수 있어요</span></span>
    <button class="copy" data-act="share">복사</button><button class="x" data-act="banner-close" aria-label="배너 접기">×</button></div>` : '';
  const head = V === 'C' && S.tripEdit
    ? `<div class="card" style="margin-bottom:14px">${tripForm('trip', S.tripEdit.draft, S.tripEdit.error)}<div class="form-actions"><button class="btn btn-sm btn-ghost" data-act="close-trip-edit">취소</button><button class="btn btn-sm btn-soft" data-act="save-trip">저장</button></div></div>`
    : `<div class="trip-head"><h1>${esc(t.title)}<button data-act="edit-trip" aria-label="여행 정보 수정">✏️</button></h1><p class="num">${period(t.start, t.end)}</p></div>`;
  const chips = `<div class="chips">${ds.map((x, i) => `<button class="day-chip day-${i % 4 + 1}" data-act="pick-day" data-date="${x}" aria-pressed="${x === S.day}"><b>${i + 1}일차</b><span class="num">${md(x)} ${dow(x)}</span></button>`).join('')}</div>`;
  const fab = V !== 'C' ? '<button class="btn btn-primary fab" data-act="new-item">＋ 일정 추가</button>' : '';
  const animate = S.animate; S.animate = false;
  return {
    html: `${topbar({ share: !(V === 'B' && S.bannerOpen) })}${banner}${head}${chips}<div class="day-${idx % 4 + 1}${animate ? ' animate' : ''}">${timeline(t)}</div>`,
    fixed: fab,
  };
}
function itemPage() {
  const e = S.edit; const idx = dates(trip().start, trip().end).indexOf(e.draft.date);
  return `<div class="page-head"><button class="btn-icon" data-act="close-edit" aria-label="취소">←</button><h2>${e.isNew ? '새 일정' : '일정 편집'}</h2>
    ${e.deleted ? '' : '<button class="btn btn-sm btn-primary" data-act="save-item">저장</button>'}</div>
    ${S.online ? '' : '<p style="margin-bottom:8px"><span class="offline">연결 끊김 · 다시 연결하는 중</span></p>'}
    <div class="day-${idx % 4 + 1}">${itemForm()}</div>
    ${e.isNew || e.deleted ? '' : '<button class="btn btn-danger btn-block" style="margin-top:20px" data-act="delete-item">이 일정 삭제</button>'}`;
}
function settingsPage() {
  return `<div class="page-head"><button class="btn-icon" data-act="close-trip-edit" aria-label="취소">←</button><h2>여행 정보</h2><button class="btn btn-sm btn-primary" data-act="save-trip">저장</button></div>
    ${tripForm('trip', S.tripEdit.draft, S.tripEdit.error)}
    <p class="small muted" style="margin-top:14px">기간을 줄이면 빠지는 날짜의 일정이 함께 삭제돼요. 저장하기 전에 한 번 더 확인해요.</p>`;
}
function notFound() {
  return `<div class="brand">forj</div><div class="hero" style="padding-top:80px"><div class="big">🗺️</div><h1>여행을 찾을 수 없어요</h1>
    <p>링크가 정확한지 확인해 주세요.<br>여행이 삭제되었을 수도 있어요.</p></div>
    <button class="btn btn-primary btn-block" data-act="go-home">처음 화면으로</button>`;
}

function sheetHtml() {
  if (S.sheet === 'create') return `<h3>새 여행</h3>${tripForm('create', S.create, S.create.error)}
    <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="create">여행 만들기</button>`;
  if (S.sheet === 'item') {
    const e = S.edit; const idx = dates(trip().start, trip().end).indexOf(e.draft.date);
    return `<h3>${e.isNew ? '새 일정' : '일정 편집'}</h3>${S.online ? '' : '<p style="margin-bottom:8px"><span class="offline">연결 끊김 · 다시 연결하는 중</span></p>'}
      <div class="day-${idx % 4 + 1}">${itemForm()}</div>
      ${e.deleted ? '' : `<div class="form-actions">${e.isNew ? '<span></span>' : '<button class="btn btn-sm btn-danger" data-act="delete-item">삭제</button>'}
      <div style="display:flex;gap:8px"><button class="btn btn-ghost" data-act="close-edit">취소</button><button class="btn btn-primary" data-act="save-item">저장</button></div></div>`}`;
  }
  if (S.sheet === 'trip') return `<h3>여행 정보</h3>${tripForm('trip', S.tripEdit.draft, S.tripEdit.error)}
    <div class="form-actions"><span></span><div style="display:flex;gap:8px"><button class="btn btn-ghost" data-act="close-trip-edit">취소</button><button class="btn btn-primary" data-act="save-trip">저장</button></div></div>`;
  if (S.sheet === 'share') return `<div style="text-align:center;font-size:44px">🎉</div><h3 style="text-align:center">여행을 만들었어요</h3>
    <p class="small muted" style="text-align:center">함께 갈 사람에게 이 링크를 보내 주세요. 링크를 가진 사람은 누구나 보고 편집할 수 있어요.</p>
    <div class="linkbox">${linkOf(S.route.token)}</div>
    <button class="btn btn-primary btn-block" data-act="share-close">링크 복사</button>
    <button class="btn btn-ghost btn-block" data-act="close-sheet">나중에 보낼게요</button>`;
  return '';
}

// ── render ─────────────────────────────────────
const phone = document.getElementById('phone');
const notes = document.getElementById('notes');
const bar = document.getElementById('proto-bar');

function render() {
  const r = S.route;
  let html = '', fixed = '';
  if (r.name === 'home') html = homeScreen();
  else if (r.name === 'create') html = createPage();
  else if (r.name === 'trip') ({ html, fixed } = tripScreen());
  else if (r.name === 'item') html = itemPage();
  else if (r.name === 'settings') html = settingsPage();
  else html = notFound();

  const prevScroll = phone.querySelector('.screen')?.scrollTop ?? 0;
  const sheet = S.sheet ? `<div class="scrim" data-act="close-sheet"></div><div class="sheet"><div class="grip"></div>${sheetHtml()}</div>` : '';
  const dialog = S.confirm ? `<div class="scrim top" data-act="confirm-cancel"></div><div class="dialog" role="alertdialog"><h3>${S.confirm.title}</h3><p>${S.confirm.body}</p>
    ${S.confirm.list ? `<ul>${S.confirm.list.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
    <div class="acts"><button class="btn btn-sm btn-ghost" data-act="confirm-cancel">취소</button><button class="btn btn-sm ${S.confirm.danger ? 'btn-danger' : 'btn-soft'}" data-act="confirm-ok">${S.confirm.okLabel}</button></div></div>` : '';
  const toastHtml = S.toast ? `<div class="toast" role="status"><span class="msg">${esc(S.toast.msg)}</span>${S.toast.actions.map((a, i) => `<button data-act="toast" data-i="${i}">${a.label}</button>`).join('')}</div>` : '';
  phone.innerHTML = `<div class="urlbar"><span>${HOST}${path()}</span></div><div class="screen">${html}</div>${fixed}${sheet}${dialog}${toastHtml}`;
  phone.querySelector('.screen').scrollTop = prevScroll;
  phone.querySelector('[autofocus]')?.focus();
  if (S.flash) setTimeout(() => { S.flash = null; }, 0);  // 한 번만 깜빡인다
  renderNotes();
  renderBar();
}

function renderNotes() {
  const v = VARIANTS[V];
  const e = S.edit;
  const state = {
    path: path(),
    online: S.online,
    'queue(보내지 못한 변경)': S.queue,
    rejectNext: S.rejectNext,
    sheet: S.sheet,
    editing: e ? `${e.isNew ? 'new' : e.itemId} touched=[${[...e.touched]}] remote=[${Object.keys(e.remote)}]${e.deleted ? ' DELETED' : ''}` : null,
    recent: S.recent.map((x) => x.title),
  };
  const inTrip = ['trip', 'item', 'settings'].includes(S.route.name);
  notes.innerHTML = `
    <div><h2>${V}. ${v.name}</h2><p class="muted small">sunwjy/forj#9 · 화면 구성 시안 (시각 스타일은 ADR 0001로 고정)</p></div>
    <div class="box"><ul>${v.notes.map((n) => `<li>${n}</li>`).join('')}</ul></div>
    <div class="box"><h3>다른 사람의 행동 · 서버 시뮬레이션</h3><div class="sim">
      <button data-sim="remote-edit" ${inTrip ? '' : 'disabled'}>✏️ 다른 사람이 ${e ? '편집 중인' : '이 일차의 첫'} 일정을 수정</button>
      <button data-sim="remote-delete" ${inTrip ? '' : 'disabled'}>🗑️ 다른 사람이 ${e ? '편집 중인' : '이 일차의 마지막'} 일정을 삭제</button>
      <button data-sim="remote-add" ${inTrip ? '' : 'disabled'}>➕ 다른 사람이 이 일차에 일정을 추가</button>
      <button data-sim="reject" class="${S.rejectNext ? 'on' : ''}">⛔ 다음 저장을 서버가 거부${S.rejectNext ? ' (대기 중)' : ''}</button>
      <button data-sim="offline" class="${S.online ? '' : 'on'}">📡 ${S.online ? '연결 끊기' : '다시 연결하기'}</button>
      <button data-sim="notfound">🔗 없는 여행 링크 열기</button>
      <button data-sim="clear-recent">🧹 최근 여행 비우기 (첫 방문)</button>
      <button data-sim="reset">↺ 처음 상태로</button>
    </div></div>
    <div class="box"><h3>상태</h3><div class="state">${esc(JSON.stringify(state, null, 2))}</div></div>`;
}
function renderBar() {
  bar.innerHTML = `<button data-dir="-1" aria-label="이전 시안">‹</button><span>${V} (${VARIANTS[V].name})</span><button data-dir="1" aria-label="다음 시안">›</button>`;
}
function setVariant(dir) {
  V = KEYS[(KEYS.indexOf(V) + dir + KEYS.length) % KEYS.length];
  const p = new URLSearchParams(location.search); p.set('variant', V);
  history.replaceState(null, '', `?${p}`);
  // 진행 중인 오버레이와 페이지 전용 경로를 정리한다
  S.sheet = null; S.edit = null; S.tripEdit = null; S.quick = null; S.confirm = null; S.create = null;
  if (['item', 'settings'].includes(S.route.name)) S.route = { name: 'trip', token: S.route.token };
  if (S.route.name === 'create') S.route = { name: 'home' };
  render();
}

// ── events ─────────────────────────────────────
const ACTS = {
  'go-home': () => go({ name: 'home' }),
  'open-trip': (el) => openTrip(el.dataset.token),
  'remove-recent': (el) => {
    const i = S.recent.findIndex((r) => r.token === el.dataset.token);
    S.lastRemoved = { entry: S.recent[i], i };
    S.recent.splice(i, 1);
    toast('최근 여행 목록에서 지웠어요', [{ label: '되돌리기', fn: () => { S.recent.splice(S.lastRemoved.i, 0, S.lastRemoved.entry); render(); } }]);
  },
  'open-create': () => {
    S.create = { title: '', start: '', end: '' };
    if (V === 'A') S.sheet = 'create';
    if (V === 'B') S.route = { name: 'create' };
    render();
  },
  'cancel-create': () => { S.create = null; render(); },
  create: createTrip,
  'close-sheet': () => { S.sheet = null; S.edit = null; S.tripEdit = null; if (S.route.name === 'home' && V === 'A' && S.recent.length) S.create = null; render(); },
  'pick-day': (el) => { S.day = el.dataset.date; S.animate = true; S.edit = V === 'C' ? null : S.edit; S.quick = null; render(); },
  'open-item': (el) => openItem(el.dataset.id),
  'new-item': () => openNew(blankDraft(S.day)),
  emoji: (el) => { const d = S.edit.draft; d.emoji = d.emoji === el.dataset.e ? '' : el.dataset.e; S.edit.touched.add('emoji'); if (V === 'C') commitEdit({ close: false }); else render(); },
  'save-item': () => commitEdit(),
  'close-edit': () => { if (V === 'C' && S.edit && !S.edit.deleted) commitEdit(); else closeEdit(); },
  'delete-item': deleteItem,
  readd: () => { const d = { ...S.edit.draft }; S.edit = null; S.sheet = null; if (S.route.name === 'item') S.route = { name: 'trip', token: S.route.token }; openNewFromDraft(d); },
  share: () => copyLink(S.route.token),
  'share-close': () => { S.sheet = null; copyLink(S.route.token); },
  'banner-close': () => { S.bannerOpen = false; render(); },
  'edit-trip': openTripEdit,
  'close-trip-edit': closeTripEdit,
  'save-trip': saveTrip,
  'confirm-ok': () => { const ok = S.confirm.ok; S.confirm = null; ok(); },
  'confirm-cancel': () => { S.confirm = null; render(); },
  toast: (el) => { const a = S.toast.actions[+el.dataset.i]; S.toast = null; a.fn(); },
  'quick-open': () => { S.quick = S.day; S.edit = null; render(); },
};
phone.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (el && ACTS[el.dataset.act]) ACTS[el.dataset.act](el);
});
phone.addEventListener('input', (ev) => {
  const { form, f } = ev.target.dataset; if (!form) return;
  const draft = form === 'edit' ? S.edit?.draft : form === 'trip' ? S.tripEdit?.draft : S.create;
  if (!draft) return;
  draft[f] = ev.target.value;
  if (form === 'edit') {
    S.edit.touched.add(f === 'start' || f === 'end' ? 'time' : f);
    if (f === 'start' || f === 'end' || f === 'date') { const o = document.getElementById('overlap'); if (o) o.innerHTML = overlapText(); }
  }
});
phone.addEventListener('change', (ev) => {
  const { form } = ev.target.dataset;
  if (form === 'edit' && V === 'C' && S.edit && !S.edit.deleted) commitEdit({ close: false });  // C: 필드를 벗어나면 바로 저장
  else if (form === 'edit' && ev.target.dataset.f === 'date') render();  // 일차 색을 바꾸기 위해
  else if (form === 'create' || form === 'trip') { const p = ev.target.closest('.form')?.querySelector('p.small'); const d = form === 'trip' ? S.tripEdit.draft : S.create; if (p) p.textContent = d.start && d.end && !periodError(d.start, d.end) ? period(d.start, d.end) : '기간은 최대 30일까지 정할 수 있어요.'; }
});
phone.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.dataset.quick) {
    const title = ev.target.value.trim(); if (!title) return;
    const item = { id: `i${++seq}`, ...blankDraft(S.day), title };
    trip().items.push(item);
    send('create', () => { trip().items = trip().items.filter((i) => i !== item); }, () => rejected(item, null));
    S.flash = item.id; render();
  }
  if (ev.key === 'Escape' && S.quick) { S.quick = null; render(); }
});

const SIMS = {
  'remote-edit': () => {
    const t = trip(); const e = S.edit;
    const target = e ? t.items.find((i) => i.id === e.itemId) : t.items.filter((i) => i.date === S.day).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'))[0];
    if (!target) return toast('이 일차에 일정이 없어요 (시뮬레이션)');
    // 편집 중인 사람이 제목을 건드렸으면 시각을, 아니면 제목을 바꾼다
    const field = e && e.touched.has('title') && !e.touched.has('time') ? 'time' : 'title';
    if (field === 'title') target.title = `${target.title.replace(/ \(수정됨\)$/, '')} (수정됨)`;
    else { target.start = '20:00'; target.end = '21:00'; }
    if (e && !e.isNew) {
      const mine = e.touched.has(field);
      const shown = field === 'title' ? `「${esc(target.title)}」` : '20:00–21:00';
      if (mine) e.remote[field] = `다른 사람이 ${shown}(으)로 바꿨어요. 저장하면 내 입력으로 바뀌어요.`;
      else {
        e.remote[field] = '방금 다른 사람이 바꿨어요.';
        if (field === 'title') e.draft.title = target.title; else Object.assign(e.draft, { start: target.start, end: target.end });
      }
      e.base[field === 'title' ? 'title' : 'start'] = target[field === 'title' ? 'title' : 'start'];
      if (field === 'time') e.base.end = target.end;
    } else S.flash = target.id;
    render();
  },
  'remote-delete': () => {
    const t = trip(); const e = S.edit;
    if (e && !e.isNew) {
      t.items = t.items.filter((i) => i.id !== e.itemId); e.deleted = true;
      if (V === 'C') { closeEdit(); toast(`다른 사람이 「${e.draft.title}」을 삭제했어요.`, [{ label: '새 일정으로 추가', fn: () => openNewFromDraft(e.draft) }]); return; }
    } else {
      const dayItems = t.items.filter((i) => i.date === S.day);
      const last = dayItems[dayItems.length - 1]; if (!last) return toast('이 일차에 일정이 없어요 (시뮬레이션)');
      t.items = t.items.filter((i) => i !== last);
    }
    render();
  },
  'remote-add': () => {
    const item = it(S.day, '21:00', '', '야경 보러 가기', '일행이 추가', '🌇');
    trip().items.push(item); S.flash = item.id; render();
  },
  reject: () => { S.rejectNext = !S.rejectNext; render(); },
  offline: () => { S.online = !S.online; if (S.online) S.queue = 0; render(); },
  notfound: () => openTrip('NoSuchTrip000000000000'),
  'clear-recent': () => { S.recent = []; go({ name: 'home' }); },
  reset: () => { Object.assign(S, seed(), { route: { name: 'home' }, online: true, queue: 0, rejectNext: false, sheet: null, edit: null, tripEdit: null, create: null, confirm: null, quick: null, toast: null, bannerOpen: true }); render(); },
};
notes.addEventListener('click', (ev) => { const b = ev.target.closest('[data-sim]'); if (b && SIMS[b.dataset.sim]) SIMS[b.dataset.sim](); });
bar.addEventListener('click', (ev) => { const b = ev.target.closest('[data-dir]'); if (b) setVariant(+b.dataset.dir); });
document.addEventListener('keydown', (ev) => {
  if (ev.target.closest('input, textarea, select, [contenteditable]')) return;
  if (ev.key === 'ArrowLeft') setVariant(-1);
  if (ev.key === 'ArrowRight') setVariant(1);
});

render();
