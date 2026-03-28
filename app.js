/**
 * ============================================================
 * Pasio Gym Battle Simulator — Application Logic
 * ============================================================
 *
 * Simulates Damage-over-Time (DoT) scoring for the Pasio Gym
 * Battle mode in Pokémon Masters EX.
 *
 * Architecture:
 *   - Store:     Centralised application state (store)
 *   - Engine:    Pure simulation engine (simulate)
 *   - Renderer:  DOM rendering (renderer)
 *   - UI:        Event binding & UI helpers (ui)
 *
 * Damage Formulas (source: community datamine / in-game testing):
 *   - Weather:    maxHP × 1/32
 *   - Poison:     maxHP × 1/4 × (1 + potent×0.1) × lessenMult
 *   - Bad Poison: maxHP × (tick/8) × (1 + potent×0.1) × lessenMult  (tick capped at 7)
 *   - Trap:       maxHP × 1/8 × (1 + pokey×0.1) × lessenMult
 *   - Field:      maxHP × 1/16 × lessenMult × (1 + rebuffBonus) × weakMult
 *
 * Lessen Multiplier Table:
 *   Levels 0–9: (10 - level) / 10
 *   Level 10:   0.05 (hardcoded exception)
 * ============================================================
 */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================

/** @enum {string} Actor identifiers */
const ACTORS = Object.freeze({
    ENTRY: 'Entry',
    USER:  'User',
    LEFT:  'Left',
    MID:   'Mid',
    RIGHT: 'Right',
});

/** @enum {string} Action types */
const ACTIONS = Object.freeze({
    ENTRY: 'Entry',
    TM:    'TM',
    PM:    'PM',
    MAX:   'MAX',
});

/** @enum {string} Weather conditions */
const WEATHER = Object.freeze({
    CLEAR:     'Clear',
    SANDSTORM: 'Sandstorm',
    HAILSTORM: 'Hailstorm',
});

/** @enum {string} Status conditions */
const STATUS = Object.freeze({
    NONE:       'None',
    POISON:     'Poison',
    BAD_POISON: 'BadPoison',
});

/** Field value when no damage field is active */
const FIELD_NONE = 'None';

/** @enum {string} Enemy side identifiers (lowercase) */
const SIDES = Object.freeze(['left', 'mid', 'right']);

/**
 * Damage fraction constants.
 * Source: Pokémon Masters EX datamine / community research.
 */
const DMG_FRAC = Object.freeze({
    WEATHER:    1 / 32,   // 0.03125
    POISON:     1 / 4,    // 0.25
    BAD_POISON: 1 / 8,    // 0.125 (per tick)
    TRAP:       1 / 8,    // 0.125
    FIELD:      1 / 16,   // 0.0625
});

/** Bad Poison tick cap */
const BAD_POISON_MAX_TICK = 7;

/**
 * Lessen passive multiplier lookup table.
 * Index = lessen level (0–10).
 * Levels 0–9 follow (10 - level) / 10.
 * Level 10 is a hardcoded exception at 0.05.
 */
const LESSEN_MULTS = Object.freeze([1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05]);

/**
 * Type Rebuff damage bonus multiplier by stack count.
 * Index = rebuff stack (0–3).
 */
const REBUFF_MULT = Object.freeze([0, 0.3, 0.5, 0.6]);

/** Maximum rebuff stacks per type per enemy */
const MAX_REBUFF_STACKS = 3;

/** Circuit level data: HP pools and point caps */
const CIRCUITS = Object.freeze({
    1: { mid: 500500,    side: 25025,    pts: 10000 },
    2: { mid: 3365000,   side: 1732500,  pts: 20000 },
    3: { mid: 5544000,   side: 277200,   pts: 30000 },
    4: { mid: 7983360,   side: 3991680,  pts: 40000 },
    5: { mid: 10866240,  side: 5433120,  pts: 50000 },
    6: { mid: 14192640,  side: 7096320,  pts: 60000 },
    7: { mid: 17962560,  side: 8981280,  pts: 75000 },
    8: { mid: 22176000,  side: 11088000, pts: 90000 },
});

/** Boss preset database */
const BOSS_DATA = Object.freeze({
    // Kanto
    brock:   { weak: 'Ice',      lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: true,  snow: false, dfImm: null },
    misty:   { weak: 'Electric', lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    surge:   { weak: 'Ground',   lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    erika:   { weak: 'Fire',     lp: 10, lt: 9, lf: 9, anti: false, esc: true,  sand: false, snow: false, dfImm: null },
    koga:    { weak: 'Psychic',  lp: 10, lt: 9, lf: 9, anti: true,  esc: false, sand: false, snow: false, dfImm: null },
    sabrina: { weak: 'Dark',     lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    blaine:  { weak: 'Water',    lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    blue:    { weak: 'Rock',     lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    // Galar
    milo:    { weak: 'Bug',      lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    nessa:   { weak: 'Grass',    lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    kabu:    { weak: 'Flying',   lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    bea:     { weak: 'Psychic',  lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    bede:    { weak: 'Ghost',    lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    gordie:  { weak: 'Water',    lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: 'Rock' },
    marnie:  { weak: 'Poison',   lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
    raihan:  { weak: 'Fighting', lp: 10, lt: 9, lf: 9, anti: false, esc: false, sand: false, snow: false, dfImm: null },
});

/** All Pokémon types */
const TYPES = Object.freeze([
    'Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground',
    'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy',
]);

/** Emoji icons per type */
const TYPE_ICONS = Object.freeze({
    Fire:'🔥', Water:'💧', Electric:'⚡', Grass:'🌿', Ice:'❄️', Fighting:'🥊',
    Poison:'🟣', Ground:'🌍', Flying:'🌪️', Psychic:'👁️', Bug:'🐛', Rock:'🪨',
    Ghost:'👻', Dragon:'🐉', Dark:'🌙', Steel:'⚙️', Fairy:'✨',
});

/** Tooltip / help text content */
const HELP_TEXTS = Object.freeze({
    potent:       { title: 'Potent Toxin',         desc: 'Increases the amount of damage an opponent takes from being poisoned or badly poisoned.' },
    pokey:        { title: 'Pokey Trap',           desc: 'Increases the amount of damage an opponent takes from being trapped.' },
    lessP:        { title: 'Lessen Poison',        desc: 'Reduces damage from being poisoned or badly poisoned.' },
    lessT:        { title: 'Lessen Trap',          desc: 'Reduces damage from being trapped.' },
    lessF:        { title: 'Lessen Damage Field',  desc: 'Reduces damage the user takes from Damage Fields.' },
    rebuff:       { title: 'Type Rebuff',          desc: 'Type Rebuff modifies Damage Field damage. It only applies if the Damage Field type exactly matches the Rebuff type.<br><br><b>Damage Multipliers:</b><br>• 0 : 0%<br>• -1 : +30%<br>• -2 : +50%<br>• -3 : +60%' },
    sandShelter:  { title: 'Sand Shelter',         desc: 'Protects the user from damage from a sandstorm.' },
    snowShelter:  { title: 'Snow Shelter',         desc: 'Protects the user from damage from a hailstorm.' },
    escapeArtist: { title: 'Escape Artist',        desc: 'Prevents the user from becoming trapped.' },
    antitoxin:    { title: 'Antitoxin',            desc: 'Prevents the user from getting poisoned or badly poisoned.' },
    helpTM:       { title: 'Trainer Move (TM)',    desc: '<b>Effects triggered on the user:</b><br>Weather and Damage Field damage only.<br><i>Does not trigger Poison or Trap damage.</i>' },
    helpPM:       { title: 'Pokémon Move (PM)',    desc: '<b>Effects triggered on the user:</b><br>Weather, Damage Field, Poison, and Trap damage.' },
    helpMAX:      { title: 'Max / Sync Move',      desc: '<b>Max Move or Sync Move.</b><br>Stops the 90s timer in-game. The turn counter does not advance.<br><i>Effects triggered on the user: None.</i>' },
    dfImmunity:   { title: 'DF Immunity',          desc: 'Protects the user from damage from the specified type\'s damage field.<br><br>For example, <b>Rock DF Immunity</b> protects the user from damage from Rock-type damage field.' },
});

/** Valid values for history validation */
const VALID_ACTORS  = Object.freeze([ACTORS.ENTRY, ACTORS.USER, ACTORS.LEFT, ACTORS.MID, ACTORS.RIGHT]);
const VALID_ACTIONS = Object.freeze([ACTIONS.ENTRY, ACTIONS.TM, ACTIONS.PM, ACTIONS.MAX]);
const VALID_WEATHERS = Object.freeze([WEATHER.CLEAR, WEATHER.SANDSTORM, WEATHER.HAILSTORM]);
const VALID_STATUSES = Object.freeze([STATUS.NONE, STATUS.POISON, STATUS.BAD_POISON]);


// ============================================================
// STORE — Centralised Application State
// ============================================================

const store = {
    /** @type {Array<Object>} Battle action history */
    history: [],

    /** Current live battle state (updated after each calc) */
    current: null,

    /** Computed results from the last simulation */
    computed: {
        state:    null,
        score:    0,
        totalDmg: 0,
        turns:    0,
        events:   [],
    },

    /** UI-only state for the modifier panel */
    panel: {
        action:        ACTIONS.ENTRY,
        pendingState:  {},
        pendingRebuffs: { left: {}, mid: {}, right: {} },
        sessionMods:   { left: { st: false, tr: false }, mid: { st: false, tr: false }, right: { st: false, tr: false } },
        appliedToAll:  { left: false, mid: false, right: false },
    },

    /** Undo stack for redo support */
    redoStack: [],
};


// ============================================================
// HELPERS
// ============================================================

/**
 * Returns the lessen multiplier for a given level.
 * @param {number} level - Lessen passive level (0–10)
 * @returns {number} Damage multiplier
 */
function getLessenMult(level) {
    const clamped = Math.max(0, Math.min(10, level));
    return LESSEN_MULTS[clamped];
}

/**
 * Clamps a numeric input element's value and returns the clamped number.
 * @param {string} id - Element ID
 * @param {number} min
 * @param {number} max
 * @param {number} fallback - Value to use if input is NaN
 * @returns {number}
 */
function clampInput(id, min, max, fallback) {
    const el = document.getElementById(id);
    let val = parseFloat(el.value);
    if (isNaN(val)) val = fallback;
    val = Math.max(min, Math.min(max, val));
    el.value = val;
    return val;
}

/**
 * Returns a value, using fallback only when value is undefined or null.
 * Avoids the `val || fallback` pitfall with falsy values like 0 or false.
 * @param {*} val
 * @param {*} fallback
 * @returns {*}
 */
function importVal(val, fallback) {
    return (val !== undefined && val !== null) ? val : fallback;
}

/**
 * Creates a fresh side state object.
 * @returns {Object}
 */
function createSideState() {
    return { tick: 0, st: STATUS.NONE, tr: false, rebuffs: {}, dmg: 0 };
}

/**
 * Creates a fresh full battle state.
 * @returns {Object}
 */
function createBattleState() {
    return {
        weather: WEATHER.CLEAR,
        field: FIELD_NONE,
        left: createSideState(),
        mid: createSideState(),
        right: createSideState(),
    };
}

/**
 * Deep-clones an object using structuredClone (modern browsers).
 * @param {Object} obj
 * @returns {Object}
 */
function deepClone(obj) {
    return structuredClone(obj);
}

/**
 * Shows a toast notification at the bottom of the screen.
 * @param {string} message - Text to display
 * @param {Object} [options]
 * @param {number} [options.duration=3000] - Auto-dismiss time in ms
 * @param {Function} [options.onAction] - Callback for action button
 * @param {string} [options.actionLabel] - Label for action button
 */
function showToast(message, options = {}) {
    let existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = message;

    if (options.onAction && options.actionLabel) {
        const actionsSpan = document.createElement('span');
        actionsSpan.className = 'toast-actions';
        const btn = document.createElement('button');
        btn.textContent = options.actionLabel;
        btn.addEventListener('click', () => {
            options.onAction();
            toast.remove();
        });
        actionsSpan.appendChild(btn);
        toast.appendChild(actionsSpan);
    }

    document.body.appendChild(toast);
    // Trigger reflow for transition
    void toast.offsetWidth;
    toast.classList.add('toast-visible');

    const duration = options.duration || 3000;
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}


// ============================================================
// ENGINE — Pure Simulation (no DOM access)
// ============================================================

const engine = {
    /**
     * Runs the full battle simulation from history.
     *
     * @param {Array<Object>} history - Action history array
     * @param {Object} config - Configuration read from the form
     * @param {Object} config.circuit - Circuit data { mid, side, pts }
     * @param {string} config.weakness - Boss weakness type
     * @param {number} config.potent - Potent Toxin level
     * @param {number} config.pokey - Pokey Trap level
     * @param {number} config.lessenPoison - Lessen Poison level
     * @param {number} config.lessenTrap - Lessen Trap level
     * @param {number} config.lessenField - Lessen Field level
     * @param {boolean} config.sandShelter
     * @param {boolean} config.snowShelter
     * @param {boolean} config.antitoxin
     * @param {boolean} config.escapeArtist
     * @param {Object} config.startHp - { left, mid, right } percentages (1–100)
     * @returns {Object} { state, turns, totalDmg, score, events }
     */
    simulate(history, config) {
        const { circuit, weakness, potent, pokey, lessenPoison, lessenTrap, lessenField,
                sandShelter, snowShelter, antitoxin, escapeArtist, dfImmunity, startHp } = config;

        const multP = getLessenMult(lessenPoison);
        const multT = getLessenMult(lessenTrap);
        const multF = getLessenMult(lessenField);

        let totalDmg = 0;
        let simTurns = 0;
        const state = createBattleState();
        const events = [];

        history.forEach((h, index) => {
            // --- Apply deltas (status changes, weather, field, rebuffs) ---
            if (h.delta) {
                if (h.delta.weather !== undefined) state.weather = h.delta.weather;
                if (h.delta.field !== undefined) state.field = h.delta.field;

                SIDES.forEach(s => {
                    if (h.delta[s]) {
                        if (h.delta[s].st && !antitoxin) state[s].st = h.delta[s].st;
                        if (h.delta[s].tr && !escapeArtist) state[s].tr = true;
                        if (h.delta[s].rebAdd) {
                            for (const t in h.delta[s].rebAdd) {
                                state[s].rebuffs[t] = Math.min(
                                    MAX_REBUFF_STACKS,
                                    (state[s].rebuffs[t] || 0) + h.delta[s].rebAdd[t]
                                );
                            }
                        }
                    }
                });
            }

            // --- Determine turn number ---
            let actionTurn;
            if (h.actor === ACTORS.ENTRY) {
                actionTurn = 0;
            } else if (h.actor === ACTORS.USER && h.action === ACTIONS.MAX) {
                actionTurn = simTurns;
            } else {
                simTurns++;
                actionTurn = simTurns;
            }

            // --- Calculate damage for enemy actions ---
            let turnDmg = 0;
            const d = { w: 0, p: 0, t: 0, f: 0 };
            const isEnemyAction = [ACTORS.LEFT, ACTORS.MID, ACTORS.RIGHT].includes(h.actor);

            if (isEnemyAction) {
                const target = h.actor.toLowerCase();
                const hpMax = (target === 'mid') ? circuit.mid : circuit.side;
                const startPct = startHp[target];
                const actualStartHp = hpMax * (startPct / 100);
                let currentHp = actualStartHp - state[target].dmg;

                // 1. Weather damage (PM or TM)
                if (currentHp > 0 && (h.action === ACTIONS.PM || h.action === ACTIONS.TM)) {
                    if (state.weather === WEATHER.SANDSTORM && !sandShelter) {
                        d.w = hpMax * DMG_FRAC.WEATHER;
                    }
                    if (state.weather === WEATHER.HAILSTORM && !snowShelter) {
                        d.w = hpMax * DMG_FRAC.WEATHER;
                    }
                    if (d.w > currentHp) d.w = currentHp;
                    currentHp -= d.w;
                }

                // 2. Poison / Bad Poison damage (PM only)
                if (h.action === ACTIONS.PM && currentHp > 0 && state[target].st !== STATUS.NONE && !antitoxin) {
                    state[target].tick++;
                    const isBadPoison = state[target].st === STATUS.BAD_POISON;
                    const effectiveTick = isBadPoison ? Math.min(state[target].tick, BAD_POISON_MAX_TICK) : 1;
                    const baseFrac = isBadPoison ? (effectiveTick * DMG_FRAC.BAD_POISON) : DMG_FRAC.POISON;

                    d.p = hpMax * baseFrac * (1 + potent * 0.1) * multP;
                    if (d.p > currentHp) d.p = currentHp;
                    currentHp -= d.p;
                }

                // 3. Trap damage (PM only)
                if (h.action === ACTIONS.PM && currentHp > 0 && state[target].tr && !escapeArtist) {
                    d.t = hpMax * DMG_FRAC.TRAP * (1 + pokey * 0.1) * multT;
                    if (d.t > currentHp) d.t = currentHp;
                    currentHp -= d.t;
                }

                // 4. Damage Field (PM or TM)
                const isFieldImmune = (dfImmunity !== 'None' && state.field === dfImmunity);
                if (currentHp > 0 && state.field !== FIELD_NONE && !isFieldImmune && (h.action === ACTIONS.PM || h.action === ACTIONS.TM)) {
                    const weakMult = (state.field === weakness) ? 2 : 1;
                    const rebuffStack = state[target].rebuffs[state.field] || 0;
                    const rBonus = REBUFF_MULT[rebuffStack] || 0;

                    d.f = hpMax * DMG_FRAC.FIELD * (1 + rBonus) * multF * weakMult;
                    if (d.f > currentHp) d.f = currentHp;
                    currentHp -= d.f;
                }

                turnDmg = d.w + d.p + d.t + d.f;
                state[target].dmg += turnDmg;
                totalDmg += turnDmg;
            }

            // --- Build event for timeline ---
            const isLatest = (index === history.length - 1);
            events.push({
                actor:      h.actor,
                action:     h.action,
                delta:      h.delta,
                turn:       actionTurn,
                dmg:        { ...d },
                turnDmg:    turnDmg,
                antitoxin:  antitoxin,
                escapeArtist: escapeArtist,
                isLatest:   isLatest,
            });
        });

        const totalHP = circuit.mid + (circuit.side * 2);
        const score = Math.round((totalDmg / totalHP) * circuit.pts);

        return {
            state:    deepClone(state),
            turns:    simTurns,
            totalDmg: totalDmg,
            score:    score,
            events:   events,
        };
    },
};


// ============================================================
// RENDERER — DOM Rendering (reads store.computed, writes DOM)
// ============================================================

const renderer = {
    /** Cached type options HTML string */
    _typeOptionsHTML: '',

    /** Initialise type options HTML */
    initTypeOptions() {
        this._typeOptionsHTML = TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
        document.getElementById('weakness').innerHTML = this._typeOptionsHTML;
        document.getElementById('dfImmunity').innerHTML =
            '<option value="None">None</option>' + this._typeOptionsHTML;
    },

    /** Get type options HTML */
    getTypeOptionsHTML() {
        return this._typeOptionsHTML;
    },

    /**
     * Builds the enemy card HTML for the modifier panel.
     * Uses DocumentFragment to avoid innerHTML += in a loop.
     */
    buildEnemyCards() {
        const container = document.getElementById('targetRowsContainer');
        const fragment = document.createDocumentFragment();

        SIDES.forEach(side => {
            const card = document.createElement('div');
            card.className = 'enemy-card';
            card.innerHTML = `
                <div class="enemy-card-title">${side.toUpperCase()} Enemy</div>
                
                <div class="mod-row-inner">
                    <label style="margin:0;">Status</label>
                    <div class="btn-group" style="flex:1; margin-left:10px;">
                        <button class="btn" style="flex:1; padding: 4px 0;" id="mod_${side}_st_Poison" data-mod-status="${side}" data-status-val="${STATUS.POISON}">🟣 Poison</button>
                        <button class="btn" style="flex:1; padding: 4px 0;" id="mod_${side}_st_BadPoison" data-mod-status="${side}" data-status-val="${STATUS.BAD_POISON}">☠️ Bad P.</button>
                    </div>
                </div>
                
                <div class="mod-row-inner">
                    <label style="margin:0;">Trap</label>
                    <div class="btn-group" style="flex:1; margin-left:10px;">
                        <button class="btn" style="width:100%; padding: 4px 0;" id="mod_${side}_tr" data-mod-trap="${side}">🌪️ Trap</button>
                    </div>
                </div>
                
                <div class="mod-row-inner" style="border-top:1px dashed var(--border-light); padding-top:8px; margin-top:4px;">
                    <label style="margin:0;">Rebuff <span class="help-icon" role="button" tabindex="0" aria-label="Help: Type Rebuff" data-help="rebuff">?</span></label>
                    <div style="display:flex; align-items:center; gap:5px; flex:1; justify-content:flex-end;">
                        <select id="mod_${side}_reb_type" class="compact" style="width:85px;" aria-label="Rebuff type for ${side}">
                            ${this._typeOptionsHTML}
                        </select>
                        <button class="btn btn-primary" style="padding: 4px 10px;" data-add-rebuff="${side}">+ Add</button>
                    </div>
                </div>
                <div id="mod_${side}_reb_tags" class="rebuff-tags-container"></div>
                
                <button id="btn_apply_all_${side}" class="btn" style="display:none; width:100%; margin-top:10px; color:var(--primary); border-color:var(--primary); background:var(--input-bg);" data-apply-all="${side}">⬇️ Apply to All</button>
            `;
            fragment.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    },

    /**
     * Renders the full UI from store.computed.
     * @param {Object} config - Current config for HP calculations
     */
    renderDashboard(config) {
        const { state, score, totalDmg, turns } = store.computed;
        const circuit = config.circuit;

        // Score with animation
        const scoreEl = document.getElementById('scoreDisplay');
        const oldScore = scoreEl.textContent;
        const newScore = score.toLocaleString() + ' pts';
        scoreEl.textContent = newScore;
        if (oldScore !== newScore) {
            scoreEl.classList.add('score-bump');
            setTimeout(() => scoreEl.classList.remove('score-bump'), 250);
        }

        document.getElementById('dmgDisplay').textContent = 'Total DMG: ' + Math.floor(totalDmg).toLocaleString();
        document.getElementById('turnDisplay').textContent = `TURN ${turns}`;
        document.getElementById('envDisplay').textContent = `Environment — Weather: ${state.weather} | Field: ${state.field}`;

        // Side boxes
        SIDES.forEach(s => {
            const startPct = config.startHp[s];
            const hpMax = s === 'mid' ? circuit.mid : circuit.side;
            const actualStartHp = hpMax * (startPct / 100);
            const hpRemainingPct = ((actualStartHp - state[s].dmg) / hpMax) * 100;
            const isDead = hpRemainingPct <= 0;

            let rebText = Object.entries(state[s].rebuffs)
                .map(([t, val]) => `${TYPE_ICONS[t] || ''} ${t} -${val}`)
                .join(', ');
            if (!rebText) rebText =  'None';

            const statusIcon = state[s].st === STATUS.POISON ? '🟣 Poison'
                : state[s].st === STATUS.BAD_POISON ? '☠️ Bad P.'
                : '✅ Healthy';

            document.getElementById(`dash_${s}`).innerHTML = `
                <span class="dash-name">${s.toUpperCase()} (${isDead ? '0.00' : hpRemainingPct.toFixed(2)}%)</span>
                <div class="dash-detail">
                    Stat: <span style="font-weight:bold; color:${state[s].st !== STATUS.NONE ? '#8e44ad' : 'inherit'}">${statusIcon}</span><br>
                    Trap: <span style="font-weight:bold; color:${state[s].tr ? '#e67e22' : 'inherit'}">${state[s].tr ? '🌪️ Yes' : 'No'}</span><br>
                    Rebuffs: <span style="font-weight:bold; color:#2980b9">${rebText}</span>
                    ${isDead ? '<br><span style="color:var(--danger); font-weight:bold;">KO</span>' : ''}
                </div>
            `;

            // Disable enemy buttons if KO
            const btnIdPrefix = s.charAt(0).toUpperCase() + s.slice(1);
            const btnTM = document.getElementById(`btn_${btnIdPrefix}_TM`);
            const btnPM = document.getElementById(`btn_${btnIdPrefix}_PM`);
            if (btnTM) btnTM.disabled = isDead;
            if (btnPM) btnPM.disabled = isDead;
        });
    },

    /**
     * Renders the battle timeline from events array.
     * Events are displayed in reverse chronological order (newest first).
     * The latest entry gets a highlight class.
     * @param {Array<Object>} events
     */
    renderTimeline(events) {
        const logArea = document.getElementById('logArea');

        if (events.length === 0) {
            logArea.innerHTML = '';
            return;
        }

        const fragment = document.createDocumentFragment();

        // Iterate in reverse so newest is on top
        for (let i = events.length - 1; i >= 0; i--) {
            const evt = events[i];
            const entry = document.createElement('div');

            // Determine CSS classes
            let cssClass = 'log-entry';
            if (evt.actor === ACTORS.ENTRY) cssClass += ' entry-phase';
            if (evt.isLatest) cssClass += ' latest-entry';
            entry.className = cssClass;

            // Border color for user actions
            if (evt.actor === ACTORS.USER) {
                entry.style.borderLeftColor = '#f1c40f';
            }

            // Header
            let actorDisplay;
            if (evt.actor === ACTORS.ENTRY) {
                actorDisplay = '⭐ ENTRY PHASE';
            } else if (evt.actor === ACTORS.USER) {
                actorDisplay = `🦸‍♂️ USER ${evt.action}`;
            } else {
                actorDisplay = `👿 ${evt.actor.toUpperCase()} ${evt.action}`;
            }

            // Details
            let detailsHtml = '';
            const isUserOrEntry = (evt.actor === ACTORS.ENTRY || evt.actor === ACTORS.USER);

            if (isUserOrEntry && evt.delta) {
                const changes = [];
                if (evt.delta.weather !== undefined) changes.push(`🌤️ Weather ➔ ${evt.delta.weather}`);
                if (evt.delta.field !== undefined) changes.push(`🌐 Field ➔ ${evt.delta.field}`);

                SIDES.forEach(s => {
                    if (evt.delta[s]) {
                        const sName = s.toUpperCase();
                        if (evt.delta[s].st && !evt.antitoxin) changes.push(`☠️ ${sName} ➔ ${evt.delta[s].st}`);
                        if (evt.delta[s].tr && !evt.escapeArtist) changes.push(`🌪️ ${sName} ➔ Trapped`);
                        if (evt.delta[s].rebAdd) {
                            for (const t in evt.delta[s].rebAdd) {
                                changes.push(`📉 ${sName} ➔ ${t} Rebuff -${evt.delta[s].rebAdd[t]}`);
                            }
                        }
                    }
                });

                if (changes.length > 0) {
                    detailsHtml = changes.map(c => `<div class="detail-item">${c}</div>`).join('');
                } else {
                    detailsHtml = '<div class="detail-item" style="font-style:italic">No effects modified.</div>';
                }
            } else if (!isUserOrEntry) {
                if (evt.turnDmg > 0) {
                    let gridItems = '';
                    if (evt.dmg.w > 0) gridItems += `<div>❄️/🏜️ Weather: ${Math.floor(evt.dmg.w).toLocaleString()}</div>`;
                    if (evt.dmg.p > 0) gridItems += `<div>☠️ Poison: ${Math.floor(evt.dmg.p).toLocaleString()}</div>`;
                    if (evt.dmg.t > 0) gridItems += `<div>🌪️ Trap: ${Math.floor(evt.dmg.t).toLocaleString()}</div>`;
                    if (evt.dmg.f > 0) gridItems += `<div>🌐 Field: ${Math.floor(evt.dmg.f).toLocaleString()}</div>`;
                    detailsHtml = `<div class="dmg-grid">${gridItems}</div>
                        <div class="total-line">Turn Passive DMG: ${Math.floor(evt.turnDmg).toLocaleString()}</div>`;
                } else {
                    detailsHtml = '<div class="detail-item">No passive damage taken.</div>';
                }
            }

            entry.innerHTML = `
                <div class="log-header">
                    <span>${actorDisplay}</span>
                    <span class="turn-badge">Turn ${evt.turn}</span>
                </div>
                ${detailsHtml}
            `;

            fragment.appendChild(entry);
        }

        logArea.innerHTML = '';
        logArea.appendChild(fragment);
    },

    /**
     * Updates the modifier panel UI (button states, rebuff tags, apply-all visibility).
     */
    updateModifierPanel() {
        const anti = document.getElementById('antitoxin').checked;
        const esc = document.getElementById('escapeArtist').checked;
        const { pendingState, pendingRebuffs, sessionMods, appliedToAll } = store.panel;
        const cur = store.current;

        SIDES.forEach(side => {
            const isStLocked = cur[side].st !== STATUS.NONE;

            // Status buttons
            const btnPoison = document.getElementById(`mod_${side}_st_Poison`);
            const btnBadPoison = document.getElementById(`mod_${side}_st_BadPoison`);
            const btnTrap = document.getElementById(`mod_${side}_tr`);

            btnPoison.disabled = isStLocked || anti;
            btnBadPoison.disabled = isStLocked || anti;
            btnTrap.disabled = cur[side].tr || esc;

            if (anti) pendingState[side].st = STATUS.NONE;
            if (esc) pendingState[side].tr = false;

            btnPoison.className = (pendingState[side].st === STATUS.POISON) ? 'btn btn-active' : 'btn';
            btnBadPoison.className = (pendingState[side].st === STATUS.BAD_POISON) ? 'btn btn-active' : 'btn';
            btnTrap.className = (pendingState[side].tr) ? 'btn btn-active' : 'btn';

            // Rebuff tags
            const container = document.getElementById(`mod_${side}_reb_tags`);
            container.innerHTML = '';

            for (const t of TYPES) {
                const pendingStack = pendingRebuffs[side][t] || 0;
                if (pendingStack > 0) {
                    const icon = TYPE_ICONS[t] || '';
                    const badge = document.createElement('span');
                    badge.className = 'rebuff-badge';
                    badge.innerHTML = `${icon} ${t} -${pendingStack} `;
                    const removeBtn = document.createElement('b');
                    removeBtn.textContent = '×';
                    removeBtn.setAttribute('role', 'button');
                    removeBtn.setAttribute('tabindex', '0');
                    removeBtn.setAttribute('aria-label', `Remove ${t} rebuff from ${side}`);
                    removeBtn.addEventListener('click', () => ui.removeRebuffTag(side, t));
                    removeBtn.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.removeRebuffTag(side, t); }
                    });
                    badge.appendChild(removeBtn);
                    container.appendChild(badge);
                }
            }

            // Apply to All button
            const hasChanges = sessionMods[side].st || sessionMods[side].tr || Object.keys(pendingRebuffs[side]).length > 0;
            const applyBtn = document.getElementById(`btn_apply_all_${side}`);
            if (applyBtn) {
                applyBtn.style.display = (hasChanges && !appliedToAll[side]) ? 'block' : 'none';
            }
        });
    },
};


// ============================================================
// UI — Event Binding & User Interaction Logic
// ============================================================

const ui = {
    /**
     * Reads the current configuration from the DOM.
     * Applies input clamping for safety.
     * @returns {Object} config
     */
    readConfig() {
        const circuitVal = document.getElementById('circuit').value;
        return {
            circuit:       CIRCUITS[circuitVal] || CIRCUITS[8],
            weakness:      document.getElementById('weakness').value,
            potent:        parseInt(document.getElementById('potent').value) || 0,
            pokey:         parseInt(document.getElementById('pokey').value) || 0,
            lessenPoison:  parseInt(document.getElementById('lessP').value) || 0,
            lessenTrap:    parseInt(document.getElementById('lessT').value) || 0,
            lessenField:   parseInt(document.getElementById('lessF').value) || 0,
            sandShelter:   document.getElementById('sandShelter').checked,
            snowShelter:   document.getElementById('snowShelter').checked,
            antitoxin:     document.getElementById('antitoxin').checked,
            escapeArtist:  document.getElementById('escapeArtist').checked,
            dfImmunity:    document.getElementById('dfImmunity').value,
            startHp: {
                left:  clampInput('startHp_left', 1, 100, 100),
                mid:   clampInput('startHp_mid', 1, 100, 100),
                right: clampInput('startHp_right', 1, 100, 100),
            },
        };
    },

    /**
     * Main recalculation: runs the engine and updates the UI.
     */
    calc() {
        const config = ui.readConfig();
        const result = engine.simulate(store.history, config);

        store.computed = {
            state:    result.state,
            score:    result.score,
            totalDmg: result.totalDmg,
            turns:    result.turns,
            events:   result.events,
        };
        store.current = deepClone(result.state);

        renderer.renderDashboard(config);
        renderer.renderTimeline(result.events);

        if (document.getElementById('modifierPanel').style.display === 'block') {
            renderer.updateModifierPanel();
        }
    },

    /** Toggles the settings accordion */
    toggleSettings() {
        const content = document.getElementById('globalSettingsContent');
        const icon = document.getElementById('settingsToggleIcon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    },

    /**
     * Handles stepper button clicks.
     * @param {string} id - Hidden input ID
     * @param {number} delta - +1 or -1
     * @param {number} min
     * @param {number} max
     * @param {boolean} isBossProp - Whether this is a boss property
     */
    stepper(id, delta, min, max, isBossProp) {
        const inp = document.getElementById(id);
        if (inp.disabled) return;
        let v = parseInt(inp.value) || 0;
        v = Math.max(min, Math.min(max, v + delta));
        inp.value = v;
        document.getElementById('txt_' + id).textContent = v;
        if (isBossProp) ui.setCustomBoss();
        ui.calc();
    },

    /** Applies a boss preset */
    applyBoss() {
        const b = document.getElementById('bossSelect').value;
        const props = document.querySelectorAll('.boss-prop');
        const btnSteppers = document.querySelectorAll('.btn-stepper.boss-prop');

        if (b === 'custom') {
            props.forEach(el => el.disabled = false);
            btnSteppers.forEach(el => el.disabled = false);
            ui.calc();
            return;
        }

        const data = BOSS_DATA[b];
        if (!data) return;

        document.getElementById('weakness').value = data.weak;
        document.getElementById('lessP').value = data.lp;
        document.getElementById('txt_lessP').textContent = data.lp;
        document.getElementById('lessT').value = data.lt;
        document.getElementById('txt_lessT').textContent = data.lt;
        document.getElementById('lessF').value = data.lf;
        document.getElementById('txt_lessF').textContent = data.lf;
        document.getElementById('antitoxin').checked = data.anti;
        document.getElementById('escapeArtist').checked = data.esc;
        document.getElementById('sandShelter').checked = data.sand;
        document.getElementById('snowShelter').checked = data.snow;
        document.getElementById('dfImmunity').value = data.dfImm || 'None';

        props.forEach(el => el.disabled = true);
        btnSteppers.forEach(el => el.disabled = true);
        ui.calc();
    },

    /** Switches to custom boss mode */
    setCustomBoss() {
        document.getElementById('bossSelect').value = 'custom';
        document.querySelectorAll('.boss-prop').forEach(el => el.disabled = false);
        document.querySelectorAll('.btn-stepper.boss-prop').forEach(el => el.disabled = false);
    },

    /** Toggles dark/light theme */
    toggleTheme() {
        const body = document.body;
        if (body.getAttribute('data-theme') === 'dark') {
            body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    },

    // --- Modal ---

    /** Opens the help modal for a given key */
    openHelp(key) {
        const data = HELP_TEXTS[key];
        if (!data) return;
        document.getElementById('modalTitle').textContent = data.title;
        document.getElementById('modalDesc').innerHTML = data.desc;
        document.getElementById('infoModal').style.display = 'block';
    },

    /** Closes the help modal */
    closeModal() {
        document.getElementById('infoModal').style.display = 'none';
    },

    // --- Modifier Panel ---

    /**
     * Opens the modifier panel for a given action.
     * @param {string} action - ACTIONS.ENTRY, ACTIONS.TM, ACTIONS.PM, or ACTIONS.MAX
     */
    openModifier(action) {
        store.panel.action = action;
        store.panel.pendingState = deepClone(store.current);
        store.panel.pendingRebuffs = { left: {}, mid: {}, right: {} };
        store.panel.sessionMods = { left: { st: false, tr: false }, mid: { st: false, tr: false }, right: { st: false, tr: false } };
        store.panel.appliedToAll = { left: false, mid: false, right: false };

        const wSelect = document.getElementById('modWeather');
        const fSelect = document.getElementById('modField');

        wSelect.innerHTML = '';
        fSelect.innerHTML = '';

        if (action !== ACTIONS.ENTRY) {
            wSelect.innerHTML += '<option value="Unchanged">-- Unchanged --</option>';
            fSelect.innerHTML += '<option value="Unchanged">-- Unchanged --</option>';
        }

        wSelect.innerHTML += `<option value="${WEATHER.CLEAR}">Clear</option>
            <option value="${WEATHER.SANDSTORM}">Sandstorm</option>
            <option value="${WEATHER.HAILSTORM}">Hailstorm</option>`;
        fSelect.innerHTML += `<option value="${FIELD_NONE}">None</option>` + renderer.getTypeOptionsHTML();

        if (action === ACTIONS.ENTRY) {
            wSelect.value = store.current.weather;
            fSelect.value = store.current.field;
        } else {
            wSelect.value = 'Unchanged';
            fSelect.value = 'Unchanged';
        }

        const title = (action === ACTIONS.ENTRY)
            ? '⭐ Initial Entry Effects'
            : `⚡ Configure Effects for User ${action}`;
        document.getElementById('modTitle').textContent = title;
        document.getElementById('modifierPanel').style.display = 'block';

        renderer.updateModifierPanel();

        if (action !== ACTIONS.ENTRY) {
            document.getElementById('modifierPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    /**
     * Sets the status condition for a side in the modifier panel.
     * @param {string} side - 'left', 'mid', or 'right'
     * @param {string} val - STATUS.POISON or STATUS.BAD_POISON
     */
    setModStatus(side, val) {
        const anti = document.getElementById('antitoxin').checked;
        if (store.current[side].st !== STATUS.NONE || anti) return;

        const pending = store.panel.pendingState;
        pending[side].st = (pending[side].st === val) ? STATUS.NONE : val;

        store.panel.sessionMods[side].st = true;
        store.panel.appliedToAll[side] = false;
        renderer.updateModifierPanel();
    },

    /**
     * Toggles the trap state for a side in the modifier panel.
     * @param {string} side - 'left', 'mid', or 'right'
     */
    toggleModTrap(side) {
        const esc = document.getElementById('escapeArtist').checked;
        if (store.current[side].tr || esc) return;

        store.panel.pendingState[side].tr = !store.panel.pendingState[side].tr;
        store.panel.sessionMods[side].tr = true;
        store.panel.appliedToAll[side] = false;
        renderer.updateModifierPanel();
    },

    /**
     * Adds a rebuff tag for a side.
     * @param {string} side - 'left', 'mid', or 'right'
     */
    addRebuffTag(side) {
        const t = document.getElementById(`mod_${side}_reb_type`).value;
        const currentStack = store.current[side].rebuffs[t] || 0;
        const pendingStack = store.panel.pendingRebuffs[side][t] || 0;

        if (currentStack + pendingStack < MAX_REBUFF_STACKS) {
            store.panel.pendingRebuffs[side][t] = pendingStack + 1;
            store.panel.appliedToAll[side] = false;
            renderer.updateModifierPanel();
        }
    },

    /**
     * Removes a rebuff tag for a side.
     * @param {string} side - 'left', 'mid', or 'right'
     * @param {string} t - Pokémon type
     */
    removeRebuffTag(side, t) {
        const rebuffs = store.panel.pendingRebuffs[side];
        if (rebuffs[t] > 0) {
            rebuffs[t]--;
            if (rebuffs[t] === 0) delete rebuffs[t];
            store.panel.appliedToAll[side] = false;
            renderer.updateModifierPanel();
        }
    },

    /**
     * Copies the modifier settings from one side to all others.
     * @param {string} source - 'left', 'mid', or 'right'
     */
    applyToAll(source) {
        const anti = document.getElementById('antitoxin').checked;
        const esc = document.getElementById('escapeArtist').checked;
        const { pendingState, pendingRebuffs, sessionMods, appliedToAll } = store.panel;
        const cur = store.current;

        SIDES.forEach(target => {
            if (source === target) return;

            // Reset target to current state first
            pendingState[target].st = cur[target].st;
            pendingState[target].tr = cur[target].tr;
            store.panel.pendingRebuffs[target] = {};

            // Copy status if applicable
            if (sessionMods[source].st && !anti && cur[target].st === STATUS.NONE) {
                pendingState[target].st = pendingState[source].st;
                sessionMods[target].st = true;
            }

            // Copy trap if applicable
            if (sessionMods[source].tr && !esc && !cur[target].tr) {
                pendingState[target].tr = pendingState[source].tr;
                sessionMods[target].tr = true;
            }

            // Copy rebuffs
            for (const t in pendingRebuffs[source]) {
                const amountToAdd = pendingRebuffs[source][t];
                const currentStack = cur[target].rebuffs[t] || 0;
                const maxAllowed = MAX_REBUFF_STACKS - currentStack;
                if (maxAllowed > 0) {
                    store.panel.pendingRebuffs[target][t] = Math.min(amountToAdd, maxAllowed);
                }
            }

            appliedToAll[target] = true;
        });

        appliedToAll[source] = true;
        renderer.updateModifierPanel();
    },

    /**
     * Commits the modifier panel changes to history.
     */
    commitModifier() {
        const delta = { left: {}, mid: {}, right: {} };
        const cur = store.current;
        const { action: pendingAction, pendingState, pendingRebuffs } = store.panel;

        const wVal = document.getElementById('modWeather').value;
        const fVal = document.getElementById('modField').value;

        if (pendingAction === ACTIONS.ENTRY) {
            if (wVal !== cur.weather) delta.weather = wVal;
            if (fVal !== cur.field) delta.field = fVal;
        } else {
            if (wVal !== 'Unchanged') delta.weather = wVal;
            if (fVal !== 'Unchanged') delta.field = fVal;
        }

        SIDES.forEach(s => {
            if (pendingState[s].st !== cur[s].st) delta[s].st = pendingState[s].st;
            if (pendingState[s].tr !== cur[s].tr) delta[s].tr = true;
            if (Object.keys(pendingRebuffs[s]).length > 0) {
                delta[s].rebAdd = { ...pendingRebuffs[s] };
            }
        });

        const actor = (pendingAction === ACTIONS.ENTRY) ? ACTORS.ENTRY : ACTORS.USER;
        store.history.push({ actor, action: pendingAction, delta });
        store.redoStack = []; // Clear redo on new action

        document.getElementById('modifierPanel').style.display = 'none';
        document.getElementById('actionContainer').style.display = 'block';
        document.getElementById('tlHeader').style.display = 'flex';
        ui.calc();
    },

    /**
     * Commits an enemy action to history.
     * @param {string} actor - ACTORS.LEFT, ACTORS.MID, or ACTORS.RIGHT
     * @param {string} action - ACTIONS.TM or ACTIONS.PM
     */
    commitEnemy(actor, action) {
        store.history.push({ actor, action, delta: null });
        store.redoStack = []; // Clear redo on new action
        document.getElementById('modifierPanel').style.display = 'none';
        ui.calc();
    },

    /**
     * Undoes the last action with redo support via toast.
     */
    undo() {
        if (store.history.length === 0) return;

        const removed = store.history.pop();
        store.redoStack.push(removed);
        ui.calc();

        showToast('↺ Action undone.', {
            duration: 5000,
            actionLabel: '↻ Redo',
            onAction: () => {
                if (store.redoStack.length > 0) {
                    store.history.push(store.redoStack.pop());
                    ui.calc();
                }
            },
        });
    },

    /** Resets the entire battle after confirmation */
    resetBattle() {
        if (confirm('Are you sure you want to reset the entire battle?')) {
            window.history.replaceState({}, document.title, window.location.pathname);
            location.reload();
        }
    },

    // --- Import / Export ---

    /**
     * Validates an imported history array.
     * Filters out any entries that don't match the expected schema.
     * @param {Array} h - Raw history array
     * @returns {Array} Validated history
     */
    validateHistory(h) {
        if (!Array.isArray(h)) return [];

        return h.filter(entry => {
            if (!entry || typeof entry !== 'object') return false;
            if (!VALID_ACTORS.includes(entry.actor)) return false;
            if (!VALID_ACTIONS.includes(entry.action)) return false;

            // delta can be null (enemy actions) or an object
            if (entry.delta !== null && entry.delta !== undefined) {
                if (typeof entry.delta !== 'object') return false;

                // Validate weather
                if (entry.delta.weather !== undefined) {
                    if (!VALID_WEATHERS.includes(entry.delta.weather)) return false;
                }

                // Validate field
                if (entry.delta.field !== undefined) {
                    if (entry.delta.field !== FIELD_NONE && !TYPES.includes(entry.delta.field)) return false;
                }

                // Validate side deltas
                for (const side of SIDES) {
                    if (entry.delta[side]) {
                        const sd = entry.delta[side];
                        if (typeof sd !== 'object') return false;

                        if (sd.st !== undefined && !VALID_STATUSES.includes(sd.st)) return false;

                        if (sd.rebAdd !== undefined) {
                            if (typeof sd.rebAdd !== 'object') return false;
                            for (const [type, val] of Object.entries(sd.rebAdd)) {
                                if (!TYPES.includes(type)) return false;
                                if (typeof val !== 'number' || val < 1 || val > MAX_REBUFF_STACKS) return false;
                            }
                        }
                    }
                }
            }

            return true;
        });
    },

 // --- Helper de Minification de l'historique ---
    _minifyHistory(history) {
        return history.map(h => {
            const min = { a: h.actor, c: h.action };
            if (h.delta) {
                min.d = {};
                if (h.delta.weather !== undefined) min.d.w = h.delta.weather;
                if (h.delta.field !== undefined) min.d.f = h.delta.field;
                SIDES.forEach(s => {
                    const sc = s.charAt(0); // 'l', 'm', 'r'
                    if (h.delta[s]) {
                        min.d[sc] = {};
                        if (h.delta[s].st !== undefined) min.d[sc].s = h.delta[s].st;
                        if (h.delta[s].tr !== undefined) min.d[sc].t = h.delta[s].tr;
                        if (h.delta[s].rebAdd) min.d[sc].r = h.delta[s].rebAdd;
                    }
                });
            }
            return min;
        });
    },

    _hydrateHistory(minHistory) {
        if (!Array.isArray(minHistory)) return [];
        return minHistory.map(min => {
            const h = { actor: min.a, action: min.c, delta: null };
            if (min.d) {
                h.delta = {};
                if (min.d.w !== undefined) h.delta.weather = min.d.w;
                if (min.d.f !== undefined) h.delta.field = min.d.f;

                const sm = { l: 'left', m: 'mid', r: 'right' };
                Object.keys(sm).forEach(sc => {
                    if (min.d[sc]) {
                        const fullSide = sm[sc];
                        h.delta[fullSide] = {};
                        if (min.d[sc].s !== undefined) h.delta[fullSide].st = min.d[sc].s;
                        if (min.d[sc].t !== undefined) h.delta[fullSide].tr = min.d[sc].t;
                        if (min.d[sc].r) h.delta[fullSide].rebAdd = min.d[sc].r;
                    }
                });
            }
            return h;
        });
    },

    /** Exports the current state to a shareable URL */
    exportToURL() {
        const exportData = {
            b:    document.getElementById('bossSelect').value,
            c:    document.getElementById('circuit').value,
            w:    document.getElementById('weakness').value,
            lp:   document.getElementById('lessP').value,
            lt:   document.getElementById('lessT').value,
            lf:   document.getElementById('lessF').value,
            ss:   document.getElementById('sandShelter').checked,
            sno:  document.getElementById('snowShelter').checked,
            ea:   document.getElementById('escapeArtist').checked,
            anti: document.getElementById('antitoxin').checked,
            hpl:  document.getElementById('startHp_left').value,
            hpm:  document.getElementById('startHp_mid').value,
            hpr:  document.getElementById('startHp_right').value,
            pt:   document.getElementById('potent').value,
            pk:   document.getElementById('pokey').value,
            dfi:  document.getElementById('dfImmunity').value,
            h:    this._minifyHistory(store.history), // On minifie l'historique
        };

        const jsonStr = JSON.stringify(exportData);
        // Utilisation de LZString au lieu du simple btoa
        const encoded = LZString.compressToEncodedURIComponent(jsonStr);

        const url = new URL(window.location.href);
        url.searchParams.set('data', encoded);

        navigator.clipboard.writeText(url.href).then(() => {
            showToast('🔗 Shareable link copied to clipboard!');
        }).catch(() => {
            prompt('Copy this URL to share your strategy:', url.href);
        });
    },

    /** Imports state from URL query parameter */
    importFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('data');
        if (!dataParam) return;

        try {
            // Décompression avec LZString
            const decoded = LZString.decompressFromEncodedURIComponent(dataParam);
            if (!decoded) throw new Error("Invalid compression format");
            const data = JSON.parse(decoded);

            document.getElementById('bossSelect').value = importVal(data.b, 'custom');
            document.getElementById('circuit').value = importVal(data.c, '8');
            document.getElementById('weakness').value = importVal(data.w, 'Ice');

            document.getElementById('lessP').value = importVal(data.lp, 10);
            document.getElementById('txt_lessP').textContent = importVal(data.lp, 10);
            document.getElementById('lessT').value = importVal(data.lt, 9);
            document.getElementById('txt_lessT').textContent = importVal(data.lt, 9);
            document.getElementById('lessF').value = importVal(data.lf, 9);
            document.getElementById('txt_lessF').textContent = importVal(data.lf, 9);

            document.getElementById('sandShelter').checked = importVal(data.ss, false);
            document.getElementById('snowShelter').checked = importVal(data.sno, false);
            document.getElementById('escapeArtist').checked = importVal(data.ea, false);
            document.getElementById('antitoxin').checked = importVal(data.anti, false);
            document.getElementById('dfImmunity').value = importVal(data.dfi, 'None');

            document.getElementById('startHp_left').value = importVal(data.hpl, 100);
            document.getElementById('startHp_mid').value = importVal(data.hpm, 100);
            document.getElementById('startHp_right').value = importVal(data.hpr, 100);

            document.getElementById('potent').value = importVal(data.pt, 0);
            document.getElementById('txt_potent').textContent = importVal(data.pt, 0);
            document.getElementById('pokey').value = importVal(data.pk, 0);
            document.getElementById('txt_pokey').textContent = importVal(data.pk, 0);

            // Restauration (Hydratation) et validation de l'historique
            const fullHistory = this._hydrateHistory(data.h || []);
            store.history = ui.validateHistory(fullHistory);

            if (data.b !== 'custom') {
                document.querySelectorAll('.boss-prop').forEach(el => el.disabled = true);
                document.querySelectorAll('.btn-stepper.boss-prop').forEach(el => el.disabled = true);
            }
        } catch (e) {
            console.error('Failed to import data from URL:', e);
            showToast('⚠️ The shared link appears corrupted. Loading fresh battle.', { duration: 5000 });
        }
    },

    // --- Event Binding ---

    /**
     * Binds all event listeners using addEventListener (no inline onclick).
     * Uses event delegation where practical.
     */
    bindEvents() {
        // --- Theme toggle ---
        document.getElementById('themeToggleBtn').addEventListener('click', () => ui.toggleTheme());

        // --- Settings accordion ---
        document.getElementById('settingsToggle').addEventListener('click', () => ui.toggleSettings());

        // --- Boss selector ---
        document.getElementById('bossSelect').addEventListener('change', () => ui.applyBoss());

        // --- Circuit selector ---
        document.getElementById('circuit').addEventListener('change', () => ui.calc());

        // --- Weakness selector ---
        document.getElementById('weakness').addEventListener('change', () => {
            ui.setCustomBoss();
            ui.calc();
        });

        // --- Boss checkboxes ---
        ['sandShelter', 'snowShelter', 'escapeArtist', 'antitoxin', 'dfImmunity'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                ui.setCustomBoss();
                ui.calc();
            });
        });

        // --- Start HP inputs ---
        ['startHp_left', 'startHp_mid', 'startHp_right'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => ui.calc());
        });

        // --- Stepper buttons (delegated) ---
        document.addEventListener('click', (e) => {
            const stepperBtn = e.target.closest('[data-stepper]');
            if (stepperBtn) {
                e.preventDefault();
                const id = stepperBtn.dataset.stepper;
                const delta = parseInt(stepperBtn.dataset.delta);
                const min = parseInt(stepperBtn.dataset.min);
                const max = parseInt(stepperBtn.dataset.max);
                const isBoss = stepperBtn.dataset.boss === 'true';
                ui.stepper(id, delta, min, max, isBoss);
                return;
            }
        });

        // --- Help icons (delegated) ---
        document.addEventListener('click', (e) => {
            const helpEl = e.target.closest('[data-help]');
            if (helpEl) {
                e.preventDefault();
                e.stopPropagation();
                ui.openHelp(helpEl.dataset.help);
                return;
            }
        });

        // --- Help icons keyboard support ---
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const helpEl = e.target.closest('[data-help]');
                if (helpEl) {
                    e.preventDefault();
                    ui.openHelp(helpEl.dataset.help);
                }
            }
        });

        // --- Modal close ---
        document.getElementById('modalCloseBtn').addEventListener('click', () => ui.closeModal());
        document.getElementById('modalCloseBtn').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.closeModal(); }
        });
        document.getElementById('infoModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('infoModal')) ui.closeModal();
        });
        // Close modal on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('infoModal').style.display === 'block') {
                ui.closeModal();
            }
        });

        // --- User action buttons (delegated) ---
        document.addEventListener('click', (e) => {
            const userBtn = e.target.closest('[data-user-action]');
            if (userBtn) {
                e.preventDefault();
                ui.openModifier(userBtn.dataset.userAction);
                return;
            }
        });

        // --- Enemy action buttons (delegated) ---
        document.addEventListener('click', (e) => {
            const enemyBtn = e.target.closest('[data-enemy-actor]');
            if (enemyBtn) {
                e.preventDefault();
                ui.commitEnemy(enemyBtn.dataset.enemyActor, enemyBtn.dataset.enemyAction);
                return;
            }
        });

        // --- Modifier panel: status buttons (delegated) ---
        document.addEventListener('click', (e) => {
            const statusBtn = e.target.closest('[data-mod-status]');
            if (statusBtn) {
                e.preventDefault();
                ui.setModStatus(statusBtn.dataset.modStatus, statusBtn.dataset.statusVal);
                return;
            }
        });

        // --- Modifier panel: trap buttons (delegated) ---
        document.addEventListener('click', (e) => {
            const trapBtn = e.target.closest('[data-mod-trap]');
            if (trapBtn) {
                e.preventDefault();
                ui.toggleModTrap(trapBtn.dataset.modTrap);
                return;
            }
        });

        // --- Modifier panel: add rebuff (delegated) ---
        document.addEventListener('click', (e) => {
            const addBtn = e.target.closest('[data-add-rebuff]');
            if (addBtn) {
                e.preventDefault();
                ui.addRebuffTag(addBtn.dataset.addRebuff);
                return;
            }
        });

        // --- Modifier panel: apply to all (delegated) ---
        document.addEventListener('click', (e) => {
            const applyBtn = e.target.closest('[data-apply-all]');
            if (applyBtn) {
                e.preventDefault();
                ui.applyToAll(applyBtn.dataset.applyAll);
                return;
            }
        });

        // --- Confirm modifier ---
        document.getElementById('confirmModifierBtn').addEventListener('click', () => ui.commitModifier());

        // --- Timeline buttons ---
        document.getElementById('exportBtn').addEventListener('click', () => ui.exportToURL());
        document.getElementById('undoBtn').addEventListener('click', () => ui.undo());
        document.getElementById('resetBtn').addEventListener('click', () => ui.resetBattle());
    },
};


// ============================================================
// AUTO-UPDATE CHECKER
// ============================================================

function checkForUpdates() {
    // On lit la version actuelle du fichier chargé dans le navigateur
    const currentVersion = document.querySelector('meta[name="app-version"]')?.content;
    if (!currentVersion) return;

    // On interroge le serveur (en contournant le cache grâce au timestamp) pour lire le HTML en ligne
    fetch(window.location.pathname + '?t=' + Date.now())
        .then(res => res.text())
        .then(html => {
            // On cherche la balise meta dans le nouveau HTML
            const match = html.match(/<meta name="app-version" content="([^"]+)">/);
            if (match && match[1] !== currentVersion) {
                // Si la version en ligne est différente, on affiche un Toast
                showToast('🔄 A new version of the simulator is available!', {
                    duration: 15000,
                    actionLabel: 'Update Now',
                    onAction: () => location.reload() // Recharge la page
                });
            }
        })
        .catch(e => console.log('Update check failed', e));
}

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Application entry point.
 * Called when the DOM is fully loaded.
 */
function initApp() {
    // Apply saved theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }

    // Initialise renderer
    renderer.initTypeOptions();
    renderer.buildEnemyCards();

    // Bind all events (no inline handlers)
    ui.bindEvents();

    // Initialise store with a fresh battle state
    store.current = createBattleState();

    // Try to import from URL
    ui.importFromURL();

    // Set up initial UI state
    if (store.history.length > 0) {
        document.getElementById('modifierPanel').style.display = 'none';
        document.getElementById('actionContainer').style.display = 'block';
        document.getElementById('tlHeader').style.display = 'flex';
    } else {
        document.getElementById('bossSelect').value = 'custom';
        ui.openModifier(ACTIONS.ENTRY);
    }

    // Initial calculation
    ui.calc();

    // Vérifie s'il y a une mise à jour en arrière-plan (Ajouté tout à la fin)
    checkForUpdates();
}

// --- Bootstrap ---
document.addEventListener('DOMContentLoaded', initApp);
