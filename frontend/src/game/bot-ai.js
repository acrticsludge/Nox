// NEON VOID // Bot AI for Void Trials
// Priority-based behavior selector with hysteresis, wall-aware movement, void awareness

/**
 * @typedef {Object} BotState
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} angle
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} dash
 * @property {number} dashCd
 * @property {number} inv
 * @property {number} shootCd
 * @property {number} overcharge
 * @property {boolean} shield
 * @property {number} shieldHp
 * @property {number} shieldMax
 * @property {number} speedBoost
 * @property {number} extraDash
 * @property {number} baseSpeed
 * @property {number} squish
 * @property {boolean} inSlime
 * @property {number} lavaCd
 * @property {number} voidCd
 * @property {number} slimeCd
 * @property {string} ammoType
 * @property {number} ammo
 * @property {boolean} alive
 * @property {boolean} isBot
 * @property {string} behavior
 * @property {number} behaviorCommitment
 * @property {number} targetX
 * @property {number} targetY
 * @property {number} reactionDelay
 * @property {number} lastShotTime
 * @property {number} aimError
 */

/**
 * @typedef {Object} GameState
 * @property {Object} player
 * @property {number} player.x
 * @property {number} player.y
 * @property {number} player.vx
 * @property {number} player.vy
 * @property {number} player.dash
 * @property {number} player.inv
 * @property {boolean} player.alive
 * @property {Array<Object>} pickups
 * @property {Array<Object>} hazards
 * @property {Array<Object>} walls
 * @property {Object|null} voidRect
 * @property {number} safeRadius
 * @property {string} gameMode
 * @property {Function} wallsCollide
 */

/**
 * @typedef {Object} BotAIOutput
 * @property {number} mx
 * @property {number} my
 * @property {boolean} shoot
 * @property {boolean} dash
 * @property {number} targetAngle
 * @property {boolean} [activateShield]
 * @property {boolean} [activateOvercharge]
 * @property {boolean} [useBlinkDash]
 */

// Configuration — all tunable thresholds in one place
const BOT_CONFIG = {
  // Behavior timing
  BEHAVIOR_COMMITMENT_MIN: 60,
  BEHAVIOR_COMMITMENT_MAX: 120,
  BEHAVIOR_RESELECT_INTERVAL: 10,

  // Threat thresholds
  CRITICAL_HP_RATIO: 0.25,
  HAZARD_EVADE_RANGE: 100,
  HAZARD_DASH_RANGE: 60,
  VOID_AVOID_RANGE: 100,

  // Engagement ranges
  ENGAGE_RANGE: 800,
  ENGAGE_STRAFE_MIN: 200,
  ENGAGE_STRAFE_MAX: 500,
  ENGAGE_BACKOFF_RANGE: 200,
  ENGAGE_DASH_RANGE: 350,
  ENGAGE_DASH_PROBABILITY: 0.1,

  // Pickup ranges
  PICKUP_SEEK_RANGE: 300,
  PICKUP_PRIORITY_BOOST: 0.5,

  // Retreat
  RETREAT_DASH_RANGE: 300,
  RETREAT_DASH_PROBABILITY: 0.05,

  // Patrol
  PATROL_WAYPOINT_REACH: 50,
  PATROL_TIMER_MIN: 60,
  PATROL_TIMER_MAX: 180,

  // Aiming
  BASE_REACTION_DELAY_MIN: 80,
  BASE_REACTION_DELAY_MAX: 120,
  BASE_AIM_ERROR: 0.15,
  BULLET_SPEED: 7.2,

  // Difficulty multipliers
  DIFFICULTY: {
    easy:   { reactionDelay: 1.5, aimError: 2.0, commitment: 1.5, engageWeight: 0.7 },
    normal: { reactionDelay: 1.0, aimError: 1.0, commitment: 1.0, engageWeight: 1.0 },
    hard:   { reactionDelay: 0.7, aimError: 0.7, commitment: 0.7, engageWeight: 1.3 },
  },

  // Powerup thresholds
  SHIELD_ACTIVATE_HP: 4,
  OVERCHARGE_ENGAGE_RANGE: 400,
  BLINK_DODGE_RANGE: 60,
  BLINK_CLOSE_RANGE: 350,

  // Arena bounds (trials mode)
  TRIALS_W: 1920,
  TRIALS_H: 1120,

  // Movement
  LOOKAHEAD_DISTANCE: 36,
  LOOKAHEAD_STEPS: 3,
};

// Legacy behavior base weights (used for scoring reference)
const BOT_BEHAVIOR_BASE_WEIGHTS = {
  seekPickup: 0.35,
  engagePlayer: 0.30,
  evadeHazard: 0.20,
  patrol: 0.10,
  retreat: 0.05,
  avoidVoid: 0.00,
};

// --- Helper functions ---

/**
 * Squared distance for comparisons (avoids sqrt)
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

/**
 * Actual distance (uses sqrt)
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @returns {number}
 */
function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * @param {BotState} bot
 * @param {Array<Object>} pickups
 * @returns {{target: Object, dist: number, dist2: number}|null}
 */
function findNearestPickup(bot, pickups) {
  let nearest = null, minDist2 = Infinity;
  for(const pu of pickups) {
    const d2 = dist2(bot.x, bot.y, pu.x, pu.y);
    if(d2 < minDist2) { minDist2 = d2; nearest = pu; }
  }
  return nearest ? { target: nearest, dist: Math.sqrt(minDist2), dist2: minDist2 } : null;
}

/**
 * @param {BotState} bot
 * @param {Array<Object>} hazards
 * @returns {{hazard: Object, centerX: number, centerY: number, dist: number, dist2: number}|null}
 */
function findNearestHazard(bot, hazards) {
  let nearest = null, minDist2 = Infinity;
  for(const h of hazards) {
    const hx = h.x + h.w/2, hy = h.y + h.h/2;
    const d2 = dist2(bot.x, bot.y, hx, hy);
    if(d2 < minDist2) { minDist2 = d2; nearest = { hazard: h, centerX: hx, centerY: hy, dist: Math.sqrt(d2), dist2: d2 }; }
  }
  return nearest;
}

/**
 * Calculate distance to safe zone (void avoidance)
 * @param {BotState} bot
 * @param {GameState} state
 * @returns {number} Distance to safe zone edge (0 if inside)
 */
function getDistanceToSafeZone(bot, state) {
  if (!state.voidRect || state.safeRadius >= 900) return 0;
  const { voidRect, safeRadius } = state;
  // Rectangular void (trials mode)
  if (voidRect) {
    const cx = voidRect.x + voidRect.w / 2;
    const cy = voidRect.y + voidRect.h / 2;
    const hw = voidRect.w / 2;
    const hh = voidRect.h / 2;
    const dx = Math.max(Math.abs(bot.x - cx) - hw, 0);
    const dy = Math.max(Math.abs(bot.y - cy) - hh, 0);
    return Math.hypot(dx, dy);
  }
  // Circular void (1v1 mode)
  const vcX = state.gameMode === 'trials' ? BOT_CONFIG.TRIALS_W / 2 : 480;
  const vcY = state.gameMode === 'trials' ? BOT_CONFIG.TRIALS_H / 2 : 280;
  const d = distance(bot.x, bot.y, vcX, vcY);
  return Math.max(0, d - safeRadius);
}

/**
 * Wall-aware movement: raycast lookahead to avoid sticking
 * @param {BotState} bot
 * @param {{mx:number, my:number}} desired
 * @param {GameState} state
 * @returns {{mx:number, my:number}} Safe movement vector
 */
function getSafeMovementVector(bot, desired, state) {
  const { wallsCollide } = state;
  const lookahead = BOT_CONFIG.LOOKAHEAD_DISTANCE;
  const steps = BOT_CONFIG.LOOKAHEAD_STEPS;
  const stepSize = lookahead / steps;
  const r = 16; // PLAYER_R

  // If no movement desired, return zero
  if (desired.mx === 0 && desired.my === 0) return { mx: 0, my: 0 };

  // Sample points ahead along desired vector
  for (let i = 1; i <= steps; i++) {
    const testX = bot.x + desired.mx * stepSize * i;
    const testY = bot.y + desired.my * stepSize * i;
    if (wallsCollide(testX, testY, r)) {
      // Collision predicted — try perpendicular slide vectors
      const perp1 = { mx: -desired.my, my: desired.mx };
      const perp2 = { mx: desired.my, my: -desired.mx };

      let blocked1 = false, blocked2 = false;
      for (let j = 1; j <= steps; j++) {
        const slideDist = stepSize * j;
        if (!blocked1 && wallsCollide(bot.x + perp1.mx * slideDist, bot.y + perp1.my * slideDist, r)) blocked1 = true;
        if (!blocked2 && wallsCollide(bot.x + perp2.mx * slideDist, bot.y + perp2.my * slideDist, r)) blocked2 = true;
        if (blocked1 && blocked2) break;
      }

      if (!blocked1) return perp1;
      if (!blocked2) return perp2;

      // Stuck — return zero
      return { mx: 0, my: 0 };
    }
  }

  return desired;
}

// --- Behavior Scoring (Priority-based, independent) ---

/**
 * @param {BotState} bot
 * @param {GameState} state
 * @returns {number} Score for seekPickup behavior
 */
function scoreSeekPickup(bot, state) {
  const pickup = findNearestPickup(bot, state.pickups);
  if (!pickup) return 0;
  if (pickup.dist > BOT_CONFIG.PICKUP_SEEK_RANGE) return 0;

  let score = BOT_BEHAVIOR_BASE_WEIGHTS.seekPickup * 100;

  // Closer = higher priority
  score += (1 - pickup.dist / BOT_CONFIG.PICKUP_SEEK_RANGE) * 50;

  // Shield/overcharge pickups get priority when needed
  if (pickup.target.kind === 'shield' && bot.hp <= BOT_CONFIG.SHIELD_ACTIVATE_HP && !bot.shield) score += 100;
  if (pickup.target.kind === 'overcharge' && bot.hp > 8 && !bot.overcharge) score += 80;
  if (pickup.target.kind === 'heal' && bot.hp < bot.maxHp) score += 60;

  return score;
}

/**
 * @param {BotState} bot
 * @param {GameState} state
 * @returns {number} Score for engagePlayer behavior
 */
function scoreEngagePlayer(bot, state) {
  const player = state.player;
  if (!player || !player.alive) return 0;

  const playerDist = distance(bot.x, bot.y, player.x, player.y);
  if (playerDist > BOT_CONFIG.ENGAGE_RANGE) return 0;

  let score = BOT_BEHAVIOR_BASE_WEIGHTS.engagePlayer * 100;

  // Closer = higher (but not too close)
  if (playerDist < BOT_CONFIG.ENGAGE_BACKOFF_RANGE) score *= 0.5;
  else if (playerDist < BOT_CONFIG.ENGAGE_STRAFE_MAX) score += (1 - playerDist / BOT_CONFIG.ENGAGE_STRAFE_MAX) * 30;

  // HP ratio modifier
  const hpRatio = bot.hp / bot.maxHp;
  if (hpRatio > 0.6) score *= 1.2;
  else if (hpRatio < 0.3) score *= 0.3;

  // Difficulty modifier
  const diff = BOT_CONFIG.DIFFICULTY.normal; // TODO: pass difficulty
  score *= diff.engageWeight;

  return score;
}

/**
 * @param {BotState} bot
 * @param {GameState} state
 * @returns {number} Score for evadeHazard behavior
 */
function scoreEvadeHazard(bot, state) {
  const hazard = findNearestHazard(bot, state.hazards);
  if (!hazard) return 0;
  if (hazard.dist > BOT_CONFIG.HAZARD_EVADE_RANGE) return 0;

  // Immediate contact = maximum priority
  if (hazard.dist < BOT_CONFIG.HAZARD_DASH_RANGE) return 1000;

  let score = BOT_BEHAVIOR_BASE_WEIGHTS.evadeHazard * 100;
  score += (1 - hazard.dist / BOT_CONFIG.HAZARD_EVADE_RANGE) * 200;

  // Lava active = higher urgency
  if (hazard.hazard.kind === 'lava') {
    const mod = hazard.hazard.t % 300;
    const isActive = mod >= 120 && mod < 228;
    if (isActive) score *= 1.5;
  }

  return score;
}

/**
 * @param {BotState} bot
 * @param {GameState} state
 * @returns {number} Score for avoidVoid behavior
 */
function scoreAvoidVoid(bot, state) {
  const distToSafe = getDistanceToSafeZone(bot, state);
  if (distToSafe === 0) return 0;

  // Outside safe zone = critical priority
  if (distToSafe > 0) return 1000 + distToSafe * 2;

  return 0;
}

/**
 * @param {BotState} bot
 * @param {GameState} state
 * @returns {number} Score for retreat behavior
 */
function scoreRetreat(bot, state) {
  const hpRatio = bot.hp / bot.maxHp;
  if (hpRatio >= BOT_CONFIG.CRITICAL_HP_RATIO) return 0;

  let score = BOT_BEHAVIOR_BASE_WEIGHTS.retreat * 100;
  score += (1 - hpRatio / BOT_CONFIG.CRITICAL_HP_RATIO) * 300;

  // Player nearby = more retreat
  const player = state.player;
  if (player && player.alive) {
    const playerDist = distance(bot.x, bot.y, player.x, player.y);
    if (playerDist < BOT_CONFIG.RETREAT_DASH_RANGE) score += 100;
  }

  return score;
}

/**
 * @param {BotState} _bot
 * @param {GameState} _state
 * @returns {number} Score for patrol behavior
 */
function scorePatrol(_bot, _state) {
  // Baseline patrol score — only chosen when nothing else is pressing
  return BOT_BEHAVIOR_BASE_WEIGHTS.patrol * 100;
}

/**
 * Priority-based behavior selection with hysteresis
 * @param {BotState} bot
 * @param {GameState} state
 * @returns {string} Selected behavior name
 */
function selectBehavior(bot, state) {
  // Calculate all scores independently (no cross-mutation)
  const scores = {
    seekPickup: scoreSeekPickup(bot, state),
    engagePlayer: scoreEngagePlayer(bot, state),
    evadeHazard: scoreEvadeHazard(bot, state),
    avoidVoid: scoreAvoidVoid(bot, state),
    retreat: scoreRetreat(bot, state),
    patrol: scorePatrol(bot, state),
  };

  // Critical threat early-exit (bypasses hysteresis)
  if (scores.avoidVoid > 500) return 'avoidVoid';
  if (scores.evadeHazard > 500) return 'evadeHazard';
  if (bot.hp / bot.maxHp < BOT_CONFIG.CRITICAL_HP_RATIO && scores.retreat > 200) return 'retreat';

  // Hysteresis: keep current behavior if committed and in top 2
  if (bot.behaviorCommitment > 0) {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const top2 = [sorted[0][0], sorted[1][0]];
    if (top2.includes(bot.behavior)) {
      return bot.behavior;
    }
  }

  // Select highest scoring behavior
  let bestBehavior = 'patrol';
  let bestScore = -1;
  for (const [name, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestBehavior = name;
    }
  }

  return bestBehavior;
}

// --- Behavior Execution ---

/**
 * Execute avoidVoid behavior
 * @param {BotState} bot
 * @param {GameState} state
 * @returns {{mx:number, my:number, shoot:boolean, dash:boolean, targetAngle:number, activateShield?:boolean, activateOvercharge?:boolean, useBlinkDash?:boolean}}
 */
function executeAvoidVoid(bot, state) {
  const { voidRect, gameMode } = state;
  let mx = 0, my = 0, dash = false;

  if (voidRect) {
    // Rectangular void - move toward nearest safe edge
    const cx = voidRect.x + voidRect.w / 2;
    const cy = voidRect.y + voidRect.h / 2;
    const hw = voidRect.w / 2;
    const hh = voidRect.h / 2;

    // Find nearest safe zone edge
    const dx = bot.x - cx;
    const dy = bot.y - cy;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);

    if (absDx - hw > absDy - hh) {
      // Closer to left/right edge
      mx = dx > 0 ? 1 : -1;
    } else {
      // Closer to top/bottom edge
      my = dy > 0 ? 1 : -1;
    }
  } else {
    // Circular void (1v1) - move toward center
    const vcX = gameMode === 'trials' ? BOT_CONFIG.TRIALS_W / 2 : 480;
    const vcY = gameMode === 'trials' ? BOT_CONFIG.TRIALS_H / 2 : 280;
    const dx = vcX - bot.x;
    const dy = vcY - bot.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) { mx = dx / dist; my = dy / dist; }
  }

  // Dash toward safety if very close to void edge
  const distToSafe = getDistanceToSafeZone(bot, state);
  if (distToSafe > 0 && distToSafe < BOT_CONFIG.VOID_AVOID_RANGE && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0)) {
    dash = true;
  }

  // No shooting while fleeing void
  return { mx, my, shoot: false, dash, targetAngle: bot.angle };
}

/**
 * Execute seekPickup behavior
 */
function executeSeekPickup(bot, state) {
  const pickup = findNearestPickup(bot, state.pickups);
  let mx = 0, my = 0;

  if (pickup) {
    const dx = pickup.target.x - bot.x;
    const dy = pickup.target.y - bot.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) { mx = dx / dist; my = dy / dist; }
  } else {
    // Fallback to patrol direction
    mx = Math.cos(bot.angle); my = Math.sin(bot.angle);
  }

  return { mx, my, shoot: false, dash: false, targetAngle: bot.angle };
}

/**
 * Execute engagePlayer behavior with predictive aim
 */
function executeEngagePlayer(bot, state) {
  const player = state.player;
  let mx = 0, my = 0, shoot = false, dash = false;

  if (!player || !player.alive) {
    return { mx, my, shoot, dash, targetAngle: bot.angle };
  }

  // Use LIVE player velocity (updated every frame in game-logic)
  const bulletSpeed = BOT_CONFIG.BULLET_SPEED;
  const travelTime = distance(bot.x, bot.y, player.x, player.y) / bulletSpeed;

  // Account for dash speed boost and slime slow
  let playerVx = player.vx || 0;
  let playerVy = player.vy || 0;
  if (player.dash > 0) {
    playerVx *= 2.35;
    playerVy *= 2.35;
  }
  // Note: slime slow would be on bot, not player (player.inSlime not tracked in state)

  const predX = player.x + playerVx * (travelTime + bot.reactionDelay / 1000);
  const predY = player.y + playerVy * (travelTime + bot.reactionDelay / 1000);

  const dx = predX - bot.x;
  const dy = predY - bot.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 0) {
    bot.targetAngle = Math.atan2(dy, dx);

    // Aim error: persist for burst (overcharge), re-roll for single shots
    if (bot.overcharge > 0 && bot.lastBurstAimError !== undefined) {
      bot.aimError = bot.lastBurstAimError;
    } else {
      bot.aimError = (Math.random() - 0.5) * BOT_CONFIG.BASE_AIM_ERROR;
      if (bot.overcharge > 0) bot.lastBurstAimError = bot.aimError;
    }
    bot.angle = bot.targetAngle + bot.aimError;
  }

  // Movement: strafe at mid range, back away at close range
  if (dist > BOT_CONFIG.ENGAGE_BACKOFF_RANGE && dist < BOT_CONFIG.ENGAGE_STRAFE_MAX) {
    const strafeAngle = bot.angle + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
    mx = Math.cos(strafeAngle) * 0.7;
    my = Math.sin(strafeAngle) * 0.7;

    // Dash to close distance
    if (dist > BOT_CONFIG.ENGAGE_DASH_RANGE && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0) && Math.random() < BOT_CONFIG.ENGAGE_DASH_PROBABILITY) {
      dash = true;
    }
  } else if (dist < BOT_CONFIG.ENGAGE_BACKOFF_RANGE) {
    // Back away
    mx = -Math.cos(bot.angle) * 0.5;
    my = -Math.sin(bot.angle) * 0.5;
  } else if (dist > BOT_CONFIG.ENGAGE_STRAFE_MAX) {
    // Close distance
    mx = Math.cos(bot.angle);
    my = Math.sin(bot.angle);
  }

  // Shoot with reaction delay (ms-based)
  if (bot.shootCd === 0) {
    const now = Date.now();
    if (now - bot.lastShotTime >= bot.reactionDelay) {
      shoot = true;
      bot.lastShotTime = now;
      // Reaction delay scales with difficulty
      const baseDelay = BOT_CONFIG.BASE_REACTION_DELAY_MIN + Math.random() * (BOT_CONFIG.BASE_REACTION_DELAY_MAX - BOT_CONFIG.BASE_REACTION_DELAY_MIN);
      bot.reactionDelay = baseDelay;
    }
  }

  // Powerup activation: overcharge when engaging at close range
  let activateOvercharge = false;
  if (dist < BOT_CONFIG.OVERCHARGE_ENGAGE_RANGE && bot.overcharge === 0 && !bot.shield) {
    activateOvercharge = true;
  }

  return { mx, my, shoot, dash, targetAngle: bot.targetAngle, activateOvercharge };
}

/**
 * Execute evadeHazard behavior
 */
function executeEvadeHazard(bot, state) {
  const hazard = findNearestHazard(bot, state.hazards);
  let mx = 0, my = 0, dash = false;

  if (hazard) {
    const dx = bot.x - hazard.centerX;
    const dy = bot.y - hazard.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      mx = dx / dist; my = dy / dist;
    }

    // Dash away if very close
    if (dist < BOT_CONFIG.HAZARD_DASH_RANGE && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0)) {
      dash = true;
    }
  }

  return { mx, my, shoot: false, dash, targetAngle: bot.angle };
}

/**
 * Execute patrol behavior
 */
function executePatrol(bot, _state) {
  let mx = 0, my = 0;

  // Random waypoint using arena bounds from config
  if (bot.behaviorTimer <= 0 || distance(bot.x, bot.y, bot.targetX, bot.targetY) < BOT_CONFIG.PATROL_WAYPOINT_REACH) {
    const margin = 100;
    bot.targetX = margin + Math.random() * (BOT_CONFIG.TRIALS_W - 2 * margin);
    bot.targetY = margin + Math.random() * (BOT_CONFIG.TRIALS_H - 2 * margin);
    bot.behaviorTimer = BOT_CONFIG.PATROL_TIMER_MIN + Math.floor(Math.random() * (BOT_CONFIG.PATROL_TIMER_MAX - BOT_CONFIG.PATROL_TIMER_MIN));
  }
  bot.behaviorTimer--;

  const dx = bot.targetX - bot.x;
  const dy = bot.targetY - bot.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 0) { mx = dx / dist; my = dy / dist; }

  return { mx, my, shoot: false, dash: false, targetAngle: bot.angle };
}

/**
 * Execute retreat behavior
 */
function executeRetreat(bot, state) {
  const player = state.player;
  let mx = 0, my = 0, dash = false;

  if (player && player.alive) {
    const dx = bot.x - player.x;
    const dy = bot.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) { mx = dx / dist; my = dy / dist; }

    // Dash away
    if (dist < BOT_CONFIG.RETREAT_DASH_RANGE && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0)) {
      dash = true;
    }
  }

  return { mx, my, shoot: false, dash, targetAngle: bot.angle };
}

/**
 * Dispatch to behavior-specific execution
 * @param {BotState} bot
 * @param {string} behavior
 * @param {GameState} state
 * @returns {BotAIOutput}
 */
function executeBehavior(bot, behavior, state) {
  switch (behavior) {
    case 'avoidVoid': return executeAvoidVoid(bot, state);
    case 'seekPickup': return executeSeekPickup(bot, state);
    case 'engagePlayer': return executeEngagePlayer(bot, state);
    case 'evadeHazard': return executeEvadeHazard(bot, state);
    case 'patrol': return executePatrol(bot, state);
    case 'retreat': return executeRetreat(bot, state);
    default: return executePatrol(bot, state);
  }
}

// --- Main Update Loop ---

/**
 * Main bot AI update - called once per frame
 * @param {BotState} bot
 * @param {GameState} state
 * @param {number} dt - Delta time in frames (default 1)
 * @returns {BotAIOutput}
 */
function updateBotAI(bot, state, dt = 1) {
  if (!bot.alive) return { mx: 0, my: 0, shoot: false, dash: false, targetAngle: bot.angle };

  // Decrease cooldowns (frame-based)
  if (bot.dashCd > 0) bot.dashCd -= dt;
  if (bot.inv > 0) bot.inv -= dt;
  if (bot.shootCd > 0) bot.shootCd -= dt;
  if (bot.overcharge > 0) bot.overcharge -= dt;
  if (bot.speedBoost > 0) bot.speedBoost -= dt;
  if (bot.lavaCd > 0) bot.lavaCd -= dt;
  if (bot.voidCd > 0) bot.voidCd -= dt;
  if (bot.slimeCd > 0) bot.slimeCd -= dt;

  // Dash logic
  if (bot.dash > 0) {
    bot.dash -= dt;
    if (bot.dash <= 0) { bot.dash = 0; bot.inv = 6; }
  }

  // Clear burst aim error when overcharge ends
  if (bot.overcharge <= 0) {
    bot.lastBurstAimError = undefined;
  }

  // Behavior selection with commitment
  if (bot.behaviorCommitment <= 0) {
    bot.behavior = selectBehavior(bot, state);
    const min = BOT_CONFIG.BEHAVIOR_COMMITMENT_MIN;
    const max = BOT_CONFIG.BEHAVIOR_COMMITMENT_MAX;
    bot.behaviorCommitment = min + Math.floor(Math.random() * (max - min + 1));
  } else {
    bot.behaviorCommitment -= dt;
  }

  // Execute behavior
  let output = executeBehavior(bot, bot.behavior, state);

  // Apply wall-aware movement
  output = getSafeMovementVector(bot, output, state);

  // Powerup activation logic (strategic, not passive)
  // Shield: auto-activate when low HP and taking damage
  if (bot.shield && bot.shieldHp > 0 && bot.hp <= BOT_CONFIG.SHIELD_ACTIVATE_HP && bot.inv <= 0) {
    // Check if we're in hazard or being shot at (approximate via recent damage)
    output.activateShield = true;
  }

  // Blink (extra dash): use for dodging or closing
  if (bot.extraDash > 0) {
    const hazard = findNearestHazard(bot, state.hazards);
    const player = state.player;

    // Dodge hazard
    if (hazard && hazard.dist < BOT_CONFIG.BLINK_DODGE_RANGE && bot.dash === 0) {
      output.useBlinkDash = true;
      output.dash = true;
    }
    // Close distance when engaging
    else if (bot.behavior === 'engagePlayer' && player && player.alive) {
      const playerDist = distance(bot.x, bot.y, player.x, player.y);
      if (playerDist > BOT_CONFIG.BLINK_CLOSE_RANGE && bot.dash === 0) {
        output.useBlinkDash = true;
        output.dash = true;
      }
    }
  }

  return output;
}

// Export for use in game-logic.js and game-sim.js
export { updateBotAI, selectBehavior, executeBehavior, getSafeMovementVector, BOT_CONFIG };