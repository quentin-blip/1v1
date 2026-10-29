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
const SOON = 1;
const soon = () => Array.from({ length: SOON }, (_, k) => `<button class="soon" disabled style="--i:${games.length + k}">${logo('_lock')}<b>Soon</b></button>`).join('');

const logo = (n, s = '') => { const [c, d] = LOGOS[n]; return `<span class="lg ${s}" style="--c:${c}"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`; };
const MODES = [['Rapide', 1, 'Une seule manche'], ['Duel', 2, 'Premier à 2 manches'], ['Marathon', 3, 'Premier à 3 manches']];
const TABS = ['Tous', 'Vitesse', 'Réflexion'], CATS = [null, 'v', 'r'];
let mode = 0, tab = 0;
try { mode = Math.min(2, +localStorage.getItem('pg-mode') || 0); } catch {}

function menu() {
  cleanup(); cleanup = () => {};
  const list = games.filter(g => !CATS[tab] || LOGOS[g.n][2] === CATS[tab]);
  app.innerHTML = `<header>
    <div class="brand">${logo('_app')}<h1>Party Games</h1></div>
    <div class="sc">${sb()}</div>
    <div class="names">${[0, 1].map(i => `<input data-n="${i}" maxlength="12" value="${names[i]}" style="border-color:${C[i]}" aria-label="Nom du joueur ${i + 1}">`).join('')}</div>
    <div class="seg">${MODES.map((m, i) => `<button data-m="${i}" class="${i === mode ? 'sel' : ''}">${m[0]}</button>`).join('')}</div>
    <small class="cap">${MODES[mode][2]}</small>
    <div class="seg">${TABS.map((t, i) => `<button data-t="${i}" class="${i === tab ? 'sel' : ''}">${t}</button>`).join('')}</div>
  </header>
  <main class="grid">${list.map((g, k) => `<button class="gc" data-i="${games.indexOf(g)}" style="--i:${k};--c:${LOGOS[g.n][0]}">${logo(g.n)}<b>${g.n}</b></button>`).join('')}${tab ? '' : soon()}</main>
  <footer><button id="lb">${logo('_trophy', 'ic')} Classement</button><button id="rs">Scores à 0</button></footer>`;
  app.querySelectorAll('.gc').forEach(b => b.onclick = () => play(games[b.dataset.i]));
  app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = +b.dataset.m; try { localStorage.setItem('pg-mode', mode); } catch {} menu(); });
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = +b.dataset.t; menu(); });
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
  app.innerHTML = `<div class="bar"><button class="back" id="bk">${logo('_back', 'ic')}</button><span class="ttl">${logo('_trophy', 'sm')}Classement</span><span></span></div><div id="g"><p>Chargement…</p></div>`;
  $('#bk').onclick = menu;
  const rows = await api('leaderboard?select=name,wins&limit=10'), el = $('#g'); if (!el) return;
  el.innerHTML = !rows ? '<p>Classement indisponible : vérifie config.js et ta connexion.</p>'
    : rows.length ? `<ol class="lb">${rows.map((r, i) => `<li style="animation-delay:${i * 50}ms"><span><em class="rk r${i}">${i + 1}</em>${esc(r.name)}</span><b>${r.wins}</b></li>`).join('')}</ol>`
    : '<p>Aucune victoire enregistrée pour l’instant.</p>';
}

function play(g, st = { w: [0, 0], r: 1 }) {
  cleanup(); cleanup = () => {};
  const need = MODES[mode][1];
  app.innerHTML = `<div class="bar"><button class="back" id="bk">${logo('_back', 'ic')}</button><span class="ttl">${logo(g.n, 'sm')}${g.n}</span><span class="sc">${sb()}</span></div>
  ${need > 1 ? `<div class="series">Manche ${st.r} · premier à ${need} · <b style="color:${C[0]}">${st.w[0]}</b> – <b style="color:${C[1]}">${st.w[1]}</b></div>` : ''}
  <div id="g"></div><div id="ov" hidden></div>`;
  $('#bk').onclick = menu;
  const end = w => {
    cleanup();
    if (w >= 0) st.w[w]++;
    const win = st.w.findIndex(v => v >= need), o = $('#ov'); o.hidden = false;
    const sc2 = `<p>${st.w[0]} – ${st.w[1]}</p>`;
    if (win >= 0) {
      score[win]++; saveMatch(g.n, win); $('.bar .sc').innerHTML = sb();
      o.innerHTML = `<div class="card"><small>Victoire</small><h2 style="color:${C[win]}">${names[win]}</h2>${need > 1 ? sc2 : ''}<button id="again">Rejouer</button><button id="mn">Menu</button></div>`;
      $('#again').onclick = () => play(g);
    } else {
      o.innerHTML = `<div class="card"><small>Manche ${st.r}</small><h2 style="color:${w < 0 ? '#fff' : C[w]}">${w < 0 ? 'Égalité' : names[w]}</h2>${sc2}<button id="again">Manche suivante</button><button id="mn">Menu</button></div>`;
      $('#again').onclick = () => { st.r++; play(g, st); };
    }
    $('#mn').onclick = menu;
  };
  g.run($('#g'), end);
}

const games = [
  { n: 'Réflexe', run(el, end) {
    const z = split(el); let go = false, done = false;
    z.forEach(x => x.textContent = 'Attends le vert… ne tape pas trop tôt !');
    const t = setTimeout(() => { go = true; z.forEach(x => { x.style.background = '#2ecc71'; x.textContent = 'TAPE !'; }); }, 2000 + Math.random() * 3000);
    cleanup = () => clearTimeout(t);
    z.forEach((x, i) => x.onpointerdown = () => { if (done) return; done = true; clearTimeout(t); end(go ? i : 1 - i); });
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
        e.innerHTML = `<h2>${a} ${op ? '+' : '×'} ${b} = ?</h2><div class="ch">${o.map(v => `<button>${v}</button>`).join('')}</div><small>${sc[i]}/5</small>`;
        e.querySelectorAll('button').forEach(bt => bt.onclick = () => { const w = +bt.textContent === r ? i : 1 - i; sc[w]++; if (sc[w] >= 5) return end(w); q(); });
      });
    }; q();
  } },
  { n: 'Morpion', run(el, end) {
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
  { n: 'Mémoire', run(el, end) {
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
  { n: 'Pong', run(el, end) {
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
  { n: 'Puissance 4', run(el, end) {
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
  { n: 'Cibles', run(el, end) {
    const z = split(el), sc = [0, 0];
    z.forEach((e, i) => {
      e.style.position = 'relative';
      const t = document.createElement('button'), sm = document.createElement('small');
      t.className = 'tg'; t.innerHTML = '<i></i>'; sm.className = 'pt';
      const mv = () => { t.style.left = 8 + Math.random() * 70 + '%'; t.style.top = 16 + Math.random() * 56 + '%'; };
      const u = () => sm.textContent = sc[i] + '/7'; mv(); u();
      t.onpointerdown = () => { sc[i]++; u(); if (sc[i] >= 7) return end(i); mv(); };
      e.append(sm, t);
    });
  } },
  { n: 'Chifoumi', run(el, end) {
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
  { n: 'Chrono', run(el, end) {
    const z = split(el), T = 5, t0 = performance.now(), res = [null, null]; let raf;
    z.forEach((x, i) => {
      x.innerHTML = `<small>Stoppe à ${T.toFixed(2)} s</small><h1>0.00</h1><b>TAPE POUR STOPPER</b>`;
      x.onpointerdown = () => {
        if (res[i] !== null) return;
        res[i] = (performance.now() - t0) / 1000; x.querySelector('h1').textContent = res[i].toFixed(2); x.querySelector('b').textContent = 'Stoppé';
        if (res.some(v => v === null)) return;
        cancelAnimationFrame(raf); const d = res.map(v => Math.abs(v - T));
        z.forEach((q, j) => q.querySelector('b').textContent = `Écart ${d[j].toFixed(2)} s`);
        const id = setTimeout(() => end(Math.abs(d[0] - d[1]) < .005 ? -1 : d[0] < d[1] ? 0 : 1), 1500); cleanup = () => clearTimeout(id);
      };
    });
    const loop = () => { const s = (performance.now() - t0) / 1000; z.forEach((x, i) => { if (res[i] === null) x.querySelector('h1').textContent = s < 1.5 ? s.toFixed(2) : '?.??'; }); raf = requestAnimationFrame(loop); };
    cleanup = () => cancelAnimationFrame(raf); loop();
  } },
  { n: 'Allumettes', run(el, end) {
    let n = 15, t = 0;
    el.innerHTML = '<p id="st"></p><div class="mt"></div><div class="ch"></div>';
    const st = el.querySelector('#st'), m = el.querySelector('.mt'), b = el.querySelector('.ch');
    const draw = () => { st.innerHTML = `<b style="color:${C[t]}">${names[t]}</b> prend 1, 2 ou 3 allumettes<br><small>Celui qui prend la dernière perd</small>`; m.innerHTML = '<i></i>'.repeat(n); [...b.children].forEach(x => x.disabled = +x.textContent > n); };
    [1, 2, 3].forEach(k => { const x = document.createElement('button'); x.textContent = k; x.onclick = () => { if (k > n) return; n -= k; if (n === 0) return end(1 - t); t = 1 - t; draw(); }; b.append(x); });
    draw();
  } },
  { n: 'Simon', run(el, end) {
    const K = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28'], seq = []; let t = 0, pos = 0, busy = false, off = false;
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
  { n: 'Cochon', run(el, end) {
    const P = [0, 0]; let t = 0, cur = 0;
    el.innerHTML = '<p id="st"></p><div class="die">·</div><div class="ch w"><button id="ro">Lancer</button><button id="hd">Garder</button></div>';
    const st = el.querySelector('#st'), die = el.querySelector('.die');
    const draw = (m = '') => st.innerHTML = `<b style="color:${C[0]}">${names[0]} ${P[0]}</b> · <b style="color:${C[1]}">${names[1]} ${P[1]}</b><br>Tour de <b style="color:${C[t]}">${names[t]}</b> · en jeu : ${cur}<br><small>${m || 'Premier à 50. Un 1 fait tout perdre.'}</small>`;
    el.querySelector('#ro').onclick = () => {
      const d = 1 + Math.random() * 6 | 0; die.textContent = d; die.classList.remove('on'); void die.offsetWidth; die.classList.add('on');
      if (d === 1) { cur = 0; t = 1 - t; draw('Un 1 ! Tour perdu.'); } else { cur += d; draw(); }
    };
    el.querySelector('#hd').onclick = () => { P[t] += cur; if (P[t] >= 50) return end(t); cur = 0; t = 1 - t; die.textContent = '·'; draw(); };
    draw();
  } },
  { n: 'Couleurs', run(el, end) {
    const z = split(el), sc = [0, 0], N = [['ROUGE', '#ef5350'], ['BLEU', '#42a5f5'], ['VERT', '#66bb6a'], ['JAUNE', '#ffca28']];
    const q = () => {
      const w = N[Math.random() * 4 | 0]; let ink; do ink = N[Math.random() * 4 | 0]; while (ink === w);
      z.forEach((e, i) => {
        const o = [...N].sort(() => Math.random() - .5);
        e.innerHTML = `<small>Touche la couleur de l’encre</small><h1 style="color:${ink[1]}">${w[0]}</h1><div class="ch">${o.map(c => `<button data-c="${c[1]}" style="background:${c[1]};height:56px"></button>`).join('')}</div><small>${sc[i]}/5</small>`;
        e.querySelectorAll('button').forEach(b => b.onclick = () => { const r = b.dataset.c === ink[1] ? i : 1 - i; sc[r]++; if (sc[r] >= 5) return end(r); q(); });
      });
    }; q();
  } },
  { n: 'Ordre', run(el, end) {
    const z = split(el), nx = [1, 1];
    z.forEach((e, i) => {
      e.innerHTML = '<small>Touche de 1 à 9 dans l’ordre</small><div class="nm"></div>';
      const g = e.querySelector('.nm');
      [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - .5).forEach(n => {
        const b = document.createElement('button'); b.textContent = n;
        b.onpointerdown = () => {
          if (n !== nx[i]) { b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 250); return; }
          b.disabled = true; b.style.opacity = .25; if (++nx[i] > 9) end(i);
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
  { n: 'Bombe', run(el, end) {
    const z = split(el); let h = Math.random() < .5 ? 0 : 1, done = false, t2;
    const draw = () => z.forEach((x, i) => { x.classList.toggle('hot', i === h); x.innerHTML = i === h ? '<h1>PASSE !</h1>' : '<h2>Attends…</h2>'; });
    z.forEach((x, i) => x.onpointerdown = () => { if (done || i !== h) return; h = 1 - h; draw(); });
    const t1 = setTimeout(() => { done = true; z[h].innerHTML = '<h1>BOOM !</h1>'; t2 = setTimeout(() => end(1 - h), 900); }, 4000 + Math.random() * 9000);
    cleanup = () => { clearTimeout(t1); clearTimeout(t2); }; draw();
  } }
];

menu();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
