(function () {
'use strict';
var S = { venue: { name: '', intro: '', email: '', currency: '$', formUrl: '', timezone: 'Asia/Singapore' },
  rules: { open: '09:00', close: '21:00', slot: 60, buffer: 0, notice: 0, window: 90, days: [0,1,2,3,4,5,6] },
  locations: [], rooms: [], busy: [] };
var ui = { tab: 'book', loc: null, room: null, date: '', sel: null, req: null, form: {}, msg: '', dirty: false };
var app = document.getElementById('app');

function h(tag, attrs) {
  var e = document.createElement(tag); attrs = attrs || {};
  Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v == null || v === false) return;
    if (k === 'class') e.className = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v; else if (k === 'checked') e.checked = true; else e.setAttribute(k, v === true ? '' : v); });
  for (var i = 2; i < arguments.length; i++) { var c = arguments[i];
    if (Array.isArray(c)) c.forEach(function (x) { if (x != null && x !== false) e.append(x); }); else if (c != null && c !== false) e.append(c); }
  return e;
}
function toMin(t) { var p = String(t || '').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function fmt(m) { var x = Math.floor(m / 60) % 24, y = m % 60; return (x % 12 || 12) + (y ? ':' + pad(y) : '') + (x >= 12 ? 'pm' : 'am'); }
function nowIn(tz) { try { var p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
  return { date: p.year + '-' + p.month + '-' + p.day, min: (+p.hour) * 60 + (+p.minute) }; }
  catch (e) { var d = new Date(); return { date: d.toISOString().slice(0, 10), min: d.getHours() * 60 + d.getMinutes() }; } }
function addDays(ds, n) { var d = new Date(ds + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dow(ds) { return new Date(ds + 'T00:00:00Z').getUTCDay(); }
function dlabel(ds) { return new Date(ds + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
function money(n) { var v = Math.round(n * 100) / 100; return (S.venue.currency || '$') + v.toLocaleString('en-GB', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
function dur(m) { var x = m / 60; return (x % 1 ? x.toFixed(1) : x) + (x === 1 ? ' hour' : ' hours'); }
function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || ''); }
function httpsUrl(u) { u = String(u || '').trim(); return /^https:\/\//i.test(u) ? u : ''; }
function admin() { return location.hash === '#admin'; }
function activeRooms() { return S.rooms.filter(function (r) { return r.active !== false && r.name; }); }
function curRoom() { var rs = activeRooms().filter(function (r) { return !ui.loc || r.loc === ui.loc; }); return rs.filter(function (r) { return r.id === ui.room; })[0] || rs[0] || null; }

function slotsFor(roomId, date) {
  var r = S.rules, n = nowIn(S.venue.timezone), out = [], o = toMin(r.open), c = toMin(r.close), st = Math.max(15, +r.slot || 60), buf = +r.buffer || 0;
  var closed = r.days.indexOf(dow(date)) < 0 || date > addDays(n.date, +r.window || 90);
  var busy = S.busy.filter(function (b) { return b.r === roomId && b.d === date; });
  for (var s = o; s + st <= c; s += st) { var e = s + st, state = 'free';
    if (closed) state = 'closed';
    else if (date < n.date || (date === n.date && s < n.min + (+r.notice || 0) * 60)) state = 'past';
    else if (busy.some(function (b) { return s < toMin(b.e) + buf && e > toMin(b.s) - buf; })) state = 'busy';
    out.push({ s: s, e: e, state: state }); }
  return out;
}
function pick(i, slots) {
  if (slots[i].state !== 'free') return; var a = ui.sel;
  if (a && a.a === a.b && a.a === i) ui.sel = null;
  else if (a && i === a.b + 1) a.b = i; else if (a && i === a.a - 1) a.a = i; else ui.sel = { a: i, b: i };
  render();
}
function chips(list, cur, onPick, label) {
  return h('div', { class: 'chips' }, list.map(function (x) { return h('button', { type: 'button', class: 'chip', 'aria-pressed': x.id === cur ? 'true' : 'false', onclick: function () { onPick(x.id); } }, label ? label(x) : x.name); }));
}

function bookView() {
  var rooms = activeRooms();
  if (!rooms.length) return h('section', { class: 'card' }, h('h2', null, 'Booking is not open yet'), h('p', null, admin() ? 'Open the Settings tab and add your first location and room.' : 'Please check back soon.'));
  var locs = S.locations.filter(function (l) { return rooms.some(function (r) { return r.loc === l.id; }); });
  if (locs.length && !locs.some(function (l) { return l.id === ui.loc; })) ui.loc = locs[0].id;
  var room = curRoom(), slots = slotsFor(room.id, ui.date), n = nowIn(S.venue.timezone);
  var left = h('div', null,
    locs.length > 1 ? h('div', { class: 'group' }, h('h3', null, 'Location'), chips(locs, ui.loc, function (id) { ui.loc = id; ui.room = null; ui.sel = null; render(); })) : null,
    h('div', { class: 'group' }, h('h3', null, 'Room'), chips(rooms.filter(function (r) { return !ui.loc || r.loc === ui.loc; }), room.id, function (id) { ui.room = id; ui.sel = null; render(); }, function (r) { return r.name + (r.rate ? ' · ' + money(r.rate) + '/hr' : ''); })),
    h('label', null, 'Date', h('input', { type: 'date', value: ui.date, min: n.date, max: addDays(n.date, +S.rules.window || 90), onchange: function (e) { if (e.target.value) { ui.date = e.target.value; ui.sel = null; render(); } } })));
  var grid = slots.length ? h('div', { class: 'slots', role: 'group', 'aria-label': 'Times on ' + dlabel(ui.date) }, slots.map(function (sl, i) {
    var on = ui.sel && i >= ui.sel.a && i <= ui.sel.b, free = sl.state === 'free';
    return h('button', { type: 'button', class: 'slot', 'aria-pressed': on ? 'true' : 'false', disabled: !free, onclick: function () { pick(i, slots); } },
      fmt(sl.s) + '–' + fmt(sl.e), h('small', null, free ? (on ? 'Selected' : 'Free') : { busy: 'Booked', closed: 'Closed', past: 'Passed' }[sl.state])); })) : h('p', null, 'No times are set up for this room.');
  var right = h('div', null, h('h2', null, dlabel(ui.date)), grid, ui.req ? resultView() : formView(room, slots));
  return h('div', { class: 'layout' }, left, h('div', null, right));
}
function formView(room, slots) {
  if (!ui.sel) return h('p', { class: 'note' }, 'Select one or more consecutive times, then fill in your details.');
  var a = slots[ui.sel.a].s, b = slots[ui.sel.b].e, f = ui.form;
  return h('form', { class: 'card', onsubmit: function (ev) { submit(ev, room, slots); } },
    h('p', { class: 'summary' }, fmt(a) + '–' + fmt(b) + ' · ' + dur(b - a) + (room.rate ? ' · ' + money(room.rate * (b - a) / 60) : '')),
    h('label', null, 'Your name', h('input', { name: 'who', value: f.name, autocomplete: 'name', required: true })),
    h('label', null, 'Email', h('input', { name: 'email', type: 'email', value: f.email, autocomplete: 'email' })),
    h('label', null, 'Phone', h('input', { name: 'phone', type: 'tel', value: f.phone, autocomplete: 'tel' })),
    h('label', null, 'Notes (optional)', h('textarea', { name: 'notes', rows: 3, value: f.notes })),
    ui.msg ? h('p', { class: 'err', role: 'alert' }, ui.msg) : null,
    h('button', { class: 'btn primary', type: 'submit' }, 'Prepare my request'));
}
function submit(ev, room, slots) {
  ev.preventDefault(); var el = ev.target.elements;
  var d = { name: el.who.value.trim(), email: el.email.value.trim(), phone: el.phone.value.trim(), notes: el.notes.value.trim() };
  ui.form = d; ui.msg = '';
  if (!d.name) ui.msg = 'Enter your name.';
  else if (!d.email && !d.phone) ui.msg = 'Enter an email or phone number so we can reply.';
  else if (d.email && !validEmail(d.email)) ui.msg = 'That email address looks incomplete.';
  if (ui.msg) { render(); return; }
  var a = slots[ui.sel.a].s, b = slots[ui.sel.b].e, loc = S.locations.filter(function (l) { return l.id === room.loc; })[0];
  var ref = 'VB-' + ui.date.slice(2).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  var lines = ['Venue booking request ' + ref, 'Venue: ' + (S.venue.name || ''), 'Location: ' + (loc ? loc.name : ''), 'Room: ' + room.name,
    'Date: ' + dlabel(ui.date), 'Time: ' + fmt(a) + '–' + fmt(b) + ' (' + dur(b - a) + ')'];
  if (room.rate) lines.push('Estimated price: ' + money(room.rate * (b - a) / 60));
  lines.push('Name: ' + d.name, 'Email: ' + d.email, 'Phone: ' + d.phone); if (d.notes) lines.push('Notes: ' + d.notes);
  ui.req = { ref: ref, subject: 'Venue booking request ' + ref, text: lines.join('\n') }; render();
}
function resultView() {
  var q = ui.req, fu = httpsUrl(S.venue.formUrl), acts = [];
  if (fu) acts.push(h('a', { class: 'btn primary', href: fu, target: '_blank', rel: 'noopener' }, 'Open the request form'));
  if (validEmail(S.venue.email)) acts.push(h('a', { class: 'btn ' + (fu ? '' : 'primary'), href: 'mailto:' + S.venue.email + '?subject=' + encodeURIComponent(q.subject) + '&body=' + encodeURIComponent(q.text) }, 'Open email to send'));
  acts.push(h('button', { class: 'btn', type: 'button', onclick: function () { try { navigator.clipboard.writeText(q.text); document.getElementById('copied').textContent = 'Copied.'; } catch (e) { document.getElementById('copied').textContent = 'Select the text and copy it.'; } } }, 'Copy request text'), h('span', { id: 'copied', class: 'note' }));
  return h('section', { class: 'card' }, h('h2', null, 'Your request is ready'),
    h('p', null, 'It has not been sent yet. Send it with one of the options below. Your booking is confirmed once we reply.'),
    h('div', { class: 'actions' }, acts), h('textarea', { readonly: true, rows: 11, 'aria-label': 'Request text', value: q.text }),
    h('p', { class: 'note' }, 'Reference ' + q.ref), h('button', { class: 'btn', type: 'button', onclick: function () { ui.req = null; render(); } }, 'Change my request'));
}

/* ---------- settings editor (open the site address followed by #admin) ---------- */
function dirty() { ui.dirty = true; var e = document.getElementById('dirty'); if (e) e.textContent = 'Unsaved changes. Download settings.json, then upload it to Netlify.'; }
function fld(label, obj, key, type, extra) {
  var area = type === 'area', i = h(area ? 'textarea' : 'input', Object.assign({ type: area ? null : (type || 'text'), rows: area ? 3 : null, value: obj[key] == null ? '' : obj[key] }, extra || {}));
  i.addEventListener('input', function () { obj[key] = type === 'number' ? (+i.value || 0) : i.value; dirty(); });
  return h('label', null, label, i);
}
function sel(label, obj, key, opts) {
  var s = h('select', null, opts.map(function (o) { return h('option', { value: o.v, selected: String(o.v) === String(obj[key]) }, o.t); }));
  s.addEventListener('change', function () { obj[key] = s.value; dirty(); }); return h('label', null, label, s);
}
function chk(label, on, fn) { var c = h('input', { type: 'checkbox', checked: on }); c.addEventListener('change', function () { fn(c.checked); dirty(); }); return h('label', null, c, label); }
function rm(list, i) { return h('button', { class: 'btn danger', type: 'button', onclick: function () { list.splice(i, 1); dirty(); render(); } }, 'Remove'); }
function importLines(txt) {
  var ok = 0, bad = 0; S.busy = S.busy.filter(function (b) { return b.src !== 'import'; });
  txt.split(/\r?\n/).forEach(function (L) { L = L.trim(); if (!L) return; var p = L.split(/\s*[,\t]\s*/), k = String(p[0]).toLowerCase();
    var r = S.rooms.filter(function (x) { return String(x.name).toLowerCase() === k || String(x.notion || '').toLowerCase() === k; })[0];
    if (r && /^\d{4}-\d{2}-\d{2}$/.test(p[1]) && /^\d{1,2}:\d{2}$/.test(p[2]) && /^\d{1,2}:\d{2}$/.test(p[3])) { S.busy.push({ r: r.id, d: p[1], s: p[2], e: p[3], src: 'import' }); ok++; } else bad++; });
  return 'Imported ' + ok + ' time(s)' + (bad ? ', skipped ' + bad + ' line(s) that did not match a room, date or time.' : '.');
}
function settingsView() {
  var v = S.venue, r = S.rules, roomOpts = S.rooms.map(function (x) { return { v: x.id, t: x.name || '(unnamed room)' }; });
  var manual = S.busy.map(function (b, i) { return { b: b, i: i }; }).filter(function (x) { return x.b.src !== 'import'; });
  var nImp = S.busy.filter(function (b) { return b.src === 'import'; }).length, impMsg = '';
  var ta = h('textarea', { rows: 5, placeholder: 'Room name, 2026-11-20, 14:00, 17:00' }), out = h('p', { class: 'note' });
  return h('div', null,
    h('section', { class: 'card' }, h('h2', null, 'Page'), fld('Venue name', v, 'name'), fld('Intro text', v, 'intro', 'area'), fld('Send requests to (email)', v, 'email', 'email'),
      fld('Online request form link (optional, must start with https://)', v, 'formUrl', 'url'), fld('Currency label', v, 'currency'), fld('Time zone', v, 'timezone')),
    h('section', { class: 'card' }, h('h2', null, 'Hours and rules'), fld('Opens', r, 'open', 'time'), fld('Closes', r, 'close', 'time'),
      sel('Length of each time slot', r, 'slot', [30, 60, 90, 120].map(function (m) { return { v: m, t: m + ' minutes' }; })),
      fld('Gap before and after each booking (minutes)', r, 'buffer', 'number'), fld('Minimum notice (hours, 0 allows same-day)', r, 'notice', 'number'), fld('How far ahead people can book (days)', r, 'window', 'number'),
      h('div', null, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (nm, d) { return chk(nm, r.days.indexOf(d) >= 0, function (on) { r.days = r.days.filter(function (x) { return x !== d; }); if (on) r.days.push(d); }); }))),
    h('section', { class: 'card' }, h('h2', null, 'Locations'), S.locations.map(function (l, i) { return h('div', { class: 'item' }, fld('Location name', l, 'name'), rm(S.locations, i)); }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: function () { S.locations.push({ id: uid('l'), name: '' }); dirty(); render(); } }, 'Add location'))),
    h('section', { class: 'card' }, h('h2', null, 'Rooms'), S.rooms.map(function (x, i) {
      return h('div', { class: 'item' }, fld('Room name', x, 'name'), fld('Name in Notion (used when importing booked times)', x, 'notion'),
        sel('Location', x, 'loc', [{ v: '', t: '(none)' }].concat(S.locations.map(function (l) { return { v: l.id, t: l.name || '(unnamed)' }; }))),
        fld('Rate per hour', x, 'rate', 'number'), chk('Open for booking', x.active !== false, function (on) { x.active = on; }), rm(S.rooms, i)); }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: function () { S.rooms.push({ id: uid('r'), loc: S.locations[0] ? S.locations[0].id : '', name: '', notion: '', rate: 0, active: true }); dirty(); render(); } }, 'Add room'))),
    h('section', { class: 'card' }, h('h2', null, 'Booked times'), h('p', { class: 'note' }, 'These times show as Booked. Add them by hand, or paste them from Notion below.'),
      manual.map(function (x) { return h('div', { class: 'item' }, sel('Room', x.b, 'r', roomOpts), fld('Date', x.b, 'd', 'date'), fld('From', x.b, 's', 'time'), fld('To', x.b, 'e', 'time'), rm(S.busy, x.i)); }),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: function () { S.busy.push({ r: S.rooms[0] ? S.rooms[0].id : '', d: nowIn(v.timezone).date, s: '09:00', e: '10:00', src: 'manual' }); dirty(); render(); } }, 'Add a booked time')),
      h('div', { class: 'item' }, h('h3', null, 'Paste from Notion'), h('p', { class: 'note' }, 'One per line: room name, date, from, to. Pasting replaces the previously pasted times (' + nImp + ' now).'), ta,
        h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: function () { out.textContent = importLines(ta.value); dirty(); } }, 'Import times')), out)),
    h('div', { class: 'savebar' }, h('button', { class: 'btn primary', type: 'button', onclick: download }, 'Download settings.json'),
      h('span', { id: 'dirty', class: 'note' }, ui.dirty ? 'Unsaved changes. Download settings.json, then upload it to Netlify.' : 'Visitors only see changes after you upload the new file to Netlify.')));
}
function download() {
  var a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(S, null, 2) + '\n'], { type: 'application/json' })), download: 'settings.json' });
  document.body.append(a); a.click(); a.remove(); ui.dirty = false; document.getElementById('dirty').textContent = 'Downloaded. Replace settings.json in your site folder and upload it to Netlify.';
}

function render() {
  document.title = S.venue.name || 'Venue booking';
  app.replaceChildren(
    h('header', null, h('h1', null, S.venue.name || 'Venue booking'), S.venue.intro ? h('p', { class: 'intro' }, S.venue.intro) : null,
      admin() ? h('div', { class: 'tabs' }, [['book', 'Book'], ['set', 'Settings']].map(function (t) { return h('button', { type: 'button', class: 'chip', 'aria-pressed': ui.tab === t[0] ? 'true' : 'false', onclick: function () { ui.tab = t[0]; render(); } }, t[1]); })) : null),
    ui.msg && ui.tab === 'set' ? h('p', { class: 'err', role: 'alert' }, ui.msg) : null,
    ui.tab === 'set' && admin() ? settingsView() : bookView());
}
window.addEventListener('hashchange', function () { if (!admin()) ui.tab = 'book'; render(); });
window.addEventListener('beforeunload', function (e) { if (ui.dirty) { e.preventDefault(); e.returnValue = ''; } });

fetch('settings.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
  S.venue = Object.assign(S.venue, j.venue || {}); S.rules = Object.assign(S.rules, j.rules || {}); if (!Array.isArray(S.rules.days)) S.rules.days = [0,1,2,3,4,5,6];
  ['locations', 'rooms', 'busy'].forEach(function (k) { if (Array.isArray(j[k])) S[k] = j[k]; });
}).catch(function () { ui.msg = 'settings.json could not be loaded. Open the site from its Netlify address, not from the file.'; ui.tab = 'set'; })
.then(function () { ui.date = nowIn(S.venue.timezone).date; if (admin() && !S.rooms.length) ui.tab = 'set'; render(); });
})();
