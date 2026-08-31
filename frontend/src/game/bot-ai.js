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
 * @property {number} strafeDir - -1 or +1, set when entering engagePlayer
 * @property {number} lastBurstAimError - persisted aim error for overcharge burst
 * @property {string} lastBehavior - track behavior transitions
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
 * @property {Array<Object>} bullets - Player bullets (owner !== bot.id)
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
  BEHAVIOR_COMMITMENT_MIN: 120,
  BEHAVIOR_COMMITMENT_MAX: 240,
  BEHAVIOR_RESELECT_INTERVAL: 10,

  // Threat thresholds
  CRITICAL_HP_RATIO: 0.25,
  HAZARD_EVADE_RANGE: 200,
  HAZARD_DASH_RANGE: 100,
  VOID_AVOID_RANGE: 100,

  // Engagement ranges
  ENGAGE_RANGE: 2000,  // Increased from 1200 - always engage if player alive
  ENGAGE_STRAFE_MIN: 150,
  ENGAGE_STRAFE_MAX: 300,
  ENGAGE_BACKOFF_RANGE: 150,
  ENGAGE_DASH_RANGE: 250,
  ENGAGE_DASH_PROBABILITY: 0.3,

  // Pickup ranges
  PICKUP_SEEK_RANGE: 500,
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
  BASE_AIM_ERROR: 0.08,
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
  BULLET_DODGE_RANGE: 120,

  // Arena bounds (trials mode)
  TRIALS_W: 1920,
  TRIALS_H: 1120,

  // Movement
  LOOKAHEAD_DISTANCE: 36,
  LOOKAHEAD_STEPS: 3,
};

// Legacy behavior base weights (used for scoring reference)
const BOT_BEHAVIOR_BASE_WEIGHTS = {
  seekPickup: 0.40,
  engagePlayer: 0.60,
  evadeHazard: 0.35,
  patrol: 0.05,
  retreat: 0.20,
  avoidVoid: 0.50,
};

// --- Helper functions ---

/**
 * Quantize angle to 8-directional (WASD + diagonals) for fair movement
 * @param {number} angle - Angle in radians
 * @returns {{mx:number, my:number}} Normalized 8-direction vector
 */
function quantizeTo8Dir(angle) {
  // Snap to nearest 45-degree increment (8 directions)
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { mx: Math.cos(snapped), my: Math.sin(snapped) };
}

/**
 * Check line of sight between bot and target (raycast through walls)
 * @param {number} x1 - Bot x
 * @param {number} y1 - Bot y
 * @param {number} x2 - Target x
 * @param {number} y2 - Target y
 * @param {Function} wallsCollide - Wall collision function
 * @returns {boolean} True if clear line of sight
 */
function hasLineOfSight(x1, y1, x2, y2, wallsCollide) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return true;
  
  const steps = Math.ceil(dist / 16); // Step every 16px (player radius)
  const stepX = dx / steps;
  const stepY = dy / steps;
  
  for (let i = 1; i < steps; i++) {
    const testX = x1 + stepX * i;
    const testY = y1 + stepY * i;
    if (wallsCollide(testX, testY, 16)) return false;
  }
  return true;
}

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
 * @param {{mx:number, my:number}} desired - Normalized direction vector (magnitude 1)
 * @param {GameState} state
 * @returns {{mx:number, my:number}} Safe movement vector (normalized)
 */
function getSafeMovementVector(bot, desired, state) {
  const { wallsCollide } = state;
  const lookahead = BOT_CONFIG.LOOKAHEAD_DISTANCE;
  const steps = BOT_CONFIG.LOOKAHEAD_STEPS;
  const stepSize = lookahead / steps;
  const r = 16; // PLAYER_R

  // If no movement desired, return zero
  if (desired.mx === 0 && desired.my === 0) return { mx: 0, my: 0 };

  // Normalize input (should already be normalized, but ensure)
  const mag = Math.hypot(desired.mx, desired.my);
  const nx = desired.mx / mag;
  const ny = desired.my / mag;

  // Sample points ahead along desired vector
  for (let i = 1; i <= steps; i++) {
    const testX = bot.x + nx * stepSize * i;
    const testY = bot.y + ny * stepSize * i;
    if (wallsCollide(testX, testY, r)) {
      // Collision predicted — try perpendicular slide vectors
      const perp1 = { mx: -ny, my: nx };
      const perp2 = { mx: ny, my: -nx };

      let blocked1 = false, blocked2 = false;
      for (let j = 1; j <= steps; j++) {
        const slideDist = stepSize * j;
        if (!blocked1 && wallsCollide(bot.x + perp1.mx * slideDist, bot.y + perp1.my * slideDist, r)) blocked1 = true;
        if (!blocked2 && wallsCollide(bot.x + perp2.mx * slideDist, bot.y + perp2.my * slideDist, r)) blocked2 = true;
        if (blocked1 && blocked2) break;
      }

      if (!blocked1) return perp1;
      if (!blocked2) return perp2;

      // Stuck — try opposite direction (back away)
      const back = { mx: -nx, my: -ny };
      let backBlocked = false;
      for (let j = 1; j <= steps; j++) {
        const slideDist = stepSize * j;
        if (wallsCollide(bot.x + back.mx * slideDist, bot.y + back.my * slideDist, r)) { backBlocked = true; break; }
      }
      if (!backBlocked) return back;

      // Completely stuck — return zero
      return { mx: 0, my: 0 };
    }
  }

  return { mx: nx, my: ny };
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
  if (pickup.target.kind === 'shield' && bot.hp <= BOT_CONFIG.SHIELD_ACTIVATE_HP && !bot.shield) score += 200;
  if (pickup.target.kind === 'overcharge' && bot.hp > 8 && !bot.overcharge) score += 150;
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
    const timeToActive = isActive ? 0 : (120 - (mod % 120));
    if (isActive) {
      score *= 1.5;
    } else if (timeToActive < 120) {
      // Lava activating within 2 seconds - start avoiding early
      score *= 1.3;
    }
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

  // Minimum engage score floor - ensures hunting when player alive
  if (state.player && state.player.alive) {
    scores.engagePlayer = Math.max(scores.engagePlayer, 200);
  }

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

  // Set strafe direction when entering engagePlayer
  if (bestBehavior === 'engagePlayer' && bot.behavior !== 'engagePlayer') {
    bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }
  // Clear strafeDir when leaving engagePlayer
  if (bot.behavior === 'engagePlayer' && bestBehavior !== 'engagePlayer') {
    bot.strafeDir = 0;
  }

  // Track behavior for aim error stability
  bot.lastBehavior = bot.behavior;

  return bestBehavior;
}

/**
 * Compute dodge vector for incoming player bullets
 * @param {BotState} bot
 * @param {Array<Object>} bullets - Player bullets (owner !== bot.id)
 * @returns {{mx:number, my:number, dist:number}|null} Dodge vector (normalized) and distance to closest threat
 */
function computeBulletDodge(bot, bullets) {
  if (!bullets || bullets.length === 0) return null;

  const botR = 16; // PLAYER_R
  let closestThreat = null;
  let closestDist = Infinity;
  let dodgeX = 0, dodgeY = 0;

  for (const bullet of bullets) {
    // Only consider bullets moving towards bot
    const dx = bot.x - bullet.x;
    const dy = bot.y - bullet.y;
    const dist = Math.hypot(dx, dy);
    
    // Bullet velocity
    const bvx = bullet.vx || 0;
    const bvy = bullet.vy || 0;
    const bulletSpeed = Math.hypot(bvx, bvy);
    
    if (bulletSpeed === 0) continue;
    
    // Project bullet path: will it hit bot?
    // Time to closest approach
    const dot = dx * bvx + dy * bvy;
    if (dot <= 0) continue; // Bullet moving away
    
    const tca = dot / bulletSpeed; // Time to closest approach
    if (tca < 0 || tca > 60) continue; // Too far in future (60 frames = 1 second)
    
    // Perpendicular distance from bullet path to bot center
    const projX = bullet.x + bvx * tca;
    const projY = bullet.y + bvy * tca;
    const perpDist = Math.hypot(bot.x - projX, bot.y - projY);
    
    if (perpDist < botR + 8) { // Bullet will hit or pass very close (8px margin)
      if (dist < closestDist) {
        closestDist = dist;
        closestThreat = bullet;
        // Dodge perpendicular to bullet velocity
        const dodgeMag = Math.hypot(-bvy, bvx);
        if (dodgeMag > 0) {
          dodgeX = -bvy / dodgeMag;
          dodgeY = bvx / dodgeMag;
          // Prefer dodge direction that moves away from bullet source
          const toBulletX = bullet.x - bot.x;
          const toBulletY = bullet.y - bot.y;
          const dot2 = dodgeX * toBulletX + dodgeY * toBulletY;
          if (dot2 > 0) { dodgeX = -dodgeX; dodgeY = -dodgeY; }
        }
      }
    }
  }

  if (closestThreat) {
    const q = quantizeTo8Dir(Math.atan2(dodgeY, dodgeX));
    return { mx: q.mx, my: q.my, dist: closestDist };
  }
  return null;
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

    let moveAngle;
    if (absDx - hw > absDy - hh) {
      // Closer to left/right edge
      moveAngle = dx > 0 ? 0 : Math.PI;
    } else {
      // Closer to top/bottom edge
      moveAngle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const q = quantizeTo8Dir(moveAngle);
    mx = q.mx; my = q.my;
  } else {
    // Circular void (1v1) - move toward center
    const vcX = gameMode === 'trials' ? BOT_CONFIG.TRIALS_W / 2 : 480;
    const vcY = gameMode === 'trials' ? BOT_CONFIG.TRIALS_H / 2 : 280;
    const dx = vcX - bot.x;
    const dy = vcY - bot.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      const q = quantizeTo8Dir(Math.atan2(dy, dx));
      mx = q.mx; my = q.my;
    }
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
    if (dist > 0) {
      const q = quantizeTo8Dir(Math.atan2(dy, dx));
      mx = q.mx; my = q.my;
    }
  } else {
    // Fallback to patrol direction
    const q = quantizeTo8Dir(bot.angle);
    mx = q.mx; my = q.my;
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

  // Line of sight check - don't engage through walls
  const canSeePlayer = hasLineOfSight(bot.x, bot.y, player.x, player.y, state.wallsCollide);
  if (!canSeePlayer) {
    // Player not visible - don't engage, let other behaviors handle it
    return { mx, my, shoot: false, dash: false, targetAngle: bot.angle };
  }

  // Use LIVE player velocity (updated every frame in game-logic)
  const bulletSpeed = BOT_CONFIG.BULLET_SPEED;
  const travelTime = distance(bot.x, bot.y, player.x, player.y) / bulletSpeed;

  // Account for dash speed boost and slime slow
  let playerVx = player.vx || 0;
  let playerVy = player.vy || 0;
  const wasDashing = bot.lastPlayerDash > 0;
  const isDashing = player.dash > 0;
  if (isDashing) {
    playerVx *= 2.35;
    playerVy *= 2.35;
  }
  bot.lastPlayerDash = isDashing ? 1 : 0;

  // Cap prediction time to prevent wild aim at long range
  const maxPredictionTime = 0.5; // Max 0.5 seconds prediction
  const cappedTravelTime = Math.min(travelTime, maxPredictionTime);

  const predX = player.x + playerVx * (cappedTravelTime + bot.reactionDelay / 1000);
  const predY = player.y + playerVy * (cappedTravelTime + bot.reactionDelay / 1000);

  const dx = predX - bot.x;
  const dy = predY - bot.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 0) {
    bot.targetAngle = Math.atan2(dy, dx);

    // Aim error: ONLY re-roll when:
    // 1. Just switched TO engagePlayer (lastBehavior != 'engagePlayer')
    // 2. Overcharge just activated
    // 3. Player started dashing (velocity spike)
    const behaviorJustSwitched = bot.lastBehavior !== 'engagePlayer';
    const overchargeJustActivated = bot.overcharge > 0 && bot.lastBurstAimError === undefined;
    const playerJustDashed = isDashing && !wasDashing;
    const shouldRerollAim = behaviorJustSwitched || overchargeJustActivated || playerJustDashed;

    if (bot.overcharge > 0 && bot.lastBurstAimError !== undefined && !shouldRerollAim) {
      bot.aimError = bot.lastBurstAimError;
    } else if (shouldRerollAim) {
      bot.aimError = (Math.random() - 0.5) * BOT_CONFIG.BASE_AIM_ERROR;
      if (bot.overcharge > 0) bot.lastBurstAimError = bot.aimError;
    }
    // Aim at predicted position with stable error
    bot.angle = bot.targetAngle + bot.aimError;
  }

  // For circle strafe, use FIXED orbit center (player position at engagement start)
  // This prevents 360° spin caused by constantly updating strafeAngle
  const strafeDir = bot.strafeDir || 1;
  // Use targetAngle (where we're aiming) for strafe, not current angle
  const strafeAngle = bot.targetAngle + Math.PI / 2 * strafeDir;

  // Direct angle to player's current position (for movement at far range)
  const directAngle = Math.atan2(player.y - bot.y, player.x - bot.x);

  let moveAngle;
  if (dist < 150) {
    // CLOSE: Circle strafe - orbit player while shooting (8-directional)
    moveAngle = strafeAngle;
  } else if (dist < 300) {
    // MID: Aggressive strafe (8-directional)
    moveAngle = strafeAngle;
  } else {
    // FAR: Close distance aggressively - move toward actual player position, not predicted
    moveAngle = directAngle;
  }

  // Quantize to 8 directions (WASD + diagonals) for fair movement
  const q = quantizeTo8Dir(moveAngle);
  mx = q.mx;
  my = q.my;

  // Dash to close distance when far
  if (dist > BOT_CONFIG.ENGAGE_DASH_RANGE && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0) && Math.random() < BOT_CONFIG.ENGAGE_DASH_PROBABILITY) {
    dash = true;
  }

  // Shoot with frame-based cooldown (consistent with game loop)
  if (bot.shootCd === 0) {
    // Check if aim is roughly at predicted player position (within 35 degrees)
    // bot.angle = targetAngle + aimError, so compare against targetAngle
    const angleDiff = Math.abs(((bot.angle - bot.targetAngle + Math.PI) % (2 * Math.PI)) - Math.PI);
    
    if (angleDiff < Math.PI / 5.14) { // Within ~35 degrees (0.61 rad)
      shoot = true;
      bot.shootCd = 11; // Standard cooldown
    }
  }

  // Also shoot if player is close and in view, even during other behaviors (handled in updateBotAI)
  // This function returns shoot decision for engagePlayer only

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
      const q = quantizeTo8Dir(Math.atan2(dy, dx));
      mx = q.mx; my = q.my;
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
  if (dist > 0) {
    const q = quantizeTo8Dir(Math.atan2(dy, dx));
    mx = q.mx; my = q.my;
  }

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
    if (dist > 0) {
      const q = quantizeTo8Dir(Math.atan2(dy, dx));
      mx = q.mx; my = q.my;
    }

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

  // Blend engage + evade when hunting but hazard nearby
  if (bot.behavior === 'engagePlayer') {
    const hazard = findNearestHazard(bot, state.hazards);
    if (hazard && hazard.dist < BOT_CONFIG.HAZARD_EVADE_RANGE) {
      const evadeOutput = executeEvadeHazard(bot, state);
      // Blend: 70% engage, 30% evade
      output.mx = 0.7 * output.mx + 0.3 * evadeOutput.mx;
      output.my = 0.7 * output.my + 0.3 * evadeOutput.my;
    }
  }

  // Bullet dodging: detect incoming player bullets and evade
  const bulletDodge = computeBulletDodge(bot, state.bullets);
  if (bulletDodge) {
    // Blend: 50% current behavior, 50% dodge (high priority for survival)
    output.mx = 0.5 * output.mx + 0.5 * bulletDodge.mx;
    output.my = 0.5 * output.my + 0.5 * bulletDodge.my;
    // If bullet is very close, dash to dodge
    if (bulletDodge.dist < 80 && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0)) {
      output.dash = true;
    }
  }

  // Global shooting: if player is alive and roughly in aim cone, shoot (regardless of behavior)
  // This ensures bot shoots even during seekPickup/evadeHazard when player is in view
  if (bot.shootCd === 0 && state.player && state.player.alive) {
    const angleToPlayer = Math.atan2(state.player.y - bot.y, state.player.x - bot.x);
    const angleDiff = Math.abs(((bot.angle - angleToPlayer + Math.PI) % (2 * Math.PI)) - Math.PI);
    if (angleDiff < Math.PI / 4) { // Within 45 degrees
      output.shoot = true;
      bot.shootCd = 11;
    }
  }

  // Normalize blended movement vectors before wall check
  const moveMag = Math.hypot(output.mx, output.my);
  if (moveMag > 0) {
    output.mx /= moveMag;
    output.my /= moveMag;
  }

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