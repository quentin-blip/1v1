const $ = s => document.querySelector(s), app = $('#app');
const C = ['#ff4d8d', '#35d0ff', '#ffd23f', '#5dff9b'], score = [0, 0, 0, 0];
let cleanup = () => {}, runId = 0;
const stop = () => { runId++; cleanup(); cleanup = () => {}; app.className = ''; };
const clean = v => v.replace(/[<>&"'`]/g, '').trim().slice(0, 12);
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
let names = ['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4'];
try { const n = JSON.parse(localStorage.getItem('pg-names')); if (Array.isArray(n)) names = names.map((d, i) => clean(String(n[i] ?? '')) || d); } catch {}

// --- Supabase (REST, sans bibliothèque) ---
const cfg = window.SUPABASE || {};
const api = async (path, opts = {}) => {
  if (!cfg.url || !cfg.key || cfg.url.includes('TON-PROJET')) return null;
  try {
    const r = await fetch(cfg.url + '/rest/v1/' + path, { ...opts, headers: { apikey: cfg.key, 'Content-Type': 'application/json', ...opts.headers } });
    if (!r.ok) return null;
    const t = await r.text(); return t ? JSON.parse(t) : [];
  } catch { return null; }
};
const saveMatch = (game, w) => api('matches', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ game, winner: names[w], loser: NP === 2 ? names[1 - w] : 'Les autres' }) });
const sb = () => names.slice(0, NP).map((n, i) => `<b style="color:${C[i]}">${n} ${score[i]}</b>`).join(' · ');
// Canvas net sur écrans haute densité : taille logique W×H, résolution multipliée par le ratio de l'écran
const crisp = (c, W, H) => { const r = Math.min(3, window.devicePixelRatio || 1), x = c.getContext('2d'); c.width = W * r; c.height = H * r; x.scale(r, r); return x; };
const split = (el, n = NP) => {
  let host = el;
  if (n > 2) { host = document.createElement('div'); host.className = 'zg'; el.append(host); }
  return Array.from({ length: n }, (_, i) => {
    const d = document.createElement('div');
    d.className = 'z ' + (n > 2 ? (i < 2 ? 'zr' : '') : 'z' + i);
    d.style.background = C[i] + '33'; d.style.borderColor = C[i];
    host.append(d); return d;
  });
};

// Cartes "Soon" : change SOON pour en afficher plus ou moins (0 = aucune)
const SOON = 2;
const soon = () => Array.from({ length: SOON }, (_, k) => `<button class="soon" disabled style="--i:${games.length + k}">${logo('_lock')}<b>Soon</b></button>`).join('');

// Thèmes : nom affiché, couleurs des 2 joueurs, couleur de la barre du navigateur
const THEMES = { neon: ['Néon', ['#ff4d8d', '#35d0ff', '#ffd23f', '#5dff9b'], '#1a1033'], creme: ['Crème pastel', ['#e0705a', '#3f8fbf', '#c99a1a', '#4f9a68'], '#FBF5EA'] };
let theme = 'neon';
try { const s = localStorage.getItem('pg-theme'); if (s in THEMES) theme = s; } catch {}
const applyTheme = t => {
  theme = t; document.documentElement.dataset.theme = t; THEMES[t][1].forEach((c, i) => C[i] = c);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', THEMES[t][2]);
  try { localStorage.setItem('pg-theme', t); } catch {}
};

let NP = 2, S = { snd: true, rules: true };
try { NP = Math.min(4, Math.max(2, +localStorage.getItem('pg-np') || 2)); Object.assign(S, JSON.parse(localStorage.getItem('pg-set'))); } catch {}

let ac;
const beep = (f, d = .08, t = 'sine', v = .15) => {
  if (!S.snd) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(); o.type = t; o.frequency.value = f; g.gain.setValueAtTime(v, ac.currentTime);
    o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.stop(ac.currentTime + d);
  } catch {}
};
const buzz = p => { if (S.snd) try { navigator.vibrate?.(p); } catch {} };
const jingle = win => (win ? [523, 659, 784, 1047] : [330, 262]).forEach((f, i) => setTimeout(() => beep(f, .15, 'triangle'), i * 120));

const ACH = {
  first: ['Première victoire', 'Gagne une partie'], ten: ['10 victoires', 'Cumule 10 victoires'],
  mix: ['Touche-à-tout', 'Gagne 5 jeux différents'], marathon: ['Marathonien', 'Gagne une partie en « Premier à 3 »'],
  gang: ['Chef de bande', 'Gagne une partie à 4 joueurs'], streak: ['En feu', 'Gagne 3 parties d’affilée'],
  clean: ['Sans faute', 'Gagne en plusieurs manches sans en perdre une'], tour: ['Champion', 'Gagne un tournoi']
};
let ST = {}; try { ST = JSON.parse(localStorage.getItem('pg-stats')) || {}; } catch {}
const me = n => ST[n] ||= { w: 0, s: 0, g: [], a: [] };
function record(game, win, st) {
  const out = [];
  names.slice(0, NP).forEach((n, i) => {
    const p = me(n); if (i !== win) { p.s = 0; return; }
    p.w++; p.s++; if (!p.g.includes(game)) p.g.push(game);
    const nd = NEED[game] ?? MODES[mode][1], ok = { first: 1, ten: p.w >= 10, mix: p.g.length >= 5, marathon: nd === 3, gang: NP === 4, streak: p.s >= 3, tour: game === 'Tournoi', clean: nd > 1 && st.w.every((v, k) => k === i || v === 0) };
    Object.keys(ok).forEach(k => {
      if (!ok[k] || p.a.includes(k)) return; p.a.push(k); out.push(k);
      api('achievements?on_conflict=player,key', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ player: n, key: k }) });
    });
  });
  try { localStorage.setItem('pg-stats', JSON.stringify(ST)); } catch {}
  return out.map(k => ACH[k][0]);
}
async function trophies() {
  stop();
  app.innerHTML = `<div class="bar"><button class="back" id="bk">${logo('_back', 'ic')}</button><span class="ttl">${logo('_trophy', 'sm')}Trophées</span><span></span></div><div id="g"><p>Chargement…</p></div>`;
  $('#bk').onclick = menu;
  const ps = names.slice(0, NP), have = ps.map(n => new Set(me(n).a));
  const rows = await Promise.all(ps.map(n => api(`achievements?player=eq.${encodeURIComponent(n)}&select=key`)));
  rows.forEach((r, i) => (r || []).forEach(x => have[i].add(x.key)));
  const el = $('#g'); if (!el) return;
  el.innerHTML = `<ul class="lb">${Object.entries(ACH).map(([k, [t, d]]) => `<li class="${have.some(s => s.has(k)) ? '' : 'lock'}"><span><b>${t}</b><br><small>${d}</small></span><span class="dots">${ps.map((n, i) => have[i].has(k) ? `<i style="background:${C[i]}"></i>` : '').join('')}</span></li>`).join('')}</ul>`;
}
function settings() {
  const o = document.createElement('div'); o.id = 'ov';
  const draw = () => {
    o.innerHTML = `<div class="card"><h3>Réglages</h3><small>Thème</small><div class="seg">${Object.keys(THEMES).map(k => `<button data-th="${k}" class="${k === theme ? 'sel' : ''}">${THEMES[k][0]}</button>`).join('')}</div>
    <div class="seg"><button data-s="snd" class="${S.snd ? 'sel' : ''}">Sons et vibrations : ${S.snd ? 'oui' : 'non'}</button></div>
    <div class="seg"><button data-s="rules" class="${S.rules ? 'sel' : ''}">Règles avant le jeu : ${S.rules ? 'oui' : 'non'}</button></div><button id="cl">Fermer</button></div>`;
    o.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { applyTheme(b.dataset.th); draw(); });
    o.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { S[b.dataset.s] = !S[b.dataset.s]; try { localStorage.setItem('pg-set', JSON.stringify(S)); } catch {} draw(); });
    o.querySelector('#cl').onclick = () => { o.remove(); menu(); };
  };
  draw(); app.append(o);
}

const logo = (n, s = '') => { const [c, d] = LOGOS[n]; return `<span class="lg ${s}" style="--c:${c}"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`; };
const MODES = [['Rapide', 1, 'Une seule manche'], ['Duel', 2, 'Premier à 2 manches'], ['Marathon', 3, 'Premier à 3 manches']];
const TABS = ['Tous', 'Vitesse', 'Réflexion'], CATS = [null, 'v', 'r'];
let mode = 0, tab = 0;

function menu() {
  stop(); app.className = 'menu';
  const list = games.filter(g => (g.p || 2) >= NP && (!CATS[tab] || g.tourn || LOGOS[g.n][2] === CATS[tab]));
  const rest = list.filter(g => !g.tourn), tour = list.filter(g => g.tourn);
  const card = (g, k) => `<button class="gc${g.tourn ? ' tour' : ''}" data-i="${games.indexOf(g)}" style="--i:${k};--c:${LOGOS[g.n][0]}">${logo(g.n)}<b>${g.n}</b>${g.p > 2 && !g.tourn ? '<small class="pl">2–4</small>' : ''}</button>`;
  app.innerHTML = `<header>
    <div class="brand">${logo('_app')}<h1>Party Games</h1><button class="gear" id="gs" aria-label="Réglages">${logo('_gear', 'ic')}</button></div>
    <div class="sc">${sb()}</div>
    <div class="names">${Array.from({ length: NP }, (_, i) => `<input data-n="${i}" maxlength="12" value="${names[i]}" style="border-color:${C[i]}" aria-label="Nom du joueur ${i + 1}">`).join('')}</div>
    <div class="seg">${[2, 3, 4].map(n => `<button data-p="${n}" class="${n === NP ? 'sel' : ''}">${n} joueurs</button>`).join('')}</div>
    <div class="seg">${TABS.map((t, i) => `<button data-t="${i}" class="${i === tab ? 'sel' : ''}">${t}</button>`).join('')}</div>
  </header>
  <main class="grid">${rest.map(card).join('')}${tab || NP > 2 ? '' : soon()}${tour.map(card).join('')}</main>
  <footer><button id="lb">${logo('_trophy', 'ic')} Classement</button><button id="tr">${logo('_trophy', 'ic')} Trophées</button><button id="rs">Scores à 0</button></footer>`;
  app.querySelectorAll('.gc').forEach(b => b.onclick = () => play(games[b.dataset.i]));
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = +b.dataset.t; menu(); });
  app.querySelectorAll('.names input').forEach(inp => inp.oninput = () => {
    names[inp.dataset.n] = clean(inp.value) || 'Joueur ' + (+inp.dataset.n + 1);
    try { localStorage.setItem('pg-names', JSON.stringify(names)); } catch {}
    $('header .sc').innerHTML = sb();
  });
  app.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { NP = +b.dataset.p; try { localStorage.setItem('pg-np', NP); } catch {} menu(); });
  $('#gs').onclick = settings; $('#tr').onclick = trophies;
  $('#lb').onclick = board;
  $('#rs').onclick = () => { score.fill(0); menu(); };
}

async function board() {
  stop();
  app.innerHTML = `<div class="bar"><button class="back" id="bk">${logo('_back', 'ic')}</button><span class="ttl">${logo('_trophy', 'sm')}Classement</span><span></span></div><div id="g"><p>Chargement…</p></div>`;
  $('#bk').onclick = menu;
  const rows = await api('leaderboard?select=name,wins&limit=10'), el = $('#g'); if (!el) return;
  el.innerHTML = !rows ? '<p>Classement indisponible : vérifie config.js et ta connexion.</p>'
    : rows.length ? `<ol class="lb">${rows.map((r, i) => `<li style="animation-delay:${i * 50}ms"><span><em class="rk r${i}">${i + 1}</em>${esc(r.name)}</span><b>${r.wins}</b></li>`).join('')}</ol>`
    : '<p>Aucune victoire enregistrée pour l’instant.</p>';
}

const NEED = {};
function play(g, st = { w: Array(NP).fill(0), r: 1 }, first = true) {
  stop(); const token = runId; let over = false;
  const need = g.tourn ? 1 : g.m ? (NEED[g.n] ?? MODES[mode][1]) : MODES[mode][1];
  app.innerHTML = `<div class="bar"><button class="back" id="bk">${logo('_back', 'ic')}</button><span class="ttl">${logo(g.n, 'sm')}${g.n}</span><span class="sc">${sb()}</span></div>
  ${need > 1 ? `<div class="series">Manche ${st.r} · premier à ${need} · ${st.w.map((v, i) => `<b style="color:${C[i]}">${v}</b>`).join(' – ')}</div>` : ''}
  <div id="g"></div><div id="ov" hidden></div>`;
  $('#bk').onclick = menu;
  const end = (w, info = '') => {
    if (token !== runId || over) return; over = true;
    cleanup();
    if (w >= 0) st.w[w]++;
    const win = st.w.findIndex(v => v >= need), o = $('#ov'); o.hidden = false;
    const sc2 = `<p>${st.w.join(' – ')}</p>`, inf = info ? `<small>${info}</small>` : '';
    jingle(w >= 0); buzz(w >= 0 ? [60, 40, 60] : 30);
    if (win >= 0) {
      score[win]++; saveMatch(g.n, win); const got = record(g.n, win, st); $('.bar .sc').innerHTML = sb();
      o.innerHTML = `<div class="card"><small>Victoire</small><h2 style="color:${C[win]}">${names[win]}</h2>${inf}${need > 1 ? sc2 : ''}${got.length ? `<p class="tro">Trophée débloqué : ${got.join(', ')}</p>` : ''}<button id="again">Rejouer</button><button id="mn">Menu</button></div>`;
      $('#again').onclick = () => play(g, undefined, false);
    } else {
      o.innerHTML = `<div class="card"><small>Manche ${st.r}</small><h2 style="color:${w < 0 ? 'inherit' : C[w]}">${w < 0 ? 'Égalité' : names[w]}</h2>${inf}${sc2}<button id="again">Manche suivante</button><button id="mn">Menu</button></div>`;
      $('#again').onclick = () => { st.r++; play(g, st, false); };
    }
    $('#mn').onclick = menu;
  };
  const go = () => { $('#ov').hidden = true; g.run($('#g'), end); };
  const rules = S.rules && (window.RULES || {})[g.n];
  if (first && (rules || g.m)) {
    const o = $('#ov'), cur = NEED[g.n] ?? MODES[mode][1]; o.hidden = false;
    o.innerHTML = `<div class="card">${logo(g.n)}<h3>${g.n}</h3>${rules ? `<p class="rl">${rules}</p>` : ''}${g.m ? `<small>Nombre de manches</small><div class="seg">${[1, 2, 3].map(k => `<button data-nd="${k}" class="${k === cur ? 'sel' : ''}">${['1 manche', 'Premier à 2', 'Premier à 3'][k - 1]}</button>`).join('')}</div>` : ''}<button id="go">Jouer</button></div>`;
    o.querySelectorAll('[data-nd]').forEach(b => b.onclick = () => { NEED[g.n] = +b.dataset.nd; o.querySelectorAll('[data-nd]').forEach(x => x.classList.toggle('sel', x === b)); });
    $('#go').onclick = () => g.m ? play(g, undefined, false) : go();
  } else go();
}

const games = [
  { n: 'Réflexe', p: 4, m: 1, run(el, end) {
    const z = split(el), out = new Set(); let go = false, done = false, goAt = 0;
    z.forEach(x => x.textContent = 'Attends le vert… ne tape pas trop tôt !');
    const t = setTimeout(() => { go = true; goAt = performance.now(); z.forEach((x, i) => { if (!out.has(i)) { x.style.background = '#2ecc71'; x.textContent = 'TAPE !'; } }); }, 2000 + Math.random() * 3000);
    cleanup = () => clearTimeout(t);
    z.forEach((x, i) => x.onpointerdown = () => {
      if (done || out.has(i)) return;
      if (go) { done = true; return end(i, `Temps de réaction : ${Math.round(performance.now() - goAt)} ms`); }
      out.add(i); x.textContent = 'Trop tôt !';
      if (out.size === z.length - 1) { done = true; clearTimeout(t); end(z.findIndex((_, k) => !out.has(k))); }
    });
  } },
  { n: 'Tir à la corde', run(el, end) {
    const z = split(el); let p = 50;
    const r = () => { z[0].style.flex = p; z[1].style.flex = 100 - p; }; r();
    z.forEach((x, i) => { x.textContent = 'TAPE TAPE TAPE !'; x.onpointerdown = () => { p += i ? -3 : 3; r(); if (p >= 92) end(0); else if (p <= 8) end(1); }; });
  } },
  { n: 'Calcul rapide', run(el, end) {
    const z = split(el), sc = [0, 0];
    const q = () => {
      const a = 1 + Math.random() * 12 | 0, b = 1 + Math.random() * 12 | 0, op = Math.random() < .5, r = op ? a + b : a * b, x = new Set([r]);
      while (x.size < 3) x.add(r + (Math.random() * 10 - 5 | 0));
      const o = [...x].sort(() => Math.random() - .5);
      z.forEach((e, i) => {
        e.innerHTML = `<h2>${a} ${op ? '+' : '×'} ${b} = ?</h2><div class="ch">${o.map(v => `<button>${v}</button>`).join('')}</div><small>${sc[i]}/6</small>`;
        e.querySelectorAll('button').forEach(bt => bt.onclick = () => { const w = +bt.textContent === r ? i : 1 - i; sc[w]++; if (sc[w] >= 6) return end(w); q(); });
      });
    }; q();
  } },
  { n: 'Morpion', run(el, end) {
    let t = Math.random() * 2 | 0; const b = Array(9).fill(-1), L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    el.innerHTML = '<p id="st"></p><div class="ttt"></div>';
    const g = el.querySelector('.ttt'), st = el.querySelector('#st');
    const s = () => st.innerHTML = `Au tour de <b style="color:${C[t]}">${names[t]}</b> (${t ? 'O' : 'X'})`; s();
    b.forEach((_, i) => { const c = document.createElement('button'); c.onclick = () => {
      if (b[i] >= 0) return; b[i] = t; c.textContent = t ? 'O' : 'X'; c.style.color = C[t]; c.classList.add('on');
      if (L.some(l => l.every(k => b[k] === t))) return end(t);
      if (b.every(v => v >= 0)) return end(-1);
      t = 1 - t; s();
    }; g.append(c); });
  } },
  { n: 'Mémoire', p: 4, run(el, end) {
    const E = [['#f5b301', '<path d="M24 5l5.5 12 13 1.5-9.7 8.8 2.7 12.9L24 33l-11.5 7.2 2.7-12.9L5.5 18.5l13-1.5z"/>'], ['#ef5350', '<path d="M24 41S6 30 6 17a9 9 0 0 1 18-2 9 9 0 0 1 18 2c0 13-18 24-18 24z"/>'],
      ['#7e57c2', '<path d="M34 30A16 16 0 0 1 18 8a16 16 0 1 0 16 22z"/>'], ['#66bb6a', '<path d="M8 40C8 20 20 8 40 8c0 20-12 32-32 32zM8 40L26 22"/>'],
      ['#42a5f5', '<path d="M24 6C16 18 10 24 10 31a14 14 0 0 0 28 0c0-7-6-13-14-25z"/>'], ['#ff7043', '<circle cx="24" cy="24" r="8"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4"/>']];
    const d = [...E.keys(), ...E.keys()].sort(() => Math.random() - .5);
    let t = Math.random() * NP | 0, o = [], lock = false, left = 6; const sc = names.slice(0, NP).map(() => 0);
    el.innerHTML = '<p id="st"></p><div class="mem"></div>';
    const g = el.querySelector('.mem'), st = el.querySelector('#st');
    const s = () => st.innerHTML = `${sc.map((v, i) => `<b style="color:${C[i]}">${names[i]} ${v}</b>`).join(' · ')} — tour de ${names[t]}`; s();
    d.forEach(k => { const c = document.createElement('button'); c.textContent = '?'; c.onclick = () => {
      if (lock || c.disabled || o.includes(c)) return;
      c.innerHTML = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${E[k][1]}</svg>`; c.style.color = E[k][0]; c.classList.add('flip'); o.push(c);
      if (o.length < 2) return; lock = true;
      setTimeout(() => {
        if (o[0].innerHTML === o[1].innerHTML) {
          o.forEach(x => { x.disabled = true; x.style.opacity = .4; }); sc[t]++; left--;
          if (!left) { const m = Math.max(...sc); return end(sc.filter(v => v === m).length > 1 ? -1 : sc.indexOf(m)); }
        } else { o.forEach(x => { x.textContent = '?'; x.style.color = ''; x.classList.remove('flip'); }); t = (t + 1) % sc.length; }
        o = []; lock = false; s();
      }, 800);
    }; g.append(c); });
  } },
  { n: 'Pong', run(el, end) {
    const c = document.createElement('canvas'); el.append(c);
    const W = 360, H = 600, x = crisp(c, W, H), pw = 70, p = [W / 2, W / 2], s = [0, 0]; let b, raf;
    const rs = d => b = { x: W / 2, y: H / 2, vx: 2.6 * (Math.random() < .5 ? 1 : -1), vy: d * 3.5, at: performance.now() + 3000 }; rs(Math.random() < .5 ? 1 : -1);
    c.onpointerdown = c.onpointermove = e => { const r = c.getBoundingClientRect(); p[(e.clientY - r.top) / r.height < .5 ? 0 : 1] = (e.clientX - r.left) / r.width * W; };
    const loop = () => {
      const wait = performance.now() < b.at; if (!wait) { b.x += b.vx; b.y += b.vy; } if (b.x < 7 || b.x > W - 7) b.vx *= -1;
      [0, 1].forEach(i => { const y = i ? H - 30 : 30;
        if (Math.abs(b.y - y) < 12 && Math.abs(b.x - p[i]) < pw / 2 && (i ? b.vy > 0 : b.vy < 0)) { b.vy = -Math.sign(b.vy) * Math.min(9.5, Math.abs(b.vy) * 1.08); b.vx = Math.max(-6, Math.min(6, b.vx + (b.x - p[i]) / 12)); } });
      if (b.y < 0 || b.y > H) { const w = b.y < 0 ? 1 : 0; s[w]++; if (s[w] >= 3) return end(w); rs(w ? -1 : 1); }
      x.clearRect(0, 0, W, H); x.fillStyle = getComputedStyle(document.body).color; x.beginPath(); x.arc(b.x, b.y, 7, 0, 7); x.fill();
      if (wait) {
        const L = Math.hypot(b.vx, b.vy), ux = b.vx / L, uy = b.vy / L, ex = b.x + ux * 62, ey = b.y + uy * 62;
        x.strokeStyle = x.fillStyle; x.lineWidth = 3; x.lineCap = 'round'; x.beginPath(); x.moveTo(b.x + ux * 14, b.y + uy * 14); x.lineTo(ex, ey);
        x.lineTo(ex - ux * 11 - uy * 8, ey - uy * 11 + ux * 8); x.moveTo(ex, ey); x.lineTo(ex - ux * 11 + uy * 8, ey - uy * 11 - ux * 8); x.stroke();
        x.font = '26px system-ui'; x.fillText(Math.ceil((b.at - performance.now()) / 1000), W / 2 - 7, H / 2 + 50);
      }
      [0, 1].forEach(i => { x.fillStyle = C[i]; x.fillRect(p[i] - pw / 2, (i ? H - 30 : 30) - 4, pw, 8); x.font = '28px system-ui'; x.fillText(s[i], 14, i ? H / 2 + 36 : H / 2 - 12); });
      raf = requestAnimationFrame(loop);
    };
    cleanup = () => cancelAnimationFrame(raf); loop();
  } },
  { n: 'Puissance 4', run(el, end) {
    const R = 6, K = 7, b = Array.from({ length: K }, () => []); let t = Math.random() * 2 | 0, over = false;
    el.innerHTML = '<p id="st"></p><div class="c4"></div>';
    const g = el.querySelector('.c4'), st = el.querySelector('#st');
    const s = () => st.innerHTML = `Au tour de <b style="color:${C[t]}">${names[t]}</b>`; s();
    for (let r = 0; r < R; r++) for (let k = 0; k < K; k++) { const h = document.createElement('div'); h.dataset.k = k; h.innerHTML = '<i></i>'; g.append(h); }
    const fin = w => { over = true; const id = setTimeout(() => end(w), 550); cleanup = () => clearTimeout(id); };
    g.onclick = e => {
      const h = e.target.closest('[data-k]'); if (!h || over) return;
      const k = +h.dataset.k, col = b[k]; if (col.length >= R) return;
      const r = R - 1 - col.length, i = g.children[r * K + k].firstChild;
      i.style.background = C[t]; i.style.setProperty('--d', r + 1); i.classList.add('drop'); col.push(t);
      const y = col.length - 1, at = (x, z) => b[x]?.[z];
      const win = [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dy]) => {
        let n = 1;
        for (const m of [1, -1]) { let x = k + dx * m, z = y + dy * m; while (at(x, z) === t) { n++; x += dx * m; z += dy * m; } }
        return n >= 4;
      });
      if (win) return fin(t);
      if (b.every(c => c.length >= R)) return fin(-1);
      t = 1 - t; s();
    };
  } },
  { n: 'Cibles', p: 4, run(el, end) {
    const z = split(el), sc = z.map(() => 0), ids = [];
    z.forEach((e, i) => {
      e.style.position = 'relative';
      const t = document.createElement('button'), sm = document.createElement('small'); t.className = 'tg'; t.innerHTML = '<i></i>'; sm.className = 'pt';
      const mv = () => { t.style.left = 20 + Math.random() * 60 + '%'; t.style.top = 30 + Math.random() * 42 + '%'; };
      const tick = () => { mv(); ids[i] = setTimeout(tick, Math.max(450, 1200 - sc[i] * 70)); };
      const u = () => { sm.textContent = sc[i] + '/10'; t.firstChild.style.width = t.firstChild.style.height = Math.max(30, 52 - sc[i] * 2.5) + 'px'; };
      t.onpointerdown = () => { sc[i]++; u(); if (sc[i] >= 10) return end(i); clearTimeout(ids[i]); tick(); };
      u(); tick(); e.append(sm, t);
    });
    cleanup = () => ids.forEach(clearTimeout);
  } },
  { n: 'Chifoumi', m: 1, run(el, end) {
    const z = split(el), O = ['Pierre', 'Feuille', 'Ciseaux'], pick = [-1, -1];
    z.forEach((e, i) => {
      e.innerHTML = `<small>${names[i]}, choisis</small><div class="ch w">${O.map((o, k) => `<button data-k="${k}">${o}</button>`).join('')}</div>`;
      e.querySelectorAll('button').forEach(b => b.onclick = () => {
        if (pick[i] >= 0) return; pick[i] = +b.dataset.k; e.innerHTML = '<h2>Choix verrouillé</h2>';
        if (pick[0] < 0 || pick[1] < 0) return;
        z.forEach((x, j) => x.innerHTML = `<h2>${O[pick[j]]}</h2>`);
        const d = (pick[0] - pick[1] + 3) % 3, id = setTimeout(() => end(d === 0 ? -1 : d === 1 ? 0 : 1), 1300);
        cleanup = () => clearTimeout(id);
      });
    });
  } },
  { n: 'Chrono', p: 4, m: 1, run(el, end) {
    const z = split(el), T = 3 + (Math.random() * 7 | 0), t0 = performance.now(), res = z.map(() => null); let raf;
    const lock = i => {
      if (res[i] !== null) return;
      res[i] = (performance.now() - t0) / 1000; z[i].style.background = '#2ecc7155'; z[i].querySelector('h1').textContent = '•••'; z[i].querySelector('b').textContent = 'Choix verrouillé';
      if (res.some(v => v === null)) return;
      cancelAnimationFrame(raf); const d = res.map(v => Math.abs(v - T));
      z.forEach((q, j) => { q.querySelector('h1').textContent = res[j].toFixed(2); q.querySelector('b').textContent = `Écart ${d[j].toFixed(2)} s`; });
      const m = Math.min(...d), id = setTimeout(() => end(d.filter(v => v - m < .005).length > 1 ? -1 : d.indexOf(m), `Temps à atteindre : ${T} s`), 2300);
      cleanup = () => clearTimeout(id);
    };
    z.forEach((x, i) => { x.innerHTML = `<small>Stoppe à ${T} secondes pile</small><h1>0.00</h1><b>TAPE POUR STOPPER</b>`; x.onpointerdown = () => lock(i); });
    const loop = () => {
      if (res.every(v => v !== null)) return;
      const s = (performance.now() - t0) / 1000;
      z.forEach((x, i) => { if (res[i] === null) x.querySelector('h1').textContent = s < 1.5 ? s.toFixed(2) : '?.??'; });
      if (s > T + 8) z.forEach((_, i) => lock(i));
      raf = requestAnimationFrame(loop);
    };
    cleanup = () => cancelAnimationFrame(raf); loop();
  } },
  { n: 'Allumettes', run(el, end) {
    let n = 15, t = Math.random() * 2 | 0;
    el.innerHTML = '<p id="st"></p><div class="mt"></div><div class="ch"></div>';
    const st = el.querySelector('#st'), m = el.querySelector('.mt'), b = el.querySelector('.ch');
    const draw = () => { st.innerHTML = `<b style="color:${C[t]}">${names[t]}</b> prend 1, 2 ou 3 allumettes<br><small>Celui qui prend la dernière perd</small>`; m.innerHTML = '<i></i>'.repeat(n); [...b.children].forEach(x => x.disabled = +x.textContent > n); };
    [1, 2, 3].forEach(k => { const x = document.createElement('button'); x.textContent = k; x.onclick = () => { if (k > n) return; n -= k; if (n === 0) return end(1 - t); t = 1 - t; draw(); }; b.append(x); });
    draw();
  } },
  { n: 'Simon', run(el, end) {
    const K = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28'], seq = []; let t = Math.random() * 2 | 0, pos = 0, busy = false, off = false;
    el.innerHTML = '<p id="st"></p><div class="sm"></div>';
    const st = el.querySelector('#st'), g = el.querySelector('.sm'), wait = ms => new Promise(r => setTimeout(r, ms));
    const pads = K.map((c, k) => { const p = document.createElement('button'); p.style.background = c; p.onclick = () => press(k); g.append(p); return p; });
    const flash = k => { pads[k].classList.add('lit'); setTimeout(() => pads[k].classList.remove('lit'), 300); };
    const turn = () => st.innerHTML = `<b style="color:${C[t]}">${names[t]}</b> : ${seq.length ? `répète les ${seq.length}, puis ajoutes-en une` : 'choisis la première couleur'}`;
    const show = async () => {
      busy = true; st.textContent = 'Regarde…';
      for (const k of seq) { await wait(550); if (off) return; flash(k); }
      await wait(600); if (off) return; busy = false; pos = 0; turn();
    };
    const press = k => {
      if (busy) return; flash(k);
      if (pos < seq.length) { if (k !== seq[pos]) { busy = true; return setTimeout(() => end(1 - t), 500); } pos++; }
      else { seq.push(k); t = 1 - t; show(); }
    };
    cleanup = () => { off = true; }; turn();
  } },
  { n: 'Cochon', p: 4, run(el, end) {
    const P = names.slice(0, NP).map(() => 0); let t = Math.random() * NP | 0, cur = 0;
    el.innerHTML = '<p id="st"></p><div class="die">·</div><div class="ch w"><button id="ro">Lancer</button><button id="hd">Garder</button></div>';
    const st = el.querySelector('#st'), die = el.querySelector('.die');
    const draw = (m = '') => st.innerHTML = `${P.map((v, i) => `<b style="color:${C[i]}">${names[i]} ${v}</b>`).join(' · ')}<br>Tour de <b style="color:${C[t]}">${names[t]}</b> · en jeu : ${cur}<br><small>${m || 'Premier à 50. Un 1 fait tout perdre.'}</small>`;
    el.querySelector('#ro').onclick = () => {
      const d = 1 + Math.random() * 6 | 0; die.textContent = d; die.classList.remove('on'); void die.offsetWidth; die.classList.add('on');
      if (d === 1) { cur = 0; t = (t + 1) % P.length; draw('Un 1 ! Tour perdu.'); } else { cur += d; draw(); }
    };
    el.querySelector('#hd').onclick = () => { P[t] += cur; if (P[t] >= 50) return end(t); cur = 0; t = (t + 1) % P.length; die.textContent = '·'; draw(); };
    draw();
  } },
  { n: 'Couleurs', run(el, end) {
    const z = split(el), sc = [0, 0], N = [['ROUGE', '#ef5350'], ['BLEU', '#42a5f5'], ['VERT', '#66bb6a'], ['JAUNE', '#ffca28']];
    const q = () => {
      const w = N[Math.random() * 4 | 0]; let ink; do ink = N[Math.random() * 4 | 0]; while (ink === w);
      z.forEach((e, i) => {
        const o = [...N].sort(() => Math.random() - .5);
        e.innerHTML = `<small>Touche la couleur de l’encre</small><h1 style="color:${ink[1]}">${w[0]}</h1><div class="ch">${o.map(c => `<button data-c="${c[1]}" style="background:${c[1]};height:56px"></button>`).join('')}</div><small>${sc[i]}/7</small>`;
        e.querySelectorAll('button').forEach(b => b.onclick = () => { const r = b.dataset.c === ink[1] ? i : 1 - i; sc[r]++; if (sc[r] >= 7) return end(r); q(); });
      });
    }; q();
  } },
  { n: 'Ordre', p: 4, m: 1, run(el, end) {
    const z = split(el), nx = z.map(() => 1), N = 12;
    z.forEach((e, i) => {
      e.innerHTML = `<small>Touche de 1 à ${N} dans l’ordre</small><div class="nm"></div>`;
      const g = e.querySelector('.nm');
      Array.from({ length: N }, (_, k) => k + 1).sort(() => Math.random() - .5).forEach(n => {
        const b = document.createElement('button'); b.textContent = n;
        b.onpointerdown = () => {
          if (g.classList.contains('frz')) return;
          if (n !== nx[i]) { g.classList.add('frz'); setTimeout(() => g.classList.remove('frz'), 1000); return; }
          b.disabled = true; b.style.opacity = .25; if (++nx[i] > N) end(i);
        };
        g.append(b);
      });
    });
  } },
  { n: 'Nuances', run(el, end) {
    const z = split(el), sc = [0, 0];
    const q = () => {
      const h = Math.random() * 360 | 0, d = Math.max(3, 10 - Math.max(...sc) * 1.5);
      z.forEach((e, i) => {
        const odd = Math.random() * 16 | 0;
        e.innerHTML = `<small>Touche la case différente · ${sc[i]}/5</small><div class="nu">${Array.from({ length: 16 }, (_, k) => `<button data-o="${k === odd ? 1 : 0}" style="background:hsl(${h} 70% ${k === odd ? 55 + d : 55}%)"></button>`).join('')}</div>`;
        e.querySelectorAll('button').forEach(b => b.onclick = () => { const r = b.dataset.o === '1' ? i : 1 - i; sc[r]++; if (sc[r] >= 5) return end(r); q(); });
      });
    }; q();
  } },
  { n: 'Bombe', p: 4, m: 1, run(el, end) {
    const z = split(el), alive = z.map((_, i) => i); let h, done = false, t1, t2, iv;
    const BOMB = '<svg class="bsvg" viewBox="0 0 48 48"><circle cx="22" cy="28" r="14" fill="currentColor"/><path d="M31 15l5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/><circle class="spark" cx="38" cy="8" r="3.5" fill="#ffb300"/></svg>';
    const draw = () => z.forEach((x, i) => {
      x.classList.toggle('hot', i === h && alive.includes(i)); x.classList.toggle('dead', !alive.includes(i));
      x.innerHTML = !alive.includes(i) ? '<h2>Éliminé</h2>' : i === h ? `<div class="bomb">${BOMB}</div><h2>PASSE !</h2>` : '<h2>Attends…</h2>';
    });
    const round = () => {
      done = false; h = alive[Math.random() * alive.length | 0]; draw();
      const st = performance.now(), T = 3500 + Math.random() * 7000;
      iv = setInterval(() => { const f = Math.min(1, (performance.now() - st) / T); z.forEach(x => x.style.setProperty('--p', (.8 - .62 * f).toFixed(2) + 's')); }, 120);
      t1 = setTimeout(() => {
        clearInterval(iv); done = true; beep(90, .5, 'sawtooth', .3); buzz(200);
        z[h].classList.remove('hot'); z[h].classList.add('boom'); z[h].innerHTML = '<h1>BOOM !</h1>';
        el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 500);
        alive.splice(alive.indexOf(h), 1);
        t2 = setTimeout(() => { z[h].classList.remove('boom'); alive.length === 1 ? end(alive[0]) : round(); }, 1500);
      }, T);
    };
    z.forEach((x, i) => x.onpointerdown = () => { if (done || i !== h) return; h = alive[(alive.indexOf(h) + 1) % alive.length]; beep(660, .06, 'triangle', .1); draw(); });
    cleanup = () => { clearTimeout(t1); clearTimeout(t2); clearInterval(iv); }; round();
  } },
  { n: 'Sprint', p: 4, m: 1, run(el, end) {
    const z = split(el), p = z.map(() => 0);
    z.forEach((x, i) => {
      x.innerHTML = '<small>Tape le plus vite !</small><div class="bar2"><i></i></div>';
      x.onpointerdown = () => { p[i]++; x.querySelector('i').style.width = p[i] * 100 / 40 + '%'; if (p[i] >= 40) end(i); };
    });
  } },
  { n: 'Taupes', p: 4, run(el, end) {
    const z = split(el), sc = z.map(() => 0), ids = [];
    z.forEach((x, i) => {
      x.innerHTML = '<small>0/10</small><div class="tp">' + '<button></button>'.repeat(6) + '</div>';
      const b = [...x.querySelectorAll('.tp button')], sm = x.querySelector('small'); let cur = -1;
      const pop = () => { b.forEach(e => e.classList.remove('up')); cur = Math.random() * 6 | 0; b[cur].classList.add('up'); };
      b.forEach((e, k) => e.onpointerdown = ev => { ev.stopPropagation(); if (k !== cur) return; cur = -1; e.classList.remove('up'); sc[i]++; sm.textContent = sc[i] + '/10'; if (sc[i] >= 10) end(i); });
      pop(); ids.push(setInterval(pop, 800));
    });
    cleanup = () => ids.forEach(clearInterval);
  } },
  { n: 'Tour', p: 4, m: 1, run(el, end) {
    const W = 360, H = 520, h = 26, G = .25, c = document.createElement('canvas'), btn = document.createElement('button');
    c.className = 'course'; btn.className = 'big'; el.append(c, btn);
    const x = crisp(c, W, H), ink = getComputedStyle(document.body).color, alive = names.slice(0, NP).map((_, i) => i);
    let bl = [], t = alive[Math.random() * alive.length | 0], cur, fall = null, drop = null, st = 'hover', cam = 0, hx = W / 2, hd = 1, T = 0, loser = -1, tm, raf, last = performance.now();
    const sy = y => H - 40 - y + cam;
    const newBlock = () => { cur = { w: 56 + (Math.random() * 54 | 0) }; st = 'hover'; btn.disabled = false; btn.textContent = names[t] + ' : lâcher !'; btn.style.background = C[t]; btn.style.color = '#111'; };
    const rect = (xc, yc, w, col) => { x.fillStyle = col; x.fillRect(xc - w / 2, yc - h / 2, w, h); x.strokeStyle = ink; x.globalAlpha = .45; x.lineWidth = 2; x.strokeRect(xc - w / 2, yc - h / 2, w, h); x.globalAlpha = 1; };
    const box = (cx, cy, w, ang, col) => { x.save(); x.translate(cx, sy(cy)); x.rotate(ang); rect(0, 0, w, col); x.restore(); };
    const span = k => ({ L: Math.max(bl[k].cx - bl[k].w / 2, bl[k - 1].cx - bl[k - 1].w / 2), R: Math.min(bl[k].cx + bl[k].w / 2, bl[k - 1].cx + bl[k - 1].w / 2) });
    const com = k => { let M = 0, X = 0; for (let j = k; j < bl.length; j++) { M += bl[j].w; X += bl[j].w * bl[j].cx; } return X / M; };
    const check = () => { for (let k = 1; k < bl.length; k++) { const { L, R } = span(k), cm = com(k); if (cm < L || cm > R) return { k, L, R, cm }; } return null; };
    const margin = () => { let m = 99; for (let k = 1; k < bl.length; k++) { const { L, R } = span(k), cm = com(k); m = Math.min(m, cm - L, R - cm); } return m; };
    const startFall = b => {
      const s = b.cm > b.R ? 1 : -1, px = s > 0 ? b.R : b.L, py = b.k * h;
      const grp = bl.slice(b.k).map(q => ({ ...q, rx: q.cx - px, ry: (q.lv + .5) * h - py }));
      const M = grp.reduce((a, q) => a + q.w, 0), I = grp.reduce((a, q) => a + q.w * ((q.w * q.w + h * h) / 12 + q.rx * q.rx + q.ry * q.ry), 0);
      fall = { grp, px, py, s, M, I, dx: Math.abs(b.cm - px), dy: grp.reduce((a, q) => a + q.w * q.ry, 0) / M, th: .02, om: 0, free: false, n: 0 };
      bl.length = b.k; loser = t; st = 'fall'; btn.disabled = true; beep(100, .4, 'sawtooth', .3); buzz(150);
    };
    const finish = () => {
      st = 'pause'; const k = alive.indexOf(loser); alive.splice(k, 1);
      tm = setTimeout(() => { if (alive.length === 1) return end(alive[0]); bl = []; fall = null; cam = 0; t = alive[k % alive.length]; newBlock(); }, 1500);
    };
    btn.onclick = () => {
      if (st !== 'hover') return;
      const tp = bl[bl.length - 1], ov = !tp || Math.min(hx + cur.w / 2, tp.cx + tp.w / 2) - Math.max(hx - cur.w / 2, tp.cx - tp.w / 2) > 2;
      const hy = bl.length * h + 170;
      if (!ov) { fall = { free: true, n: 0, parts: [{ cx: hx, cy: hy, w: cur.w, ang: 0, vx: 0, vy: 0, om: (Math.random() - .5) * .1, col: C[t] }] }; loser = t; st = 'fall'; btn.disabled = true; beep(100, .4, 'sawtooth', .3); buzz(150); return; }
      drop = { y: hy, vy: 0, cx: hx, w: cur.w }; st = 'drop'; btn.disabled = true;
    };
    const loop = now => {
      const dt = Math.min(2.5, (now - last) / 16.67); last = now; T += dt;
      cam += (Math.max(0, bl.length * h - 230) - cam) * .08 * dt;
      if (st === 'hover') { hx += hd * (2.2 + bl.length * .18) * dt; const m = cur.w / 2 + 6; if (hx > W - m) { hx = W - m; hd = -1; } if (hx < m) { hx = m; hd = 1; } }
      if (st === 'drop') {
        drop.vy += .6 * dt; drop.y -= drop.vy * dt;
        if (drop.y - h / 2 <= bl.length * h) {
          bl.push({ cx: drop.cx, w: drop.w, lv: bl.length, col: C[t] }); drop = null; beep(220, .08, 'square', .12); buzz(15);
          const bad = check();
          if (bad) startFall(bad); else { t = alive[(alive.indexOf(t) + 1) % alive.length]; newBlock(); }
        }
      }
      if (fall) {
        const f = fall;
        if (!f.free) {
          f.om += G * f.M * (f.dx * Math.cos(f.th) + f.dy * Math.sin(f.th)) / f.I * dt; f.th += f.om * dt;
          if (f.th > .75) {
            const co = Math.cos(f.th), si = Math.sin(f.th);
            f.parts = f.grp.map(q => { const ux = q.rx * f.s, X = ux * co + q.ry * si, Y = -ux * si + q.ry * co; return { cx: f.px + f.s * X, cy: f.py + Y, w: q.w, ang: f.s * f.th, vx: f.s * f.om * Y, vy: -f.om * X, om: f.s * f.om, col: q.col }; });
            f.free = true;
          }
        } else {
          f.parts.forEach(p => {
            p.vy -= G * dt; p.cx += p.vx * dt; p.cy += p.vy * dt; p.ang += p.om * dt;
            const hh = Math.abs(Math.sin(p.ang)) * p.w / 2 + Math.abs(Math.cos(p.ang)) * h / 2;
            if (p.cy < hh) { p.cy = hh; p.vy = p.vy < -1 ? p.vy * -.25 : 0; p.vx *= .85; p.om *= .85; }
          });
          f.n += dt; if (f.n > 110 && st === 'fall') finish();
        }
      }
      x.clearRect(0, 0, W, H); x.globalAlpha = .25; x.fillStyle = ink; x.fillRect(0, sy(0), W, H); x.globalAlpha = 1;
      const A = Math.max(0, 16 - margin()) * .45 * Math.sin(T * .12);
      bl.forEach(b => { x.save(); rect(b.cx + A * b.lv / Math.max(1, bl.length), sy((b.lv + .5) * h), b.w, b.col); x.restore(); });
      if (st === 'hover') {
        const hy = bl.length * h + 170; x.globalAlpha = .35; x.strokeStyle = ink; x.setLineDash([4, 6]); x.beginPath(); x.moveTo(hx, sy(hy - h / 2)); x.lineTo(hx, sy(bl.length * h)); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
        rect(hx, sy(hy), cur.w, C[t]);
      }
      if (drop) rect(drop.cx, sy(drop.y), drop.w, C[t]);
      if (fall) {
        if (fall.free) fall.parts.forEach(p => box(p.cx, p.cy, p.w, p.ang, p.col));
        else { x.save(); x.translate(fall.px, sy(fall.py)); x.rotate(fall.s * fall.th); fall.grp.forEach(q => rect(q.rx, -q.ry, q.w, q.col)); x.restore(); }
      }
      x.font = 'bold 17px system-ui'; x.fillStyle = C[t]; x.fillText(names[t], 12, 26); x.fillStyle = ink; x.textAlign = 'right'; x.fillText('Hauteur : ' + bl.length, W - 12, 26); x.textAlign = 'left';
      if (st === 'pause') { x.font = 'bold 22px system-ui'; x.textAlign = 'center'; x.fillStyle = C[loser]; x.fillText(names[loser] + ' fait tomber la tour !', W / 2, H / 2 - 40, W - 40); x.textAlign = 'left'; }
      raf = requestAnimationFrame(loop);
    };
    cleanup = () => { cancelAnimationFrame(raf); clearTimeout(tm); }; newBlock(); raf = requestAnimationFrame(loop);
  } },
  { n: 'Ballon', p: 4, run(el, end) {
    const z = split(el), alive = z.map((_, i) => i); let t = alive[Math.random() * alive.length | 0], cnt = 0, pm = 0, busy = false, tm; let lim = 5 + (Math.random() * 14 | 0);
    const draw = () => z.forEach((x, i) => {
      x.classList.toggle('hot', i === t && alive.includes(i)); x.classList.toggle('dead', !alive.includes(i));
      if (!alive.includes(i)) return x.innerHTML = '<h2>Éliminé</h2>';
      const b = `<div class="bln" style="--s:${Math.min(1.9, 1 + cnt * .07)}"></div>`;
      x.innerHTML = i === t ? `${b}<div class="ch"><button data-a="p">Pomper</button><button data-a="s" ${pm ? '' : 'disabled'}>Passer</button></div>` : `${b}<small>Attends…</small>`;
      x.querySelectorAll('button').forEach(bt => bt.onclick = () => act(bt.dataset.a));
    });
    const next = () => { t = alive[(alive.indexOf(t) + 1) % alive.length]; pm = 0; draw(); };
    const act = a => {
      if (busy) return; if (a === 's') return next();
      pm++; cnt++;
      if (cnt >= lim) {
        busy = true; const k = alive.indexOf(t); z[t].classList.remove('hot'); z[t].innerHTML = '<h1>POP !</h1>'; beep(120, .3, 'sawtooth', .3); buzz(150); alive.splice(k, 1);
        tm = setTimeout(() => { if (alive.length === 1) return end(alive[0]); busy = false; cnt = 0; pm = 0; lim = 5 + (Math.random() * 14 | 0); t = alive[k % alive.length]; draw(); }, 1300); return;
      }
      if (pm >= 3) return next(); draw();
    };
    cleanup = () => clearTimeout(tm); draw();
  } },
  { n: 'Feu rouge', p: 4, run(el, end) {
    const z = split(el), sc = z.map(() => 0), fault = new Set(); let state = 'wait', tm;
    const ui = () => z.forEach((x, i) => x.querySelector('small').textContent = sc[i] + '/5');
    const msg = (t, bg) => z.forEach((x, i) => { x.querySelector('h1').textContent = t; x.style.background = bg || C[i] + '33'; });
    const after = (ms, f) => { clearTimeout(tm); tm = setTimeout(f, ms); };
    const round = () => { state = 'wait'; fault.clear(); msg('Prépare-toi…'); ui(); after(1500 + Math.random() * 2500, signal); };
    const signal = () => {
      const g = Math.random() < .6; state = g ? 'go' : 'stop'; fault.clear(); msg(g ? 'TOUCHE !' : 'NE TOUCHE PAS !', g ? '#2ecc71' : '#e74c3c');
      after(g ? 1800 : 1600, () => { state = 'wait'; msg(g ? 'Trop lent' : 'Bien retenu'); after(900, round); });
    };
    const tap = i => {
      if (state === 'go') { state = 'done'; sc[i]++; msg(names[i] + ' +1'); ui(); if (sc[i] >= 5) return end(i); after(1000, round); }
      else if ((state === 'stop' || state === 'wait') && !fault.has(i)) { fault.add(i); sc[i] = Math.max(0, sc[i] - 1); ui(); z[i].querySelector('small').textContent = sc[i] + '/5 · faute !'; buzz(80); }
    };
    z.forEach((x, i) => { x.innerHTML = '<small></small><h1></h1>'; x.onpointerdown = () => tap(i); });
    cleanup = () => clearTimeout(tm); round();
  } },
  { n: 'Tournoi', p: 4, tourn: true, run(el, end) {
    const pool = games.filter(g => !g.tourn && (g.p || 2) >= NP).sort(() => Math.random() - .5).slice(0, 5), pts = names.slice(0, NP).map(() => 0); let r = 0;
    const board = () => pts.map((v, i) => `<b style="color:${C[i]}">${names[i]} ${v}</b>`).join(' · ');
    const reset = () => { cleanup(); cleanup = () => {}; };
    const intro = () => {
      reset(); const g = pool[r];
      el.innerHTML = `<div class="tcard">${logo(g.n)}<small>Manche ${r + 1} sur 5</small><h3>${g.n}</h3><p class="rl">${(window.RULES || {})[g.n] || ''}</p><p>${board()}</p><button id="tg">Go !</button></div>`;
      el.querySelector('#tg').onclick = () => { let f = false; el.innerHTML = ''; g.run(el, (w, info) => { if (f) return; f = true; done(w, info); }); };
    };
    const done = (w, info = '') => {
      reset(); jingle(w >= 0); if (w >= 0) pts[w]++; r++;
      if (r >= 5) { const m = Math.max(...pts); return end(pts.filter(v => v === m).length > 1 ? -1 : pts.indexOf(m), `Points : ${board()}`); }
      el.innerHTML = `<div class="tcard"><small>Manche ${r} terminée</small><h3>${w < 0 ? 'Égalité' : names[w] + ' marque 1 point'}</h3>${info ? `<small>${info}</small>` : ''}<p>${board()}</p><button id="nx">Manche suivante</button></div>`;
      el.querySelector('#nx').onclick = intro;
    };
    intro();
  } }
];

let lastB = 0;
document.addEventListener('pointerdown', e => { const n = Date.now(); if (n - lastB > 70 && e.target.closest('button, .z, canvas')) { lastB = n; beep(520, .04, 'square', .05); buzz(8); } });
document.addEventListener('contextmenu', e => e.preventDefault());
applyTheme(theme);
menu();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
