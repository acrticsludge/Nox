// NOX view layer (T3 extraction) — renders sim state to SVG/DOM.
// Pure module: function declarations only, zero top-level side effects.
// Circular import with game-logic.js is safe: view functions are invoked
// post-init; state is read via ESM live bindings and never written here.
import {
  players, bot, bullets, pickups, particles, hazards, wallData, scores, round, timeLeft, safeRadius,
  gameState, gameMode, prevHp, trialPoints,
  MAX_HP, SHIELD_MAX_HP, DASH_COOLDOWN, BULLET_R, WIN_SCORE, POWER_TYPES, AMMO_PICKUP_CFG,
  TRIALS_W, TRIALS_H, TRIAL_DURATION, VOID_START_TIME,
  isLavaActive,
} from './game-logic.js';

function isLavaWarning(h) {
  const mod = h.t % 300;
  return mod < 120;
}

function drawWalls() {
  const wallsG = document.getElementById('walls');
  if(!wallsG) return;
  wallsG.innerHTML = '';
  // Outer frame as single merged path so corners don't overlap
  const hasBorder = wallData.some(d => d.isBorder);
  if (hasBorder) {
    const fw = gameMode === 'trials' ? TRIALS_W : 960;
    const fh = gameMode === 'trials' ? TRIALS_H : 560;
    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // outer frame with 10px thick border (inner hole 10 inset)
    frame.setAttribute('d', `M0 0 H${fw} V${fh} H0 Z M10 10 H${fw - 10} V${fh - 10} H10 Z`);
    frame.setAttribute('fill', '#0f172a');
    frame.setAttribute('fill-rule', 'evenodd');
    frame.setAttribute('stroke', 'rgba(27,36,39,0.9)');
    frame.setAttribute('stroke-width', '1');
    wallsG.appendChild(frame);
    const frameHi = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    frameHi.setAttribute('d', `M10 11 H${fw - 10} M10 ${fh - 11} H${fw - 10} M11 10 V${fh - 10} M${fw - 11} 10 V${fh - 10}`);
    frameHi.setAttribute('fill', 'none');
    frameHi.setAttribute('stroke', 'rgba(255,255,255,0.07)');
    frameHi.setAttribute('stroke-width', '1');
    frameHi.setAttribute('opacity', '0.9');
    wallsG.appendChild(frameHi);
  }
  wallData.forEach(d => {
    if (d.isBorder) return; // already drawn as frame
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', d.x); r.setAttribute('y', d.y);
    r.setAttribute('width', d.w); r.setAttribute('height', d.h);
    r.setAttribute('rx', d.rx != null ? d.rx : 2);
    r.setAttribute('fill', 'url(#wallGrad)');
    r.setAttribute('stroke', 'rgba(27,36,39,0.85)');
    r.setAttribute('stroke-width', '1');
    if(d.w > 100 || d.h > 100) r.setAttribute('opacity', '0.96');
    wallsG.appendChild(r);
    // subtle top highlight for depth - inset 2px, no overlap on merged corners
    const hl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hl.setAttribute('x', d.x + 1.5); hl.setAttribute('y', d.y + 1);
    hl.setAttribute('width', Math.max(0, d.w - 3)); hl.setAttribute('height', '1.5');
    hl.setAttribute('rx', '1');
    hl.setAttribute('fill', 'rgba(255,255,255,0.09)');
    hl.setAttribute('opacity', '0.9');
    wallsG.appendChild(hl);
  });
}

function drawHazards() {
  const hazardsG = document.getElementById('hazards');
  if(!hazardsG) return;
  hazardsG.innerHTML = '';
  hazards.forEach(h => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if(h.kind === 'slime') {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', h.x); bg.setAttribute('y', h.y);
      bg.setAttribute('width', h.w); bg.setAttribute('height', h.h);
      bg.setAttribute('rx', '8');
      bg.setAttribute('fill', 'url(#slimeGrad)'); bg.setAttribute('opacity', '0.92');
      bg.setAttribute('stroke', 'rgba(110,231,183,0.22)'); bg.setAttribute('stroke-width', '1');
      g.appendChild(bg);
      const b1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      b1.setAttribute('cx', h.x + 10); b1.setAttribute('cy', h.y + 11); b1.setAttribute('r', '3.2');
      b1.setAttribute('fill', 'rgba(255,255,255,0.22)'); g.appendChild(b1);
      const b2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      b2.setAttribute('cx', h.x + 26); b2.setAttribute('cy', h.y + 24); b2.setAttribute('r', '2.1');
      b2.setAttribute('fill', 'rgba(255,255,255,0.16)'); g.appendChild(b2);
      const b3 = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      b3.setAttribute('cx', h.x + 18); b3.setAttribute('cy', h.y + 28); b3.setAttribute('rx', '7'); b3.setAttribute('ry', '3');
      b3.setAttribute('fill', 'rgba(16,185,129,0.18)'); g.appendChild(b3);
      const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lab.setAttribute('x', h.x + 18); lab.setAttribute('y', h.y + 33);
      lab.setAttribute('text-anchor', 'middle');
      lab.setAttribute('font-size', '7');
      lab.setAttribute('font-family', 'JetBrains Mono, monospace');
      lab.setAttribute('fill', 'rgba(255,255,255,0.55)'); lab.textContent = 'SLIME';
      g.appendChild(lab);
    } else {
      const active = isLavaActive(h), warn = isLavaWarning(h);
      const r = 14 + (active ? 1.6 : 0);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', h.x + 18); c.setAttribute('cy', h.y + 18); c.setAttribute('r', r);
      c.setAttribute('fill', 'url(#lavaGrad)');
      c.setAttribute('opacity', active ? '1' : warn ? '0.78' : '0.42');
      c.setAttribute('stroke', active ? '#fff' : '#fb923c');
      c.setAttribute('stroke-width', active ? '1.4' : '1');
      c.setAttribute('stroke-opacity', active ? '0.85' : '0.5');
      if(active) c.setAttribute('filter', 'url(#softGlow)');
      g.appendChild(c);
      if(warn) {
        const w = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        w.setAttribute('cx', h.x + 18); w.setAttribute('cy', h.y + 18); w.setAttribute('r', '18');
        w.setAttribute('fill', 'none'); w.setAttribute('stroke', '#fb923c');
        w.setAttribute('stroke-width', '1');
        w.setAttribute('stroke-dasharray', '3 4'); w.setAttribute('opacity', '0.55');
        g.appendChild(w);
      }
      const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lab.setAttribute('x', h.x + 18); lab.setAttribute('y', active ? h.y + 32 : h.y + 33);
      lab.setAttribute('text-anchor', 'middle');
      lab.setAttribute('font-size', '7');
      lab.setAttribute('font-family', 'JetBrains Mono, monospace');
      lab.setAttribute('fill', active ? '#fff' : 'rgba(255,255,255,0.55)');
      lab.textContent = active ? 'LAVA' : 'VENT';
      g.appendChild(lab);
      if(active) {
        const e = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        e.setAttribute('cx', h.x + 18 + Math.sin(h.t * 0.18) * 2);
        e.setAttribute('cy', h.y + 18 + Math.cos(h.t * 0.2) * 2);
        e.setAttribute('r', '2.1');
        e.setAttribute('fill', '#fff'); e.setAttribute('opacity', '0.9');
        g.appendChild(e);
      }
    }
    hazardsG.appendChild(g);
  });
}

function render() {
  const playersG = document.getElementById('players');
  const bulletsG = document.getElementById('bullets');
  const pickupsG = document.getElementById('pickups');
  const particlesG = document.getElementById('particles');
  if(!playersG || !bulletsG || !pickupsG || !particlesG) return;

  playersG.innerHTML = '';
  // In trials only render P1; bot rendered separately. In 1v1 render both.
  const activePlayers = gameMode === 'trials' ? [players[0]] : players;
  activePlayers.forEach(p => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${p.angle * 180 / Math.PI})`);
    g.setAttribute('opacity', p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0 ? '0.35' : '1');

    const sh = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    sh.setAttribute('cx', '2'); sh.setAttribute('cy', '10');
    sh.setAttribute('rx', '14'); sh.setAttribute('ry', '6');
    sh.setAttribute('fill', 'rgba(0,0,0,0.35)'); sh.setAttribute('filter', 'url(#softGlow)');
    g.appendChild(sh);

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('d', 'M 18 0 L -12 -11 L -8 0 L -12 11 Z');
    body.setAttribute('fill', p.id === 0 ? '#3ec5f2' : '#f43f5e');
    body.setAttribute('stroke', '#fff'); body.setAttribute('stroke-width', '1.6');
    body.setAttribute('stroke-linejoin', 'round');
    body.setAttribute('filter', p.id === 0 ? 'url(#glowCyan)' : 'url(#glowPink)');
    g.appendChild(body);

    const cock = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cock.setAttribute('cx', '0'); cock.setAttribute('cy', '0'); cock.setAttribute('r', '5.5');
    cock.setAttribute('fill', '#fff'); cock.setAttribute('opacity', '0.95');
    g.appendChild(cock);
    const cock2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cock2.setAttribute('cx', '0.8'); cock2.setAttribute('cy', '-1'); cock2.setAttribute('r', '2');
    cock2.setAttribute('fill', p.color);
    g.appendChild(cock2);

    if(p.dash > 0) {
      const flame = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flame.setAttribute('d', 'M -12 0 L -22 -6 L -26 0 L -22 6 Z');
      flame.setAttribute('fill', p.id === 0 ? '#a9e9ff' : '#ff9ec9');
      flame.setAttribute('opacity', '0.9');
      g.appendChild(flame);
    }

    if(p.overcharge > 0) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', '0'); ring.setAttribute('cy', '0'); ring.setAttribute('r', '20');
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#ffb23e');
      ring.setAttribute('stroke-width', '2');
      ring.setAttribute('stroke-dasharray', '4 4'); ring.setAttribute('opacity', '0.85');
      ring.setAttribute('transform', `rotate(${(Date.now() / 12) % 360})`);
      g.appendChild(ring);
    }

    if(p.shield) {
      const hp = p.shieldHp || 0;
      const ratio = hp / (p.shieldMax || SHIELD_MAX_HP);
      let dash = '6 3', op = '0.92', sw = '2.6';
      if(hp === 2) { dash = '6 7'; op = '0.68'; sw = '2.2'; }
      else if(hp === 1) { dash = '3.5 9'; op = '0.42'; sw = '1.8'; }
      const sr = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      sr.setAttribute('cx', '0'); sr.setAttribute('cy', '0'); sr.setAttribute('r', '22');
      sr.setAttribute('fill', 'none'); sr.setAttribute('stroke', '#58d8ff');
      sr.setAttribute('stroke-width', sw);
      sr.setAttribute('opacity', op); sr.setAttribute('stroke-dasharray', dash);
      sr.setAttribute('stroke-linecap', 'round');
      if(hp === 1) sr.setAttribute('transform', `rotate(${(Date.now() / 14) % 360})`);
      g.appendChild(sr);
      const sr2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      sr2.setAttribute('cx', '0'); sr2.setAttribute('cy', '0'); sr2.setAttribute('r', '24');
      sr2.setAttribute('fill', '#58d8ff');
      sr2.setAttribute('opacity', hp === 1 ? '0.06' : hp === 2 ? '0.09' : '0.13');
      g.appendChild(sr2);
      if(hp <= 2) {
        const crack1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        crack1.setAttribute('d', 'M 0 -18 L 4 -10 L -2 -2 L 5 6 L -1 14');
        crack1.setAttribute('fill', 'none'); crack1.setAttribute('stroke', '#a9e9ff');
        crack1.setAttribute('stroke-width', '1.1');
        crack1.setAttribute('opacity', hp === 1 ? '0.85' : '0.55');
        crack1.setAttribute('stroke-linecap', 'round'); crack1.setAttribute('stroke-linejoin', 'round');
        g.appendChild(crack1);
      }
      if(hp === 1) {
        const crack2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        crack2.setAttribute('d', 'M -14 -4 L -6 0 L -10 7 L -2 11');
        crack2.setAttribute('fill', 'none'); crack2.setAttribute('stroke', '#a9e9ff');
        crack2.setAttribute('stroke-width', '1'); crack2.setAttribute('opacity', '0.5');
        crack2.setAttribute('stroke-linecap', 'round');
        g.appendChild(crack2);
        const crack3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        crack3.setAttribute('d', 'M 10 -12 L 13 -4 L 8 2');
        crack3.setAttribute('fill', 'none'); crack3.setAttribute('stroke', '#a9e9ff');
        crack3.setAttribute('stroke-width', '0.9'); crack3.setAttribute('opacity', '0.45');
        g.appendChild(crack3);
      }
    }

    if(p.speedBoost > 0) {
      const br = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      br.setAttribute('cx', '0'); br.setAttribute('cy', '0'); br.setAttribute('r', '18');
      br.setAttribute('fill', 'none'); br.setAttribute('stroke', '#c9ff2f');
      br.setAttribute('stroke-width', '2');
      br.setAttribute('opacity', '0.8'); br.setAttribute('stroke-dasharray', '2 5');
      br.setAttribute('transform', `rotate(${(Date.now() / 8) % 360})`);
      g.appendChild(br);
    }

    if(p.extraDash > 0) {
      const ed = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ed.setAttribute('x', '14'); ed.setAttribute('y', '-14');
      ed.setAttribute('font-size', '10'); ed.setAttribute('font-weight', '800');
      ed.setAttribute('fill', '#c9ff2f');
      ed.textContent = '◆'.repeat(p.extraDash);
      g.appendChild(ed);
    }

    const hpArc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    hpArc.setAttribute('x', '0'); hpArc.setAttribute('y', '28');
    hpArc.setAttribute('text-anchor', 'middle');
    hpArc.setAttribute('font-size', p.hp > 8 ? '8' : '9');
    hpArc.setAttribute('font-family', 'JetBrains Mono, monospace');
    hpArc.setAttribute('fill', '#fff'); hpArc.setAttribute('opacity', '0.85');
    hpArc.setAttribute('transform', `rotate(${-p.angle * 180 / Math.PI})`);
    // 12 HP: show hearts up to 6 else numeric to avoid overflow, keep minimal
    hpArc.textContent = p.hp <= 6 ? '♥'.repeat(p.hp) : `${p.hp}♥`;
    g.appendChild(hpArc);
    // ammo indicator in arena - tiny text above hp if typed
    if(p.ammoType && p.ammoType !== 'standard'){
      const ammoArc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ammoArc.setAttribute('x', '0'); ammoArc.setAttribute('y', p.hp > 6 ? '38' : '36');
      ammoArc.setAttribute('text-anchor', 'middle');
      ammoArc.setAttribute('font-size', '6');
      ammoArc.setAttribute('font-family', 'JetBrains Mono, monospace');
      ammoArc.setAttribute('fill', p.ammoType==='needle'?'#a78bfa':p.ammoType==='cannon'?'#ffb23e':'#58d8ff');
      ammoArc.setAttribute('opacity', '0.9');
      ammoArc.setAttribute('transform', `rotate(${-p.angle * 180 / Math.PI})`);
      ammoArc.textContent = p.ammoType==='needle' ? `Nx${p.ammo}` : p.ammoType==='cannon' ? `Cx${p.ammo}` : `Tx${p.ammo}`;
      g.appendChild(ammoArc);
    }

    if(p.dashCd > 0) {
      const cd = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      cd.setAttribute('x', '-12'); cd.setAttribute('y', '-18');
      cd.setAttribute('width', '24'); cd.setAttribute('height', '3');
      cd.setAttribute('rx', '2');
      cd.setAttribute('fill', 'rgba(255,255,255,0.18)');
      g.appendChild(cd);
      const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      fill.setAttribute('x', '-12'); fill.setAttribute('y', '-18');
      fill.setAttribute('width', String(24 * (1 - p.dashCd / DASH_COOLDOWN)));
      fill.setAttribute('height', '3');
      fill.setAttribute('rx', '2');
      fill.setAttribute('fill', p.dashCd < 10 ? '#22c55e' : '#ff9d2e');
      g.appendChild(fill);
    }

    playersG.appendChild(g);
  });

  // Render bot in trials mode (bot is a separate object from players)
  if(gameMode === 'trials' && bot.alive) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${bot.x},${bot.y}) rotate(${bot.angle * 180 / Math.PI})`);
    g.setAttribute('opacity', bot.inv > 0 && Math.floor(bot.inv / 4) % 2 === 0 ? '0.35' : '1');

    const sh = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    sh.setAttribute('cx', '2'); sh.setAttribute('cy', '10');
    sh.setAttribute('rx', '14'); sh.setAttribute('ry', '6');
    sh.setAttribute('fill', 'rgba(0,0,0,0.35)'); sh.setAttribute('filter', 'url(#softGlow)');
    g.appendChild(sh);

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('d', 'M 18 0 L -12 -11 L -8 0 L -12 11 Z');
    body.setAttribute('fill', '#ffb23e');
    body.setAttribute('stroke', '#fff'); body.setAttribute('stroke-width', '1.6');
    body.setAttribute('stroke-linejoin', 'round');
    body.setAttribute('filter', 'url(#glowPink)');
    g.appendChild(body);

    const cock = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cock.setAttribute('cx', '0'); cock.setAttribute('cy', '0'); cock.setAttribute('r', '5.5');
    cock.setAttribute('fill', '#fff'); cock.setAttribute('opacity', '0.95');
    g.appendChild(cock);
    const cock2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cock2.setAttribute('cx', '0.8'); cock2.setAttribute('cy', '-1'); cock2.setAttribute('r', '2');
    cock2.setAttribute('fill', bot.color);
    g.appendChild(cock2);

    if(bot.dash > 0) {
      const flame = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flame.setAttribute('d', 'M -12 0 L -22 -6 L -26 0 L -22 6 Z');
      flame.setAttribute('fill', '#ffd8a8');
      flame.setAttribute('opacity', '0.9');
      g.appendChild(flame);
    }

    if(bot.overcharge > 0) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', '0'); ring.setAttribute('cy', '0'); ring.setAttribute('r', '20');
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#ffb23e');
      ring.setAttribute('stroke-width', '2'); ring.setAttribute('stroke-dasharray', '4 4'); ring.setAttribute('opacity', '0.85');
      ring.setAttribute('transform', `rotate(${(Date.now() / 12) % 360})`);
      g.appendChild(ring);
    }
    if(bot.shield) {
      const hp = bot.shieldHp || 0;
      let dash='6 3', op='0.92', sw='2.6';
      if(hp===2){dash='6 7'; op='0.68'; sw='2.2';} else if(hp===1){dash='3.5 9'; op='0.42'; sw='1.8';}
      const sr = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      sr.setAttribute('cx','0'); sr.setAttribute('cy','0'); sr.setAttribute('r','22');
      sr.setAttribute('fill','none'); sr.setAttribute('stroke','#58d8ff'); sr.setAttribute('stroke-width',sw);
      sr.setAttribute('opacity',op); sr.setAttribute('stroke-dasharray',dash); sr.setAttribute('stroke-linecap','round');
      if(hp===1) sr.setAttribute('transform',`rotate(${(Date.now()/14)%360})`);
      g.appendChild(sr);
      const sr2=document.createElementNS('http://www.w3.org/2000/svg','circle');
      sr2.setAttribute('cx','0'); sr2.setAttribute('cy','0'); sr2.setAttribute('r','24');
      sr2.setAttribute('fill','#58d8ff'); sr2.setAttribute('opacity', hp===1?'0.06':hp===2?'0.09':'0.13');
      g.appendChild(sr2);
    }
    if(bot.speedBoost > 0) {
      const br=document.createElementNS('http://www.w3.org/2000/svg','circle');
      br.setAttribute('cx','0'); br.setAttribute('cy','0'); br.setAttribute('r','18');
      br.setAttribute('fill','none'); br.setAttribute('stroke','#c9ff2f'); br.setAttribute('stroke-width','2');
      br.setAttribute('opacity','0.8'); br.setAttribute('stroke-dasharray','2 5');
      br.setAttribute('transform',`rotate(${(Date.now()/8)%360})`);
      g.appendChild(br);
    }
    if(bot.extraDash > 0) {
      const ed=document.createElementNS('http://www.w3.org/2000/svg','text');
      ed.setAttribute('x','14'); ed.setAttribute('y','-14'); ed.setAttribute('font-size','10'); ed.setAttribute('font-weight','800'); ed.setAttribute('fill','#c9ff2f');
      ed.textContent='◆'.repeat(bot.extraDash);
      g.appendChild(ed);
    }
    // bot hp arc + ammo indicator (mirrors player)
    {
      const hpArc=document.createElementNS('http://www.w3.org/2000/svg','text');
      hpArc.setAttribute('x','0'); hpArc.setAttribute('y','28'); hpArc.setAttribute('text-anchor','middle');
      hpArc.setAttribute('font-size', bot.hp>8?'8':'9'); hpArc.setAttribute('font-family','JetBrains Mono, monospace');
      hpArc.setAttribute('fill','#fff'); hpArc.setAttribute('opacity','0.85');
      hpArc.setAttribute('transform',`rotate(${-bot.angle*180/Math.PI})`);
      hpArc.textContent= bot.hp<=6 ? '♥'.repeat(bot.hp) : `${bot.hp}♥`;
      g.appendChild(hpArc);
      if(bot.ammoType && bot.ammoType!=='standard'){
        const ammoArc=document.createElementNS('http://www.w3.org/2000/svg','text');
        ammoArc.setAttribute('x','0'); ammoArc.setAttribute('y', bot.hp>6?'38':'36'); ammoArc.setAttribute('text-anchor','middle');
        ammoArc.setAttribute('font-size','6'); ammoArc.setAttribute('font-family','JetBrains Mono, monospace');
        ammoArc.setAttribute('fill', bot.ammoType==='needle'?'#a78bfa':bot.ammoType==='cannon'?'#ffb23e':'#58d8ff');
        ammoArc.setAttribute('opacity','0.9'); ammoArc.setAttribute('transform',`rotate(${-bot.angle*180/Math.PI})`);
        ammoArc.textContent= bot.ammoType==='needle'?`Nx${bot.ammo}`:bot.ammoType==='cannon'?`Cx${bot.ammo}`:`Tx${bot.ammo}`;
        g.appendChild(ammoArc);
      }
      if(bot.dashCd>0){
        const cdbg=document.createElementNS('http://www.w3.org/2000/svg','rect');
        cdbg.setAttribute('x','-12'); cdbg.setAttribute('y','-18'); cdbg.setAttribute('width','24'); cdbg.setAttribute('height','3'); cdbg.setAttribute('rx','2');
        cdbg.setAttribute('fill','rgba(255,255,255,0.18)'); g.appendChild(cdbg);
        const cdf=document.createElementNS('http://www.w3.org/2000/svg','rect');
        cdf.setAttribute('x','-12'); cdf.setAttribute('y','-18'); cdf.setAttribute('width', String(24*(1-bot.dashCd/DASH_COOLDOWN))); cdf.setAttribute('height','3'); cdf.setAttribute('rx','2');
        cdf.setAttribute('fill', bot.dashCd<10?'#22c55e':'#ff9d2e'); g.appendChild(cdf);
      }
    }

    playersG.appendChild(g);
  }

  bulletsG.innerHTML = '';
  bullets.forEach(b => {
    const type = b.type || 'standard';
    const br = b.r ?? BULLET_R;
    // trail per type color and size
    const trailColor = type==='needle' ? '#a78bfa' : type==='cannon' ? '#ffb23e' : type==='trick' ? '#58d8ff' : (b.owner === 0 ? '#58d8ff' : '#ff5ca8');
    b.trail.forEach((t, i) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', t.x); c.setAttribute('cy', t.y);
      // needle thinner, cannon fatter
      const rTrail = type==='cannon' ? (4.2 - i*0.5) : type==='needle' ? (2.1 - i*0.4) : (3 - i * 0.5);
      c.setAttribute('r', String(Math.max(0.6, rTrail)));
      c.setAttribute('fill', trailColor);
      c.setAttribute('opacity', String(type==='cannon' ? (0.42 - i*0.06) : (0.35 - i * 0.07)));
      bulletsG.appendChild(c);
    });
    if(type === 'trick'){
      // diamond shape
      const dia = document.createElementNS('http://www.w3.org/2000/svg','path');
      const s = br;
      dia.setAttribute('d', `M ${b.x} ${b.y - s} L ${b.x + s} ${b.y} L ${b.x} ${b.y + s} L ${b.x - s} ${b.y} Z`);
      dia.setAttribute('fill', '#fff');
      dia.setAttribute('stroke', '#58d8ff');
      dia.setAttribute('stroke-width', '1.6');
      dia.setAttribute('filter', 'url(#softGlow)');
      bulletsG.appendChild(dia);
      const core = document.createElementNS('http://www.w3.org/2000/svg','circle');
      core.setAttribute('cx', b.x); core.setAttribute('cy', b.y); core.setAttribute('r', '1.2');
      core.setAttribute('fill', '#a9e9ff');
      bulletsG.appendChild(core);
      if((b.bounces ?? 0) > 0){
        const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
        txt.setAttribute('x', b.x); txt.setAttribute('y', b.y - br - 6);
        txt.setAttribute('text-anchor','middle'); txt.setAttribute('font-size','7'); txt.setAttribute('font-family','JetBrains Mono, monospace');
        txt.setAttribute('fill','#58d8ff');
        txt.textContent = '.'.repeat(b.bounces) + ` ${b.dmg}`;
        bulletsG.appendChild(txt);
      }
    } else if(type === 'cannon'){
      const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
      rect.setAttribute('x', String(b.x - br)); rect.setAttribute('y', String(b.y - br*0.7));
      rect.setAttribute('width', String(br*2)); rect.setAttribute('height', String(br*1.4));
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', '#fff');
      rect.setAttribute('stroke', '#ffb23e');
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('filter', 'url(#softGlow)');
      bulletsG.appendChild(rect);
      const ember = document.createElementNS('http://www.w3.org/2000/svg','circle');
      ember.setAttribute('cx', b.x); ember.setAttribute('cy', b.y); ember.setAttribute('r','2.4');
      ember.setAttribute('fill','#fb923c');
      bulletsG.appendChild(ember);
    } else if(type === 'needle'){
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx', b.x); circle.setAttribute('cy', b.y);
      circle.setAttribute('r', String(br));
      circle.setAttribute('fill', '#fff');
      circle.setAttribute('stroke', '#a78bfa');
      circle.setAttribute('stroke-width', '1.8');
      circle.setAttribute('filter', 'url(#softGlow)');
      bulletsG.appendChild(circle);
      const core = document.createElementNS('http://www.w3.org/2000/svg','circle');
      core.setAttribute('cx', b.x); core.setAttribute('cy', b.y);
      core.setAttribute('r', '1.2');
      core.setAttribute('fill','#ede9fe');
      bulletsG.appendChild(core);
    } else {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', b.x); circle.setAttribute('cy', b.y);
      circle.setAttribute('r', String(br));
      circle.setAttribute('fill', '#fff');
      circle.setAttribute('stroke', b.owner === 0 ? '#58d8ff' : '#ff5ca8');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('filter', b.owner === 0 ? 'url(#glowCyan)' : 'url(#glowPink)');
      bulletsG.appendChild(circle);
      const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      core.setAttribute('cx', b.x); core.setAttribute('cy', b.y);
      core.setAttribute('r', '2');
      core.setAttribute('fill', b.owner === 0 ? '#a9e9ff' : '#ff9ec9');
      bulletsG.appendChild(core);
    }
  });

  pickupsG.innerHTML = '';
  pickups.forEach(pu => {
    const kind = pu.kind || 'overcharge';
    const cfg = POWER_TYPES[kind] || AMMO_PICKUP_CFG[kind] || POWER_TYPES.overcharge;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${pu.x},${pu.y})`);
    const pulse = 1 + Math.sin(pu.t) * 0.13;
    const flicker = pu.life < 90 ? (Math.floor(pu.life / 6) % 2 === 0 ? 0.3 : 1) : 1;
    g.setAttribute('opacity', flicker);

    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('r', String(18 * pulse));
    glow.setAttribute('fill', cfg.color); glow.setAttribute('opacity', '0.18');
    glow.setAttribute('filter', 'url(#softGlow)');
    g.appendChild(glow);

    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', '13');
    c.setAttribute('fill', cfg.bg);
    c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', '2');
    c.setAttribute('filter', 'url(#softGlow)');
    g.appendChild(c);

    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    inner.setAttribute('text-anchor', 'middle'); inner.setAttribute('dy', '5');
    inner.setAttribute('font-size', '13'); inner.setAttribute('font-weight', '800');
    inner.setAttribute('fill', '#fff');
    inner.textContent = cfg.icon;
    g.appendChild(inner);

    for(let i = 0; i < 3; i++) {
      const ang = pu.t * 0.85 + i * 2.094;
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(Math.cos(ang) * 19));
      dot.setAttribute('cy', String(Math.sin(ang) * 19));
      dot.setAttribute('r', '2.5');
      dot.setAttribute('fill', cfg.color); dot.setAttribute('opacity', '0.9');
      g.appendChild(dot);
    }

    const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lab.setAttribute('y', '26'); lab.setAttribute('text-anchor', 'middle');
    lab.setAttribute('font-size', '7');
    lab.setAttribute('font-family', 'JetBrains Mono, monospace');
    lab.setAttribute('fill', '#fff'); lab.setAttribute('opacity', '0.7');
    if(kind.indexOf('ammo_')===0){ lab.textContent = kind === 'ammo_needle' ? 'NEEDLE' : kind === 'ammo_cannon' ? 'CANNON' : 'TRICK'; }
    else lab.textContent = kind === 'overcharge' ? 'TRI' : kind === 'shield' ? 'SHLD' : kind === 'heal' ? 'HEAL' : 'BLNK';
    g.appendChild(lab);
    pickupsG.appendChild(g);
  });

  particlesG.innerHTML = '';
  particles.forEach(pt => {
    if(pt.type === 'healText') {
      const a = pt.life / pt.max;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      el.setAttribute('x', pt.x); el.setAttribute('y', pt.y);
      el.setAttribute('text-anchor', 'middle'); el.setAttribute('font-size', '11');
      el.setAttribute('font-weight', '800');
      el.setAttribute('font-family', 'JetBrains Mono, monospace');
      el.setAttribute('fill', pt.color); el.setAttribute('opacity', String(a));
      el.setAttribute('stroke', 'rgba(0,0,0,0.35)'); el.setAttribute('stroke-width', '0.4');
      el.textContent = pt.text || '+1';
      particlesG.appendChild(el);
      return;
    }
    const a = pt.life / pt.max;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    el.setAttribute('cx', pt.x); el.setAttribute('cy', pt.y);
    el.setAttribute('r', String(pt.r * a));
    el.setAttribute('fill', pt.color); el.setAttribute('opacity', String(a));
    if(pt.type === 'star') el.setAttribute('stroke', '#fff');
    particlesG.appendChild(el);
  });
}

function setCyberBadgeText(el, text) {
  if (!el) return;
  const inner = el.querySelector('.cyber-badge__text');
  if (inner) inner.textContent = text;
  else el.textContent = text;
}

function setCyberBadgeVariant(el, variant) {
  if (!el) return;
  // preserve cyber-badge base, swap variant
  el.className = `cyber-badge cyber-badge--${variant}`;
  if (el.id) el.id = el.id; // keep id
}

function updatePlayerCardHUD(p, pi) {
  // Shared helper — called for both 1v1 and trials P1 so health/pointer never drifts
  const hEl = document.getElementById(pi === 0 ? 'heartsP1' : 'heartsP2');
  const justDamaged = prevHp[pi] > p.hp;
  const pct = (p.hp / MAX_HP) * 100;
  if(hEl) {
    hEl.innerHTML = '';
    const fill = document.createElement('div');
    fill.className = 'hp-fill';
    fill.style.width = pct + '%';
    if(p.hp <= 2) fill.classList.add('low');
    hEl.appendChild(fill);
    const txt = document.createElement('div');
    txt.className = 'hp-text';
    txt.textContent = `${p.hp} / ${MAX_HP}`;
    hEl.appendChild(txt);
    if(justDamaged) {
      hEl.classList.remove('damage');
      void hEl.offsetWidth;
      hEl.classList.add('damage');
      setTimeout(() => hEl.classList.remove('damage'), 300);
    }
    if(p.hp <= 2) hEl.style.filter = pi === 0 ? 'brightness(1.15)' : 'brightness(1.12)';
    else if(p.hp <= 4) hEl.style.filter = 'brightness(1.05)';
    else hEl.style.filter = 'none';
    prevHp[pi] = p.hp;
  }
  const ov = document.getElementById(`ovP${pi + 1}`);
  const ovF = document.getElementById(`ovF${pi + 1}`);
  const ovT = document.getElementById(`ovT${pi + 1}`);
  if(ov) {
    const active = p.overcharge > 0;
    ov.classList.toggle('active', active);
    if(ovF) ovF.style.width = active ? (p.overcharge / 240 * 100) + '%' : '0%';
    if(ovT) ovT.textContent = active ? (p.overcharge / 60).toFixed(1) + 's' : '';
  }
  const sh = document.getElementById(`shP${pi + 1}`);
  const shF = document.getElementById(`shF${pi + 1}`);
  const shT = document.getElementById(`shT${pi + 1}`);
  if(sh) {
    const active = !!p.shield && p.shieldHp > 0;
    sh.classList.toggle('active', active);
    const max = p.shieldMax || SHIELD_MAX_HP;
    const pct2 = active ? (p.shieldHp / max * 100) : 0;
    if(shF) shF.style.width = pct2 + '%';
    if(active) {
      if(p.shieldHp === 1) { sh.style.animation = 'crackShake 0.35s infinite'; }
      else if(p.shieldHp === 2) { sh.style.animation = 'none'; }
      else { sh.style.animation = 'shieldPulse 1.3s infinite'; }
    } else {
      if(shF) shF.style.filter = 'none';
      sh.style.animation = 'none';
    }
    if(shT) shT.textContent = active ? `${p.shieldHp}/${max}` : '';
    const lab = sh.querySelector('.chip-label');
    if(lab) lab.textContent = active && p.shieldHp === 1 ? 'CRACK' : 'SHLD';
  }
  const bl = document.getElementById(`blP${pi + 1}`);
  const blF = document.getElementById(`blF${pi + 1}`);
  const blT = document.getElementById(`blT${pi + 1}`);
  if(bl) {
    const hasDash = p.extraDash > 0;
    const hasBoost = p.speedBoost > 0;
    const active = hasDash || hasBoost;
    bl.classList.toggle('active', active);
    let pctB = 0, txtB = '';
    if(hasBoost) { pctB = p.speedBoost / 180 * 100; txtB = (p.speedBoost / 60).toFixed(1) + 's'; }
    else if(hasDash) { pctB = 100; txtB = 'x' + p.extraDash; }
    if(blF) blF.style.width = pctB + '%';
    if(blT) blT.textContent = txtB;
  }
  const ammoChip = document.getElementById(`ammoP${pi + 1}`);
  const ammoT = document.getElementById(`ammoT${pi + 1}`);
  if(ammoChip && ammoT){
    const t = p.ammoType || 'standard';
    let label = 'STD INF'; let cls = 'ammo-chip--standard';
    if(t==='needle'){ label = `NEEDLE x${p.ammo}`; cls='ammo-chip--needle'; }
    else if(t==='cannon'){ label = `CANNON x${p.ammo}`; cls='ammo-chip--cannon'; }
    else if(t==='trick'){ label = `TRICK x${p.ammo} ${'.'.repeat(Math.max(0, 5 - (p.ammo !== Infinity ? (6 - p.ammo) : 0)))}`; cls='ammo-chip--trick'; }
    ammoChip.className = `ammo-chip ${cls}`;
    ammoT.textContent = label;
  }
  const dashEl = document.getElementById(`dashP${pi + 1}`);
  if(dashEl) {
    const ready = p.dashCd === 0;
    const pct3 = ready ? 100 : (1 - p.dashCd / DASH_COOLDOWN) * 100;
    dashEl.style.width = pct3 + '%';
    dashEl.style.background = ready ? '#22c55e' : (pct3 > 65 ? '#ff9d2e' : '#ef4444');
    dashEl.style.opacity = p.dash > 0 ? '0.95' : '1';
    dashEl.style.boxShadow = p.dash > 0 ? '0 0 6px #22c55e' : 'none';
  }
  const extraEl = document.getElementById(`extraP${pi + 1}`);
  if(extraEl) {
    extraEl.innerHTML = '';
    for(let k = 0; k < p.extraDash; k++) {
      const i = document.createElement('i');
      extraEl.appendChild(i);
    }
  }
  const card = document.getElementById(`cardP${pi + 1}`);
  if(card) {
    const anyActive = p.overcharge > 0 || p.shield || p.speedBoost > 0 || p.extraDash > 0;
    card.classList.toggle('hud-active', anyActive);
  }
}

function updateHUD() {
  // Trials mode HUD — timer/bot/points are trials-specific, but P1 health pointer reuses same helper as 1v1
  if(gameMode === 'trials') {
    const ptsEl = document.getElementById('trialPoints');
    if(ptsEl) ptsEl.textContent = Math.floor(trialPoints).toLocaleString();
    const botHpEl = document.getElementById('botHp');
    if(botHpEl) {
      botHpEl.textContent = `${bot.hp} / ${bot.maxHp}`;
    }
    const botHpBar = document.getElementById('botHpBar');
    const botHearts = document.getElementById('botHearts');
    if(botHpBar) {
      const pct = (bot.hp / bot.maxHp) * 100;
      botHpBar.style.width = pct + '%';
      if(bot.hp <= 2) botHpBar.classList.add('low');
      else botHpBar.classList.remove('low');
    }
    if(botHearts){
      if(bot.hp <= 2) botHearts.style.filter = 'brightness(1.12)';
      else if(bot.hp <= 4) botHearts.style.filter = 'brightness(1.05)';
      else botHearts.style.filter = 'none';
      if(typeof prevHp !== 'undefined') prevHp[2]=bot.hp;
    }
    const rl = document.getElementById('roundLabel');
    if(rl) {
      // Hide duplicate points label in center - TrialsHUD shows PTS large
      rl.style.display = 'none';
    }
    const timerEl = document.getElementById('timer');
    if(timerEl) {
      // In menu, show 10:00 static; in play/pause show actual countdown
      let displayLeft = timeLeft;
      if (gameState === 'menu') displayLeft = TRIAL_DURATION;
      const m = Math.floor(Math.max(0, displayLeft) / 60).toString().padStart(2, '0');
      const s = Math.floor(Math.max(0, displayLeft) % 60).toString().padStart(2, '0');
      const inner = timerEl.querySelector('.cyber-timer__inner');
      if(inner) inner.textContent = `${m}:${s}`;
      // Tint timer amber when void active
      const elapsed = TRIAL_DURATION - timeLeft;
      if (elapsed >= VOID_START_TIME && gameState === 'playing') {
        timerEl.classList.add('timer-critical');
        timerEl.classList.remove('timer-warning');
      } else if (gameState === 'playing') {
        timerEl.classList.remove('timer-critical');
      }
    }
    // Void warning in TrialsHUD only visible when active
    const warn = document.getElementById('voidWarn');
    if (warn) {
      const elapsed = TRIAL_DURATION - timeLeft;
      warn.style.opacity = (elapsed >= VOID_START_TIME && gameState === 'playing') ? '1' : '0';
    }
    // Keep P1 pointer/health/chips in sync — previously early-returned and health stayed stale
    updatePlayerCardHUD(players[0], 0);
    // Bot HUD buffs so pickup has visible feedback
    {
      const bOv=document.getElementById('botOv'), bOvF=document.getElementById('botOvF'), bOvT=document.getElementById('botOvT');
      if(bOv){ const active=bot.overcharge>0; bOv.classList.toggle('active',active); if(bOvF) bOvF.style.width=active?(bot.overcharge/240*100)+'%':'0%'; if(bOvT) bOvT.textContent=active?(bot.overcharge/60).toFixed(1)+'s':''; }
      const bSh=document.getElementById('botSh'), bShF=document.getElementById('botShF'), bShT=document.getElementById('botShT');
      if(bSh){ const active=!!bot.shield&&bot.shieldHp>0; bSh.classList.toggle('active',active); const max=bot.shieldMax||SHIELD_MAX_HP; const pct2=active?(bot.shieldHp/max*100):0; if(bShF) bShF.style.width=pct2+'%'; if(bShT) bShT.textContent=active?`${bot.shieldHp}/${max}`:''; const lab=bSh.querySelector('.chip-label'); if(lab) lab.textContent=active&&bot.shieldHp===1?'CRACK':'SHLD'; }
      const bBl=document.getElementById('botBl'), bBlF=document.getElementById('botBlF'), bBlT=document.getElementById('botBlT');
      if(bBl){ const hasDash=bot.extraDash>0, hasBoost=bot.speedBoost>0, active=hasDash||hasBoost; bBl.classList.toggle('active',active); let pctB=0, txtB=''; if(hasBoost){pctB=bot.speedBoost/180*100; txtB=(bot.speedBoost/60).toFixed(1)+'s';} else if(hasDash){pctB=100; txtB='x'+bot.extraDash;} if(bBlF) bBlF.style.width=pctB+'%'; if(bBlT) bBlT.textContent=txtB; }
      const bAmmo=document.getElementById('botAmmo'), bAmmoT=document.getElementById('botAmmoT');
      if(bAmmo&&bAmmoT){ const t=bot.ammoType||'standard'; let label='STD INF', cls='ammo-chip--standard'; if(t==='needle'){label=`NEEDLE x${bot.ammo}`; cls='ammo-chip--needle';} else if(t==='cannon'){label=`CANNON x${bot.ammo}`; cls='ammo-chip--cannon';} else if(t==='trick'){label=`TRICK x${bot.ammo}`; cls='ammo-chip--trick';} bAmmo.className=`ammo-chip ${cls}`; bAmmoT.textContent=label; }
    }
    const rlTrials = document.getElementById('roundLabel');
    if(rlTrials && gameState !== 'playing') { /* keep hidden */ }
    return;
  }
  
  const scoreP1 = document.getElementById('scoreP1');
  const scoreP2 = document.getElementById('scoreP2');
  if(scoreP1) scoreP1.textContent = scores[0];
  if(scoreP2) scoreP2.textContent = scores[1];

  const rl = document.getElementById('roundLabel');
  if(rl) {
    if(safeRadius < 900) {
      rl.textContent = `⚠ VOID ${Math.round(safeRadius)} • ROUND ${round}`;
      rl.style.color = '#d9ff7a';
      rl.style.opacity = '0.95';
    } else {
      rl.textContent = `FIRST TO ${WIN_SCORE} • ROUND ${round}`;
      rl.style.color = '';
      rl.style.opacity = '0.5';
    }
  }

  const m = Math.floor(Math.max(0, timeLeft) / 60).toString().padStart(2, '0');
  const s = Math.floor(Math.max(0, timeLeft) % 60).toString().padStart(2, '0');
  const timerEl = document.getElementById('timer');
  if(timerEl) {
    const inner = timerEl.querySelector('.cyber-timer__inner');
    if (inner) inner.textContent = `${m}:${s}`;
    else timerEl.textContent = `${m}:${s}`;
    if(safeRadius < 900) {
      timerEl.classList.add('timer-warning');
      timerEl.classList.remove('timer-critical');
    } else if(timeLeft < 10) {
      timerEl.classList.add('timer-critical');
      timerEl.classList.remove('timer-warning');
    } else {
      timerEl.classList.remove('timer-warning', 'timer-critical');
    }
  }

  // Shared per-player HUD — same for 1v1 and trials (prevents pointer/health drift)
  for(let pi = 0; pi < 2; pi++) updatePlayerCardHUD(players[pi], pi);
}

export { drawWalls, drawHazards, render, setCyberBadgeText, setCyberBadgeVariant, updatePlayerCardHUD, updateHUD };
