/**
 * Strategy Library — Expert DLMM playbook + user custom strategies.
 *
 * Built-in: 2 autonomous-optimized strategies from proven DLMM LPers.
 * Custom: Users can still add/remove their own strategies via Telegram.
 * The agent selects the best strategy per pool based on conditions + top LPer patterns.
 */

import fs from "fs";
import { log } from "./logger.js";

const STRATEGY_FILE = "./strategy-library.json";

// ═══════════════════════════════════════════
//  EXPERT PLAYBOOK — Built-in strategies
// ═══════════════════════════════════════════
// Two strategies optimized for autonomous agent operation.
// yunss_classic = primary (data-driven, patient, consistent wins)
// panda_wide_spot = fallback (wide range safety net, fee grinding)

export const EXPERT_PLAYBOOK = [
  // ─── 0xyunss — Classic Bid-Ask After Dump ───────────────────────
  {
    id: "yunss_classic",
    name: "Classic Bid-Ask After Dump",
    author: "0xyunss",
    lp_strategy: "bid_ask",
    side: "sol",
    risk_level: "low",
    conditions: {
      min_volume_15m: 10000,
      volatility_range: [1, 8],
      price_change_pct_range: [null, -5],   // dumped
      min_fee_tvl_ratio: 0.05,             // 15m calibrated
      min_mcap: 500000,
      min_token_age_days: 2,
      requires_kol: true,
    },
    position: {
      // bins = volatility × 10, clamped to [35, 100]
      bins_formula: "vol_x10",
      bins_below: [35, 100],
      bins_above: 0,
    },
    exit: {
      take_profit_pct: 5,
      stop_loss_pct: -30,
      max_hold_minutes: null,   // overnight/multi-day OK
      oor_wait_minutes: 30,
      min_fee_per_tvl_24h: 5,
    },
    best_for: "THE bread-and-butter. Token dumped -30%+ from ATH with volume still alive. Single-side SOL bid-ask, accumulate token + fees. Hold hours to overnight. Exit at 5%+. REQUIRES: mcap>500k, age>2d, KOL holder, clean bubble map.",
  },

  // ─── LogicalTA (@EvilPanda) — Wide Spot Grind ───────────────────
  {
    id: "panda_wide_spot",
    name: "Panda Wide Spot Grind",
    author: "LogicalTA",
    lp_strategy: "spot",
    side: "sol",
    risk_level: "low",
    conditions: {
      min_volume_15m: 5000,
      volatility_range: [1, null],
      price_change_pct_range: [2, null],   // breakout/runner
      min_fee_tvl_ratio: 0.04,            // 15m calibrated
    },
    position: {
      bins_below: [150, 250],
      bins_above: 0,
    },
    exit: {
      take_profit_pct: null,   // no fixed TP — exit on trend exhaustion
      stop_loss_pct: -40,
      max_hold_minutes: null,  // hold until trend dies
      oor_wait_minutes: 60,
      min_fee_per_tvl_24h: 3,
    },
    best_for: "Breakout runners or any pool with sustained volume. WIDE range (85-90% below) absorbs dumps while printing fees on every trade. Survives even -97% rugs. Exit on sideways chop or volume death. Fee grinding machine. Use when no clear dump pattern for yunss_classic.",
  },
];

// ─── Expert Playbook Lookup ───────────────────────────────────────

const _expertMap = new Map(EXPERT_PLAYBOOK.map(s => [s.id, s]));

/**
 * Get the full strategy profile for storing in position state.
 * Works for both expert and custom strategies.
 */
export function getStrategyProfile(strategyId) {
  // Check expert playbook first
  const expert = _expertMap.get(strategyId);
  if (expert) {
    return {
      id: expert.id,
      name: expert.name,
      author: expert.author,
      lp_strategy: expert.lp_strategy,
      side: expert.side,
      risk_level: expert.risk_level,
      exit: { ...expert.exit },
    };
  }

  // Fall back to custom strategies
  const db = load();
  const custom = db.strategies[strategyId];
  if (custom) {
    return {
      id: custom.id,
      name: custom.name,
      author: custom.author,
      lp_strategy: custom.lp_strategy,
      exit: {
        take_profit_pct: custom.exit?.take_profit_pct ?? null,
        stop_loss_pct: null,
        max_hold_minutes: null,
        oor_wait_minutes: null,
        min_fee_per_tvl_24h: null,
      },
    };
  }

  return null;
}

// ─── Strategy Recommendation ──────────────────────────────────────

/**
 * Score and rank expert strategies against current pool conditions.
 * Returns both strategies sorted by match score.
 *
 * Decision logic:
 * - yunss_classic wins when: price is dumping, token has aged, mcap is healthy
 * - panda_wide_spot wins when: price is pumping/breaking out, or no clear dump pattern
 *
 * @param {Object} pool - Pool data from screening
 * @param {Object} lperPatterns - Optional top LPer aggregate patterns
 * @returns {Array} Strategies sorted by score descending
 */
export function recommendStrategy(pool, lperPatterns = null) {
  const scored = EXPERT_PLAYBOOK.map(strategy => {
    let score = 0;
    const reasons = [];

    const volume = pool.volume_window ?? pool.volume ?? 0;
    const volatility = pool.volatility ?? 0;
    const priceChange = pool.price_change_pct ?? 0;
    const feeTvl = pool.fee_active_tvl_ratio ?? 0;
    const mcap = pool.mcap ?? 0;

    // Volume match (25 pts)
    const minVol = strategy.conditions.min_volume_15m || 0;
    if (volume >= minVol) {
      score += 25;
      if (volume >= minVol * 3) reasons.push("strong volume");
    } else {
      score -= 15;
    }

    // Volatility match (20 pts)
    const [minV, maxV] = strategy.conditions.volatility_range || [null, null];
    const volOk = (minV == null || volatility >= minV) && (maxV == null || volatility <= maxV);
    if (volOk) {
      score += 20;
      reasons.push(`volatility ${volatility} in range`);
    } else {
      score -= 10;
    }

    // Price trend match (25 pts) — this is the main differentiator
    const [minP, maxP] = strategy.conditions.price_change_pct_range || [null, null];
    const pOk = (minP == null || priceChange >= minP) && (maxP == null || priceChange <= maxP);
    if (pOk) {
      score += 25;
      if (maxP != null && priceChange <= maxP) reasons.push("dump pattern detected");
      if (minP != null && priceChange >= minP) reasons.push("breakout/runner pattern");
    } else {
      score -= 15;
    }

    // Fee/TVL match (15 pts)
    const minFee = strategy.conditions.min_fee_tvl_ratio || 0;
    if (feeTvl >= minFee) {
      score += 15;
      if (feeTvl >= minFee * 3) reasons.push("excellent fee/TVL");
    }

    // MCap match (5 pts)
    const minMcap = strategy.conditions.min_mcap || 0;
    if (mcap >= minMcap || minMcap === 0) {
      score += 5;
    } else {
      score -= 10;
      reasons.push("mcap below threshold");
    }

    // LPer pattern alignment (10 pts)
    if (lperPatterns && lperPatterns.top_lper_count > 0) {
      const isHoldStrategy = strategy.exit.max_hold_minutes == null;
      if (isHoldStrategy && lperPatterns.holder_count > lperPatterns.scalper_count) {
        score += 10;
        reasons.push("top LPers holding long — aligns");
      } else if (isHoldStrategy && (lperPatterns.avg_hold_hours ?? 0) > 4) {
        score += 5;
        reasons.push("avg LPer hold time supports patience");
      }
    }

    return {
      id: strategy.id,
      name: strategy.name,
      author: strategy.author,
      lp_strategy: strategy.lp_strategy,
      risk_level: strategy.risk_level,
      score: Math.max(0, Math.min(100, score)),
      reason: reasons.length > 0 ? reasons.join(", ") : "baseline match",
      bins_below: strategy.position.bins_below,
      bins_above: strategy.position.bins_above ?? 0,
      bins_formula: strategy.position.bins_formula ?? null,
      side: strategy.side,
      best_for: strategy.best_for,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// ─── Playbook Formatter (for system prompt) ───────────────────────

/**
 * Format the expert playbook for injection into the system prompt.
 */
export function getPlaybook() {
  return `STRATEGY PLAYBOOK — Two Autonomous Strategies (from 0xyunss & LogicalTA)

You have TWO strategies. Pick the one that fits the pool conditions. Always pass strategy_id to deploy_position.

1. yunss_classic — PRIMARY (bid_ask, SOL-only)
   WHEN: Token has DUMPED from recent high (price_change negative). Volume still alive. Mature token.
   HOW: Single-side SOL bid-ask. Bins = volatility × 10, clamped [35-100]. Accumulate token + fees as price drops.
   EXIT: Take profit at 5%. Stop loss at -30%. OOR > 30min → close. Fee/TVL < 5% after 1hr → close.
   REQUIRES: mcap > 500k, token age > 2 days, KOL holder, clean holder distribution.
   EDGE: You're buying the dip with concentrated capital. Fees compound while you wait for the bounce.

2. panda_wide_spot — FALLBACK / SAFETY NET (spot, SOL-only)
   WHEN: Token is PUMPING, breaking out, or no clear dump pattern for yunss_classic. Any runner with volume.
   HOW: Single-side SOL spot with WIDE range (150-250 bins, ~85-90% below). Absorbs massive dumps.
   EXIT: No fixed TP — hold until trend dies (chop/sideways/volume death). Stop loss at -40%. OOR > 60min → close. Fee/TVL < 3% after 1hr → close.
   EDGE: Wide range = rug shield. Survives -97% dumps. Prints fees on every trade regardless of direction.

DECISION FLOW:
- Price dumping + mature token + healthy holders → yunss_classic
- Price pumping / breakout / new runner / unsure → panda_wide_spot
- If both score similarly, prefer yunss_classic (tighter range = higher fee concentration)

RULES FROM THE EXPERTS:
- Never open at ATH — you become exit liquidity (0xyunss)
- Range = volatility × 10 for yunss_classic (0xyunss)
- Fees/active TVL must be healthy — >5% for yunss, >3% for panda (both)
- Wide range = rug shield (LogicalTA)
- Take profit when given, don't be greedy (both)`;
}

// ═══════════════════════════════════════════
//  CUSTOM STRATEGIES — User-defined (persistent)
// ═══════════════════════════════════════════

function load() {
  if (!fs.existsSync(STRATEGY_FILE)) return { active: null, strategies: {} };
  try {
    return JSON.parse(fs.readFileSync(STRATEGY_FILE, "utf8"));
  } catch {
    return { active: null, strategies: {} };
  }
}

function save(data) {
  fs.writeFileSync(STRATEGY_FILE, JSON.stringify(data, null, 2));
}

/**
 * Add or update a custom strategy.
 */
export function addStrategy({
  id,
  name,
  author = "unknown",
  lp_strategy = "bid_ask",
  token_criteria = {},
  entry = {},
  range = {},
  exit = {},
  best_for = "",
  raw = "",
}) {
  if (!id || !name) return { error: "id and name are required" };

  const db = load();
  const slug = id.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  db.strategies[slug] = {
    id: slug,
    name,
    author,
    lp_strategy,
    token_criteria,
    entry,
    range,
    exit,
    best_for,
    raw,
    added_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (!db.active) db.active = slug;

  save(db);
  log("strategy", `Strategy saved: ${name} (${slug})`);
  return { saved: true, id: slug, name, active: db.active === slug };
}

/**
 * List all strategies (expert + custom) with summaries.
 */
export function listStrategies() {
  const db = load();

  const expert = EXPERT_PLAYBOOK.map((s) => ({
    id: s.id,
    name: s.name,
    author: s.author,
    lp_strategy: s.lp_strategy,
    best_for: s.best_for,
    type: "expert",
    risk_level: s.risk_level,
  }));

  const custom = Object.values(db.strategies).map((s) => ({
    id: s.id,
    name: s.name,
    author: s.author,
    lp_strategy: s.lp_strategy,
    best_for: s.best_for,
    active: db.active === s.id,
    type: "custom",
    added_at: s.added_at?.slice(0, 10),
  }));

  return {
    active_custom: db.active,
    expert_count: expert.length,
    custom_count: custom.length,
    expert_strategies: expert,
    custom_strategies: custom,
  };
}

/**
 * Get full details of a strategy (expert or custom).
 */
export function getStrategy({ id }) {
  if (!id) return { error: "id required" };

  // Check expert first
  const expert = _expertMap.get(id);
  if (expert) return { ...expert, type: "expert" };

  // Fall back to custom
  const db = load();
  const strategy = db.strategies[id];
  if (!strategy) {
    const available = [
      ...EXPERT_PLAYBOOK.map(s => s.id),
      ...Object.keys(db.strategies),
    ];
    return { error: `Strategy "${id}" not found`, available };
  }
  return { ...strategy, type: "custom", is_active: db.active === id };
}

/**
 * Set the active custom strategy.
 */
export function setActiveStrategy({ id }) {
  if (!id) return { error: "id required" };
  const db = load();
  if (!db.strategies[id]) return { error: `Strategy "${id}" not found`, available: Object.keys(db.strategies) };
  db.active = id;
  save(db);
  log("strategy", `Active strategy set to: ${db.strategies[id].name}`);
  return { active: id, name: db.strategies[id].name };
}

/**
 * Remove a custom strategy.
 */
export function removeStrategy({ id }) {
  if (!id) return { error: "id required" };
  const db = load();
  if (!db.strategies[id]) return { error: `Strategy "${id}" not found` };
  const name = db.strategies[id].name;
  delete db.strategies[id];
  if (db.active === id) db.active = Object.keys(db.strategies)[0] || null;
  save(db);
  log("strategy", `Strategy removed: ${name}`);
  return { removed: true, id, name, new_active: db.active };
}

/**
 * Get the currently active custom strategy — used by screening cycle as fallback.
 */
export function getActiveStrategy() {
  const db = load();
  if (!db.active || !db.strategies[db.active]) return null;
  return db.strategies[db.active];
}
