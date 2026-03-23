/**
 * Strategy Library — Expert DLMM playbook + user custom strategies.
 *
 * Built-in: 10 expert strategies from 4 proven DLMM LPers on Meteora.
 * Custom: Users can still add/remove their own strategies via Telegram.
 * The agent selects the best strategy per pool based on conditions + top LPer patterns.
 */

import fs from "fs";
import { log } from "./logger.js";

const STRATEGY_FILE = "./strategy-library.json";

// ═══════════════════════════════════════════
//  EXPERT PLAYBOOK — Built-in strategies
// ═══════════════════════════════════════════
// Internalized from 4 expert DLMM LPers. Always available.
// Each strategy has conditions (when to use), position config, and exit rules.

export const EXPERT_PLAYBOOK = [
  // ─── Voidgoesbrr ────────────────────────────────────────────────
  {
    id: "void_hyperfocused",
    name: "Hyperfocused Scalp",
    author: "Voidgoesbrr",
    lp_strategy: "spot",
    side: "sol",
    risk_level: "degen",
    conditions: {
      min_volume_5m: 500000,
      volatility_range: [3, null],
      price_change_pct_range: [5, null],   // pumping hard
      min_fee_tvl_ratio: 0.05,
    },
    position: {
      bins_below: [10, 20],
      bins_above: 0,
    },
    exit: {
      take_profit_pct: 5,
      stop_loss_pct: -10,
      max_hold_minutes: 3,
      oor_wait_minutes: 2,
      min_fee_per_tvl_24h: null,
    },
    best_for: "Extreme volume spikes (>500k/5m), quick 1-3 minute fee scalps. Maximize capital per bin. In and out fast.",
  },

  {
    id: "void_wave",
    name: "Wave Enjoyer",
    author: "Voidgoesbrr",
    lp_strategy: "spot",
    side: "sol",
    risk_level: "high",
    conditions: {
      min_volume_5m: 100000,
      volatility_range: [2, null],
      price_change_pct_range: [2, null],   // pumping
      min_fee_tvl_ratio: 0.03,
    },
    position: {
      bins_below: [20, 40],
      bins_above: 0,
    },
    exit: {
      take_profit_pct: 15,
      stop_loss_pct: -15,
      max_hold_minutes: 20,
      oor_wait_minutes: 5,
      min_fee_per_tvl_24h: null,
    },
    best_for: "Capturing 1-2 retrace waves on pumping tokens with >100k vol/5m and good narrative/legit backers.",
  },

  {
    id: "void_npc",
    name: "NPC Set-and-Forget",
    author: "Voidgoesbrr",
    lp_strategy: "bid_ask",
    side: "sol",
    risk_level: "medium",
    conditions: {
      min_volume_5m: 50000,
      volatility_range: [1, 5],
      price_change_pct_range: [null, null],  // any trend
      min_fee_tvl_ratio: 0.02,
    },
    position: {
      bins_below: [60, 70],
      bins_above: 0,
    },
    exit: {
      take_profit_pct: 10,
      stop_loss_pct: -25,
      max_hold_minutes: 360,
      oor_wait_minutes: 30,
      min_fee_per_tvl_24h: 5,
    },
    best_for: "Default chill mode. Any decent pool with >50k vol/5m. 70-bin range, hold 30min-6hrs. Good narrative token.",
  },

  {
    id: "void_degen_curve",
    name: "Degenerate Curve",
    author: "Voidgoesbrr",
    lp_strategy: "curve",
    side: "sol",
    risk_level: "degen",
    conditions: {
      min_volume_5m: 200000,
      volatility_range: [3, null],
      price_change_pct_range: [5, null],   // strong uptrend
      min_fee_tvl_ratio: 0.05,
    },
    position: {
      bins_below: 0,
      bins_above: [20, 50],
    },
    exit: {
      take_profit_pct: 20,
      stop_loss_pct: -15,
      max_hold_minutes: 30,
      oor_wait_minutes: 5,
      min_fee_per_tvl_24h: null,
    },
    best_for: "Up-only charts after initial spot/bid-ask chase. Concentrate liquidity at upside. Highest risk/reward. Use after confirming strong pump.",
  },

  // ─── 0xMegumi (@eisbedog) ───────────────────────────────────────
  {
    id: "megumi_ranging",
    name: "Megumuy Safe Ranging",
    author: "0xMegumi",
    lp_strategy: "bid_ask",
    side: "sol",
    risk_level: "low",
    conditions: {
      min_volume_5m: 30000,
      volatility_range: [0.5, 3],
      price_change_pct_range: [-10, 10],   // ranging/recovering
      min_fee_tvl_ratio: 0.02,
      min_mcap: 200000,
    },
    position: {
      bins_below: [30, 50],
      bins_above: 0,
    },
    exit: {
      take_profit_pct: 20,
      stop_loss_pct: -20,
      max_hold_minutes: null,   // hold as long as it's ranging
      oor_wait_minutes: 45,
      min_fee_per_tvl_24h: 3,
    },
    best_for: "Ranging or recovering coins. Safe, daily compounding. Narrow bid-ask around support. Hold hours-days. Patient approach.",
  },

  // ─── 0xyunss ────────────────────────────────────────────────────
  {
    id: "yunss_classic",
    name: "Classic Bid-Ask After Dump",
    author: "0xyunss",
    lp_strategy: "bid_ask",
    side: "sol",
    risk_level: "low",
    conditions: {
      min_volume_5m: 30000,
      volatility_range: [1, 8],
      price_change_pct_range: [null, -5],   // dumped
      min_fee_tvl_ratio: 0.02,
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
    best_for: "THE bread-and-butter. Token dumped -30%+ from ATH with volume still alive. Accumulate token + fees. Hold hours to overnight. Needs mcap>500k, age>2d, KOL holder, clean bubble map.",
  },

  {
    id: "yunss_spot_dump",
    name: "Spot After Hard Dump",
    author: "0xyunss",
    lp_strategy: "spot",
    side: "sol",
    risk_level: "medium",
    conditions: {
      min_volume_5m: 50000,
      volatility_range: [2, null],
      price_change_pct_range: [null, -10],  // hard dump
      min_fee_tvl_ratio: 0.03,
    },
    position: {
      bins_below: [35, 60],
      bins_above: 0,
    },
    exit: {
      take_profit_pct: 15,
      stop_loss_pct: -25,
      max_hold_minutes: 360,
      oor_wait_minutes: 20,
      min_fee_per_tvl_24h: 5,
    },
    best_for: "Token dumps hard (-30% to -50%) but volume still decent. Catch retrace volume. Hold multi-hour. Target 10-30%.",
  },

  {
    id: "yunss_tight_scalp",
    name: "Tight Heart-Attack Scalp",
    author: "0xyunss",
    lp_strategy: "bid_ask",
    side: "sol",
    risk_level: "high",
    conditions: {
      min_volume_5m: 100000,
      volatility_range: [2, null],
      price_change_pct_range: [null, null],  // any, needs high volume
      min_fee_tvl_ratio: 0.04,
    },
    position: {
      bins_below: [5, 20],
      bins_above: 0,
    },
    exit: {
      take_profit_pct: 5,
      stop_loss_pct: -15,
      max_hold_minutes: 20,
      oor_wait_minutes: 5,
      min_fee_per_tvl_24h: null,
    },
    best_for: "Very tight scalp on high-volume runners (>100k vol/5m). 5-20 bins only. Target 5%+ in 5-20 minutes. Risky if late.",
  },

  {
    id: "yunss_flip",
    name: "Bid-Ask SOL → Flip to Token",
    author: "0xyunss",
    lp_strategy: "bid_ask",
    side: "sol",
    risk_level: "medium",
    conditions: {
      min_volume_5m: 50000,
      volatility_range: [2, null],
      price_change_pct_range: [null, -20],  // big dump
      min_fee_tvl_ratio: 0.03,
      min_mcap: 300000,
    },
    position: {
      bins_below: [15, 30],
      bins_above: 0,
    },
    exit: {
      // Phase 1: accumulate token. Phase 2: flip to token-side.
      take_profit_pct: 10,
      stop_loss_pct: -20,
      max_hold_minutes: 120,
      oor_wait_minutes: 15,
      min_fee_per_tvl_24h: null,
    },
    best_for: "TWO-PHASE: (1) SOL bid-ask at bottom, accumulate token + fees. (2) When pump starts and converts, withdraw and flip to token-side bid-ask with wide upside. Fees on the way down AND up.",
  },

  // ─── LogicalTA (@EvilPanda) ─────────────────────────────────────
  {
    id: "panda_wide_spot",
    name: "Panda Wide Spot Grind",
    author: "LogicalTA",
    lp_strategy: "spot",
    side: "sol",
    risk_level: "low",
    conditions: {
      min_volume_5m: 50000,
      volatility_range: [1, null],
      price_change_pct_range: [2, null],   // breakout/runner
      min_fee_tvl_ratio: 0.02,
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
    best_for: "Breakout runners (15min supertrend break or new ATH). WIDE range (85-90% below) absorbs dumps while printing fees on every trade. Survives even -97% rugs. Exit on sideways chop, big green candle, or BB break. Fee grinding machine.",
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
 * Returns top 3 recommendations with scores and reasons.
 *
 * @param {Object} pool - Pool data from screening (volume_window, volatility, price_change_pct, fee_active_tvl_ratio, mcap)
 * @param {Object} lperPatterns - Optional top LPer aggregate patterns from study_top_lpers
 * @returns {Array} Top 3 strategies sorted by score descending
 */
export function recommendStrategy(pool, lperPatterns = null) {
  const scored = EXPERT_PLAYBOOK.map(strategy => {
    let score = 0;
    const reasons = [];

    const vol5m = pool.volume_window ?? pool.volume ?? 0;
    const volatility = pool.volatility ?? 0;
    const priceChange = pool.price_change_pct ?? 0;
    const feeTvl = pool.fee_active_tvl_ratio ?? 0;
    const mcap = pool.mcap ?? 0;

    // Volume match (25 pts)
    const minVol = strategy.conditions.min_volume_5m || 0;
    if (vol5m >= minVol) {
      score += 25;
      if (vol5m >= minVol * 3) reasons.push("volume well above threshold");
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

    // Price trend match (25 pts)
    const [minP, maxP] = strategy.conditions.price_change_pct_range || [null, null];
    const pOk = (minP == null || priceChange >= minP) && (maxP == null || priceChange <= maxP);
    if (pOk) {
      score += 25;
      if (minP != null && priceChange >= minP) reasons.push("price trend matches");
      if (maxP != null && priceChange <= maxP) reasons.push("dump pattern matches");
    } else {
      score -= 15;
    }

    // Fee/TVL match (15 pts)
    const minFee = strategy.conditions.min_fee_tvl_ratio || 0;
    if (feeTvl >= minFee) {
      score += 15;
    }

    // MCap match (5 pts)
    const minMcap = strategy.conditions.min_mcap || 0;
    if (mcap >= minMcap || minMcap === 0) {
      score += 5;
    }

    // LPer pattern alignment (10 pts)
    if (lperPatterns && lperPatterns.top_lper_count > 0) {
      const avgHold = lperPatterns.avg_hold_hours ?? 0;
      const isScalpStrategy = (strategy.exit.max_hold_minutes ?? 999) <= 30;
      const isHoldStrategy = (strategy.exit.max_hold_minutes ?? 999) > 120 || strategy.exit.max_hold_minutes == null;

      if (isScalpStrategy && lperPatterns.scalper_count > lperPatterns.holder_count) {
        score += 10;
        reasons.push("top LPers also scalping");
      } else if (isHoldStrategy && lperPatterns.holder_count > lperPatterns.scalper_count) {
        score += 10;
        reasons.push("top LPers also holding long");
      } else if (isScalpStrategy && avgHold < 2) {
        score += 5;
        reasons.push("avg LPer hold time is short");
      } else if (isHoldStrategy && avgHold > 4) {
        score += 5;
        reasons.push("avg LPer hold time is long");
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

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ─── Playbook Formatter (for system prompt) ───────────────────────

/**
 * Format the expert playbook for injection into the system prompt.
 * Organized by market condition for quick LLM lookup.
 */
export function getPlaybook() {
  return `STRATEGY PLAYBOOK — Expert LP Knowledge (4 proven DLMM LPers)
You have internalized the strategies of Voidgoesbrr, 0xMegumi, 0xyunss, and LogicalTA.
Match pool conditions + top LPer patterns to the best strategy. Pass the strategy_id to deploy_position.

VOLUME SPIKING (>500k/5m, price pumping hard):
  void_hyperfocused — spot, SOL-only, 10-20 bins. Hold 1-3 min MAX. Exit immediately on profit or wrong direction.
  void_wave — spot, SOL-only, 20-40 bins. Hold 10-20 min. Capture 1-2 retrace waves. Need good narrative.

UP-ONLY / STRONG UPTREND (confirmed pump, >200k vol):
  void_degen_curve — curve, SOL-only, 20-50 bins ABOVE active bin. Concentrate liquidity at upside. Highest risk/reward. Only after confirming strong pump.

TOKEN DUMPED (-30%+ from recent high, volume alive):
  yunss_classic — bid_ask, SOL-only, bins=volatility×10 (35-100 range). THE bread-and-butter. Accumulate token+fees. Hold hours to overnight. Exit at 5%+. REQUIRES: mcap>500k, age>2d, KOL holder, clean bubble map.
  yunss_spot_dump — spot, SOL-only, 35-60 bins. Hard dumps with decent volume. Hold multi-hour. Target 10-30%.
  yunss_flip — bid_ask SOL at bottom → accumulate → flip to token-side on pump. TWO-PHASE play.

RANGING / RECOVERING (sideways, steady volume):
  megumi_ranging — bid_ask, SOL-only, 30-50 bins. Safe daily compound. Narrow range around support. Hold hours-days. Patient.
  void_npc — bid_ask, SOL-only, 60-70 bins. Set-and-forget default. Any decent pool >50k vol. Hold 30min-6hrs.

BREAKOUT / RUNNER (supertrend break, new ATH):
  panda_wide_spot — spot, SOL-only, 150-250 bins (WIDE). Absorbs dumps while printing fees. Survives -97% rugs. Exit on sideways chop or BB break. Fee grind machine.

QUICK SCALPS (any condition, high volume >100k):
  yunss_tight_scalp — bid_ask, SOL-only, 5-20 bins. Very tight. Target 5%+ in 5-20 min. Risky if late.

EXPERT RULES TO ALWAYS FOLLOW:
- Never open at ATH — you become exit liquidity (0xyunss)
- Range sizing: volatility × 5 for scalps, volatility × 10 for patient holds (0xyunss)
- Fees/active TVL > 5% required for multi-hour holds (0xyunss)
- Wide range = rug shield — survives dumps (LogicalTA)
- Start small, compound up (all four experts)
- Take profit when given, don't be greedy — "decide when it's enough" (all four)
- If wrong direction, cut immediately — don't hope (Voidgoesbrr)`;
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
