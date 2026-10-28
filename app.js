const $ = s => document.querySelector(s), app = $('#app');
const C = ['#ff4d8d', '#35d0ff'], score = [0, 0];
let cleanup = () => {};
const clean = v => v.replace(/[<>&"'`]/g, '').trim().slice(0, 12);
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
let names = ['Joueur 1', 'Joueur 2'];
try { const n = JSON.parse(localStorage.getItem('pg-names')); if (Array.isArray(n)) names = n.map((x, i) => clean(String(x)) || names[i]); } catch {}

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
const saveMatch = (game, w) => api('matches', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ game, winner: names[w], loser: names[1 - w] }) });
const sb = () => `<b style="color:${C[0]}">${names[0]} ${score[0]}</b> · <b style="color:${C[1]}">${names[1]} ${score[1]}</b>`;
const split = el => [0, 1].map(i => {
  const d = document.createElement('div');
  d.className = 'z z' + i; d.style.background = C[i] + '33'; d.style.borderColor = C[i];
  el.append(d); return d;
});

// Cartes "Soon" : change SOON pour en afficher plus ou moins (0 = aucune)
const SOON = 2;
const soon = () => Array.from({ length: SOON }, (_, k) => `<button class="soon" disabled style="--i:${games.length + k}"><span>🔒</span>Soon</button>`).join('');

function menu() {
  cleanup(); cleanup = () => {};
  app.innerHTML = `<header><h1>🎮 Party Games</h1><div class="sc">${sb()}</div>
  <div class="names">${[0, 1].map(i => `<input data-n="${i}" maxlength="12" value="${names[i]}" style="border-color:${C[i]}" aria-label="Nom du joueur ${i + 1}">`).join('')}</div></header>
  <main class="grid">${games.map((g, i) => `<button data-i="${i}" style="--i:${i}"><span>${g.e}</span>${g.n}</button>`).join('')}${soon()}</main>
  <footer><button id="lb">🏆 Classement</button><button id="rs">Remettre les scores à 0</button></footer>`;
  app.querySelectorAll('.grid button:not(.soon)').forEach(b => b.onclick = () => play(games[b.dataset.i]));
  app.querySelectorAll('.names input').forEach(inp => inp.oninput = () => {
    names[inp.dataset.n] = clean(inp.value) || 'Joueur ' + (+inp.dataset.n + 1);
    try { localStorage.setItem('pg-names', JSON.stringify(names)); } catch {}
    $('header .sc').innerHTML = sb();
  });
  $('#lb').onclick = board;
  $('#rs').onclick = () => { score[0] = score[1] = 0; menu(); };
}

async function board() {
  cleanup(); cleanup = () => {};
  app.innerHTML = `<div class="bar"><button id="bk">←</button><span>🏆 Classement</span><span></span></div><div id="g"><p>Chargement…</p></div>`;
  $('#bk').onclick = menu;
  const rows = await api('leaderboard?select=name,wins&limit=10'), el = $('#g'); if (!el) return;
  el.innerHTML = !rows ? '<p>Classement indisponible : vérifie config.js et ta connexion.</p>'
    : rows.length ? `<ol class="lb">${rows.map((r, i) => `<li style="animation-delay:${i * 50}ms"><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${esc(r.name)}</span><b>${r.wins}</b></li>`).join('')}</ol>`
    : '<p>Aucune victoire enregistrée pour l’instant.</p>';
}

function play(g) {
  cleanup(); cleanup = () => {};
  app.innerHTML = `<div class="bar"><button id="bk">←</button><span>${g.e} ${g.n}</span><span class="sc">${sb()}</span></div><div id="g"></div><div id="ov" hidden></div>`;
  $('#bk').onclick = menu;
  const end = w => {
    cleanup();
    if (w >= 0) { score[w]++; saveMatch(g.n, w); }
    $('.bar .sc').innerHTML = sb();
    const o = $('#ov'); o.hidden = false;
    o.innerHTML = `<h2>${w < 0 ? 'Égalité !' : `<span style="color:${C[w]}">${names[w]}</span> gagne !`}</h2><button id="again">Rejouer</button><button id="mn">Menu</button>`;
    $('#again').onclick = () => play(g); $('#mn').onclick = menu;
  };
  g.run($('#g'), end);
}

const games = [
  { n: 'Réflexe', e: '⚡', run(el, end) {
    const z = split(el); let go = false, done = false;
    z.forEach(x => x.textContent = 'Attends le vert… ne tape pas trop tôt !');
    const t = setTimeout(() => { go = true; z.forEach(x => { x.style.background = '#2ecc71'; x.textContent = 'TAPE !'; }); }, 2000 + Math.random() * 3000);
    cleanup = () => clearTimeout(t);
    z.forEach((x, i) => x.onpointerdown = () => { if (done) return; done = true; clearTimeout(t); end(go ? i : 1 - i); });
  } },
  { n: 'Tir à la corde', e: '🪢', run(el, end) {
    const z = split(el); let p = 50;
    const r = () => { z[0].style.flex = p; z[1].style.flex = 100 - p; }; r();
    z.forEach((x, i) => { x.textContent = 'TAPE TAPE TAPE !'; x.onpointerdown = () => { p += i ? -3 : 3; r(); if (p >= 92) end(0); else if (p <= 8) end(1); }; });
  } },
  { n: 'Calcul rapide', e: '🧮', run(el, end) {
    const z = split(el), sc = [0, 0];
    const q = () => {
      const a = 1 + Math.random() * 12 | 0, b = 1 + Math.random() * 12 | 0, op = Math.random() < .5, r = op ? a + b : a * b, x = new Set([r]);
      while (x.size < 3) x.add(r + (Math.random() * 10 - 5 | 0));
      const o = [...x].sort(() => Math.random() - .5);
      z.forEach((e, i) => {
        e.innerHTML = `<h2>${a} ${op ? '+' : '×'} ${b} = ?</h2><div class="ch">${o.map(v => `<button>${v}</button>`).join('')}</div><small>${sc[i]}/5</small>`;
        e.querySelectorAll('button').forEach(bt => bt.onclick = () => { const w = +bt.textContent === r ? i : 1 - i; sc[w]++; if (sc[w] >= 5) return end(w); q(); });
      });
    }; q();
  } },
  { n: 'Morpion', e: '❌', run(el, end) {
    let t = 0; const b = Array(9).fill(-1), L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
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
  { n: 'Mémoire', e: '🧠', run(el, end) {
    const E = ['🐶','🐱','🦊','🐸','🐵','🐼'], d = [...E, ...E].sort(() => Math.random() - .5);
    let t = 0, o = [], lock = false, left = 6; const sc = [0, 0];
    el.innerHTML = '<p id="st"></p><div class="mem"></div>';
    const g = el.querySelector('.mem'), st = el.querySelector('#st');
    const s = () => st.innerHTML = `<b style="color:${C[0]}">${names[0]} ${sc[0]}</b> · <b style="color:${C[1]}">${names[1]} ${sc[1]}</b> — tour de ${names[t]}`; s();
    d.forEach(e => { const c = document.createElement('button'); c.textContent = '?'; c.onclick = () => {
      if (lock || c.disabled || o.includes(c)) return;
      c.textContent = e; c.classList.add('flip'); o.push(c); if (o.length < 2) return; lock = true;
      setTimeout(() => {
        if (o[0].textContent === o[1].textContent) {
          o.forEach(x => { x.disabled = true; x.style.opacity = .4; }); sc[t]++; left--;
          if (!left) return end(sc[0] === sc[1] ? -1 : sc[0] > sc[1] ? 0 : 1);
        } else { o.forEach(x => { x.textContent = '?'; x.classList.remove('flip'); }); t = 1 - t; }
        o = []; lock = false; s();
      }, 800);
    }; g.append(c); });
  } },
  { n: 'Pong', e: '🏓', run(el, end) {
    const c = document.createElement('canvas'); el.append(c);
    const W = c.width = 360, H = c.height = 600, x = c.getContext('2d'), pw = 70, p = [W / 2, W / 2], s = [0, 0]; let b, raf;
    const rs = d => b = { x: W / 2, y: H / 2, vx: 3 * (Math.random() < .5 ? 1 : -1), vy: d * 4 }; rs(Math.random() < .5 ? 1 : -1);
    c.onpointerdown = c.onpointermove = e => { const r = c.getBoundingClientRect(); p[(e.clientY - r.top) / r.height < .5 ? 0 : 1] = (e.clientX - r.left) / r.width * W; };
    const loop = () => {
      b.x += b.vx; b.y += b.vy; if (b.x < 7 || b.x > W - 7) b.vx *= -1;
      [0, 1].forEach(i => { const y = i ? H - 30 : 30;
        if (Math.abs(b.y - y) < 8 && Math.abs(b.x - p[i]) < pw / 2 && (i ? b.vy > 0 : b.vy < 0)) { b.vy *= -1.08; b.vx += (b.x - p[i]) / 12; } });
      if (b.y < 0 || b.y > H) { const w = b.y < 0 ? 1 : 0; s[w]++; if (s[w] >= 3) return end(w); rs(w ? -1 : 1); }
      x.clearRect(0, 0, W, H); x.fillStyle = '#fff'; x.beginPath(); x.arc(b.x, b.y, 7, 0, 7); x.fill();
      [0, 1].forEach(i => { x.fillStyle = C[i]; x.fillRect(p[i] - pw / 2, (i ? H - 30 : 30) - 4, pw, 8); x.font = '28px system-ui'; x.fillText(s[i], 14, i ? H / 2 + 36 : H / 2 - 12); });
      raf = requestAnimationFrame(loop);
    };
    cleanup = () => cancelAnimationFrame(raf); loop();
  } },
  { n: 'Puissance 4', e: '🔴', run(el, end) {
    const R = 6, K = 7, b = Array.from({ length: K }, () => []); let t = 0, over = false;
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
  { n: 'Cibles', e: '🎯', run(el, end) {
    const z = split(el), sc = [0, 0];
    z.forEach((e, i) => {
      e.style.position = 'relative';
      const t = document.createElement('button'), sm = document.createElement('small');
      t.className = 'tg'; t.textContent = '🎯'; sm.className = 'pt';
      const mv = () => { t.style.left = 8 + Math.random() * 70 + '%'; t.style.top = 16 + Math.random() * 56 + '%'; };
      const u = () => sm.textContent = sc[i] + '/7'; mv(); u();
      t.onpointerdown = () => { sc[i]++; u(); if (sc[i] >= 7) return end(i); mv(); };
      e.append(sm, t);
    });
  } }
];

menu();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
