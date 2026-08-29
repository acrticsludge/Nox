// NEON VOID // Bot AI for Void Trials
// Behavior tree with weighted priorities

const BOT_BEHAVIORS = {
  seekPickup: { weight: 0.35 },
  engagePlayer: { weight: 0.30 },
  evadeHazard: { weight: 0.20 },
  patrol: { weight: 0.10 },
  retreat: { weight: 0.05 },
};

function distance(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.hypot(dx, dy);
}

function findNearestPickup(bot, pickups) {
  let nearest = null, minDist = Infinity;
  for(const pu of pickups) {
    const d = distance(bot.x, bot.y, pu.x, pu.y);
    if(d < minDist) { minDist = d; nearest = pu; }
  }
  return nearest ? { target: nearest, dist: minDist } : null;
}

function findNearestHazard(bot, hazards) {
  let nearest = null, minDist = Infinity;
  for(const h of hazards) {
    const hx = h.x + h.w/2, hy = h.y + h.h/2;
    const d = distance(bot.x, bot.y, hx, hy);
    if(d < minDist) { minDist = d; nearest = { hazard: h, centerX: hx, centerY: hy, dist: d }; }
  }
  return nearest;
}

function getPlayerPos() {
  // Player is always players[0] in trials
  if(typeof window !== 'undefined' && window.NOX_GAME && window.NOX_GAME.players) {
    const p = window.NOX_GAME.players[0];
    if(p && p.alive) return { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
  }
  return null;
}

function selectBehavior(bot, state) {
  const { pickups, hazards } = state;
  const player = getPlayerPos();
  const hpRatio = bot.hp / bot.maxHp;

  // Boost weights based on situation
  const weights = { ...BOT_BEHAVIORS };

  // Low HP -> retreat more
  if(hpRatio < 0.3) {
    weights.retreat = 0.4;
    weights.engagePlayer = 0.1;
    weights.seekPickup = 0.3;
  } else if(hpRatio < 0.6) {
    weights.retreat = 0.15;
    weights.seekPickup = 0.4;
  }

  // Hazard nearby -> evade
  const hazard = findNearestHazard(bot, hazards);
  if(hazard && hazard.dist < 100) {
    weights.evadeHazard = 0.5;
    weights.engagePlayer = 0.1;
    weights.seekPickup = 0.1;
  }

  // Pickup nearby -> seek
  const pickup = findNearestPickup(bot, pickups);
  if(pickup && pickup.dist < 300) {
    weights.seekPickup = Math.max(weights.seekPickup, 0.5);
  }

  // Player visible and in range -> engage
  if(player) {
    const playerDist = distance(bot.x, bot.y, player.x, player.y);
    if(playerDist < 800) {
      weights.engagePlayer = Math.max(weights.engagePlayer, 0.4);
    }
  }

  // Weighted random selection
  const total = Object.values(weights).reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for(const [name, b] of Object.entries(weights)) {
    r -= b.weight;
    if(r <= 0) return name;
  }
  return 'patrol';
}

function executeBehavior(bot, behavior, state, dt) {
  const player = getPlayerPos();
  const { pickups, hazards } = state;
  let mx = 0, my = 0, shoot = false, dash = false;

  switch(behavior) {
    case 'seekPickup': {
      const pickup = findNearestPickup(bot, pickups);
      if(pickup) {
        const dx = pickup.target.x - bot.x;
        const dy = pickup.target.y - bot.y;
        const dist = Math.hypot(dx, dy);
        if(dist > 0) { mx = dx / dist; my = dy / dist; }
      } else {
        // Fallback to patrol
        mx = Math.cos(bot.angle); my = Math.sin(bot.angle);
      }
      break;
    }
    case 'engagePlayer': {
      if(player) {
        // Predictive aim
        const bulletSpeed = 7.2;
        const travelTime = distance(bot.x, bot.y, player.x, player.y) / bulletSpeed;
        const predX = player.x + player.vx * travelTime;
        const predY = player.y + player.vy * travelTime;

        const dx = predX - bot.x;
        const dy = predY - bot.y;
        const dist = Math.hypot(dx, dy);

        if(dist > 0) {
          bot.targetAngle = Math.atan2(dy, dx);
          // Add aim error
          bot.aimError = (Math.random() - 0.5) * 0.15;
          bot.angle = bot.targetAngle + bot.aimError;
        }

        // Strafe at mid range
        if(dist > 200 && dist < 500) {
          const strafeAngle = bot.angle + Math.PI/2 * (Math.random() < 0.5 ? 1 : -1);
          mx = Math.cos(strafeAngle) * 0.7;
          my = Math.sin(strafeAngle) * 0.7;
        } else if(dist < 200) {
          // Back away
          mx = -Math.cos(bot.angle) * 0.5;
          my = -Math.sin(bot.angle) * 0.5;
        }

        // Shoot with reaction delay
        if(bot.shootCd === 0) {
          const now = Date.now();
          if(now - bot.lastShotTime >= bot.reactionDelay) {
            shoot = true;
            bot.lastShotTime = now;
            bot.reactionDelay = 80 + Math.random() * 40; // 80-120ms
          }
        }
      }
      break;
    }
    case 'evadeHazard': {
      const hazard = findNearestHazard(bot, hazards);
      if(hazard) {
        const dx = bot.x - hazard.centerX;
        const dy = bot.y - hazard.centerY;
        const dist = Math.hypot(dx, dy);
        if(dist > 0) {
          mx = dx / dist; my = dy / dist;
        }
        // Dash away if very close and dash available
        if(dist < 60 && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0)) {
          dash = true;
        }
      }
      break;
    }
    case 'patrol': {
      // Random waypoint
      if(bot.behaviorTimer <= 0 || distance(bot.x, bot.y, bot.targetX, bot.targetY) < 50) {
        bot.targetX = 100 + Math.random() * (1920 - 200);
        bot.targetY = 100 + Math.random() * (1120 - 200);
        bot.behaviorTimer = 60 + Math.random() * 120; // 1-3 seconds
      }
      bot.behaviorTimer--;
      const dx = bot.targetX - bot.x;
      const dy = bot.targetY - bot.y;
      const dist = Math.hypot(dx, dy);
      if(dist > 0) { mx = dx / dist; my = dy / dist; }
      break;
    }
    case 'retreat': {
      if(player) {
        // Move away from player
        const dx = bot.x - player.x;
        const dy = bot.y - player.y;
        const dist = Math.hypot(dx, dy);
        if(dist > 0) { mx = dx / dist; my = dy / dist; }
        // Dash away if available
        if(dist < 300 && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0)) {
          dash = true;
        }
      }
      break;
    }
  }

  // Powerup usage logic
  if(bot.shield && bot.shieldHp > 0 && bot.hp <= 4 && !bot.shieldActive) {
    // Shield activates automatically when picked up
  }

  // Use overcharge when engaging
  if(behavior === 'engagePlayer' && bot.overcharge === 0 && Math.random() < 0.01) {
    // Will pick up overcharge if available via seekPickup
  }

  return { mx, my, shoot, dash, targetAngle: bot.targetAngle };
}

function updateBotAI(bot, state, dt) {
  if(!bot.alive) return { mx: 0, my: 0, shoot: false, dash: false };

  // Decrease cooldowns
  if(bot.dashCd > 0) bot.dashCd--;
  if(bot.inv > 0) bot.inv--;
  if(bot.shootCd > 0) bot.shootCd--;
  if(bot.overcharge > 0) bot.overcharge--;
  if(bot.speedBoost > 0) bot.speedBoost--;
  if(bot.lavaCd > 0) bot.lavaCd--;
  if(bot.voidCd > 0) bot.voidCd--;

  // Dash logic
  if(bot.dash > 0) {
    bot.dash--;
    if(bot.dash === 0) bot.inv = 6;
  }

  // Select behavior every 10 frames (~166ms)
  if(!bot.behaviorTimer || bot.behaviorTimer <= 0) {
    bot.behavior = selectBehavior(bot, state);
    bot.behaviorTimer = 10 + Math.floor(Math.random() * 20); // 10-30 frames
  }
  bot.behaviorTimer--;

  return executeBehavior(bot, bot.behavior, state, dt);
}

// Export for use in game-logic.js
export { updateBotAI, selectBehavior, executeBehavior };