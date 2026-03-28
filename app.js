/**
 * ============================================================
 * Pasio Gym Battle Simulator — Application Logic
 * ============================================================
 */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const ACTORS = Object.freeze({ ENTRY: 'Entry', USER: 'User', LEFT: 'Left', MID: 'Mid', RIGHT: 'Right' });
const ACTIONS = Object.freeze({ ENTRY: 'Entry', TM: 'TM', PM: 'PM', MAX: 'MAX' });
const WEATHER = Object.freeze({ CLEAR: 'Clear', SANDSTORM: 'Sandstorm', HAILSTORM: 'Hailstorm' });
const STATUS = Object.freeze({ NONE: 'None', POISON: 'Poison', BAD_POISON: 'BadPoison' });
const FIELD_NONE = 'None';
const SIDES = Object.freeze(['left', 'mid', 'right']);

const DMG_FRAC = Object.freeze({
    WEATHER:    1 / 32,
    POISON:     1 / 4,
    BAD_POISON: 1 / 8,
    TRAP:       1 / 8,
    FIELD:      1 / 16,
});

const BAD_POISON_MAX_TICK = 7;
const LESSEN_MULTS = Object.freeze([1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05]);
const REBUFF_MULT = Object.freeze([0, 0.3, 0.5, 0.6]);
const MAX_REBUFF_STACKS = 3;

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

const BOSS_DATA = Object.freeze({
    // KANTO (Gym Battle No. 1)
    brock:   { weak: 'Ice',      lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: true,  snow: false },
    misty:   { weak: 'Electric', lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    surge:   { weak: 'Ground',   lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    erika:   { weak: 'Fire',     lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: true,  sand: false, snow: false },
    koga:    { weak: 'Psychic',  lp: 10, lt: 9, lf: 9, dfI: [], anti: true,  esc: false, sand: false, snow: false },
    sabrina: { weak: 'Dark',     lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    blaine:  { weak: 'Water',    lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    blue:    { weak: 'Rock',     lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    
    // GALAR (Gym Battle No. 2)
    milo:    { weak: 'Bug',      lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    nessa:   { weak: 'Grass',    lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    kabu:    { weak: 'Flying',   lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    bea:     { weak: 'Psychic',  lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    bede:    { weak: 'Ghost',    lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    gordie:  { weak: 'Water',    lp: 10, lt: 9, lf: 9, dfI: ['Rock'], anti: false, esc: false, sand: false, snow: false },
    marnie:  { weak: 'Poison',   lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
    raihan:  { weak: 'Fighting', lp: 10, lt: 9, lf: 9, dfI: [], anti: false, esc: false, sand: false, snow: false },
});

const TYPES = Object.freeze([
    'Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground',
    'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy',
]);

const TYPE_ICONS = Object.freeze({
    Fire:'🔥', Water:'💧', Electric:'⚡', Grass:'🌿', Ice:'❄️', Fighting:'🥊',
    Poison:'🟣', Ground:'🌍', Flying:'🌪️', Psychic:'👁️', Bug:'🐛', Rock:'🪨',
    Ghost:'👻', Dragon:'🐉', Dark:'🌙', Steel:'⚙️', Fairy:'✨',
});

const HELP_TEXTS = Object.freeze({
    potent:       { title: 'Potent Toxin',        desc: 'Increases the amount of damage an opponent takes from being poisoned or badly poisoned.' },
    pokey:        { title: 'Pokey Trap',           desc: 'Increases the amount of damage an opponent takes from being trapped.' },
    lessP:        { title: 'Lessen Poison',        desc: 'Reduces damage from being poisoned or badly poisoned.' },
    lessT:        { title: 'Lessen Trap',          desc: 'Reduces damage from being trapped.' },
    lessF:        { title: 'Lessen Damage Field',  desc: 'Reduces damage the user takes from Damage Fields.' },
    dfImmunity:   { title: 'Damage Field Immunity',desc: 'Prevents the boss from taking damage from the specified Damage Field(s).' },
    rebuff:       { title: 'Type Rebuff',          desc: 'Type Rebuff modifies Damage Field damage. It only applies if the Damage Field type exactly matches the Rebuff type.<br><br><b>Damage Multipliers:</b><br>• 0 : 0%<br>• -1 : +30%<br>• -2 : +50%<br>• -3 : +60%' },
    sandShelter:  { title: 'Sand Shelter',         desc: 'Protects the user from damage from a sandstorm.' },
    snowShelter:  { title: 'Snow Shelter',         desc: 'Protects the user from damage from a hailstorm.' },
    escapeArtist: { title: 'Escape Artist',        desc: 'Prevents the user from becoming trapped.' },
    antitoxin:    { title: 'Antitoxin',            desc: 'Prevents the user from getting poisoned or badly poisoned.' },
    helpTM:       { title: 'Trainer Move (TM)',    desc: '<b>Effects triggered on the user:</b><br>Weather and Damage Field damage only.<br><i>Does not trigger Poison or Trap damage.</i>' },
    helpPM:       { title: 'Pokémon Move (PM)',    desc: '<b>Effects triggered on the user:</b><br>Weather, Damage Field, Poison, and Trap damage.' },
    helpMAX:      { title: 'Max / Sync Move',      desc: '<b>Max Move or Sync Move.</b><br>Stops the 90s timer in-game. The turn counter does not advance.<br><i>Effects triggered on the user: None.</i>' },
});

const VALID_ACTORS  = Object.freeze([ACTORS.ENTRY, ACTORS.USER, ACTORS.LEFT, ACTORS.MID, ACTORS.RIGHT]);
const VALID_ACTIONS = Object.freeze([ACTIONS.ENTRY, ACTIONS.TM, ACTIONS.PM, ACTIONS.MAX]);
const VALID_WEATHERS = Object.freeze([WEATHER.CLEAR, WEATHER.SANDSTORM, WEATHER.HAILSTORM]);
const VALID_STATUSES = Object.freeze([STATUS.NONE, STATUS.POISON, STATUS.BAD_POISON]);

// ============================================================
// STORE
// ============================================================

const store = {
    history: [],
    current: null,
    fieldImmunities: [], // Track global field immunities
    computed: { state: null, score: 0, totalDmg: 0, turns: 0, events: [] },
    panel: {
        action: ACTIONS.ENTRY,
        pendingState: {},
        pendingRebuffs: { left: {}, mid: {}, right: {} },
        sessionMods: { left: { st: false, tr: false }, mid: { st: false, tr: false }, right: { st: false, tr: false } },
        appliedToAll: { left: false, mid: false, right: false },
    },
    redoStack: [],
};

// ============================================================
// HELPERS
// ============================================================

function getLessenMult(level) {
    const clamped = Math.max(0, Math.min(10, level));
    return LESSEN_MULTS[clamped];
}

function clampInput(id, min, max, fallback) {
    const el = document.getElementById(id);
    let val = parseFloat(el.value);
    if (isNaN(val)) val = fallback;
    val = Math.max(min, Math.min(max, val));
    el.value = val;
    return val;
}

function importVal(val, fallback) {
    return (val !== undefined && val !== null) ? val : fallback;
}

function createSideState() {
    return { tick: 0, st: STATUS.NONE, tr: false, rebuffs: {}, dmg: 0 };
}

function createBattleState() {
    return { weather: WEATHER.CLEAR, field: FIELD_NONE, left: createSideState(), mid: createSideState(), right: createSideState() };
}

function deepClone(obj) {
    return structuredClone(obj);
}

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
        btn.addEventListener('click', () => { options.onAction(); toast.remove(); });
        actionsSpan.appendChild(btn);
        toast.appendChild(actionsSpan);
    }

    document.body.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('toast-visible');

    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, options.duration || 3000);
}

// ============================================================
// ENGINE
// ============================================================

const engine = {
    simulate(history, config) {
        const { circuit, weakness, potent, pokey, lessenPoison, lessenTrap, lessenField,
                sandShelter, snowShelter, antitoxin, escapeArtist, startHp, fieldImmunities } = config;

        const multP = getLessenMult(lessenPoison);
        const multT = getLessenMult(lessenTrap);
        const multF = getLessenMult(lessenField);

        let totalDmg = 0;
        let simTurns = 0;
        const state = createBattleState();
        const events = [];

        history.forEach((h, index) => {
            if (h.delta) {
                if (h.delta.weather !== undefined) state.weather = h.delta.weather;
                if (h.delta.field !== undefined) state.field = h.delta.field;

                SIDES.forEach(s => {
                    if (h.delta[s]) {
                        if (h.delta[s].st && !antitoxin) state[s].st = h.delta[s].st;
                        if (h.delta[s].tr && !escapeArtist) state[s].tr = true;
                        if (h.delta[s].rebAdd) {
                            for (const t in h.delta[s].rebAdd) {
                                state[s].rebuffs[t] = Math.min(MAX_REBUFF_STACKS, (state[s].rebuffs[t] || 0) + h.delta[s].rebAdd[t]);
                            }
                        }
                    }
                });
            }

            let actionTurn;
            if (h.actor === ACTORS.ENTRY) {
                actionTurn = 0;
            } else if (h.actor === ACTORS.USER && h.action === ACTIONS.MAX) {
                actionTurn = simTurns;
            } else {
                simTurns++;
                actionTurn = simTurns;
            }

            let turnDmg = 0;
            const d = { w: 0, p: 0, t: 0, f: 0 };
            const isEnemyAction = [ACTORS.LEFT, ACTORS.MID, ACTORS.RIGHT].includes(h.actor);

            if (isEnemyAction) {
                const target = h.actor.toLowerCase();
                const hpMax = (target === 'mid') ? circuit.mid : circuit.side;
                const actualStartHp = hpMax * (startHp[target] / 100);
                let currentHp = actualStartHp - state[target].dmg;

                if (currentHp > 0 && (h.action === ACTIONS.PM || h.action === ACTIONS.TM)) {
                    if (state.weather === WEATHER.SANDSTORM && !sandShelter) d.w = hpMax * DMG_FRAC.WEATHER;
                    if (state.weather === WEATHER.HAILSTORM && !snowShelter) d.w = hpMax * DMG_FRAC.WEATHER;
                    if (d.w > currentHp) d.w = currentHp;
                    currentHp -= d.w;
                }

                if (h.action === ACTIONS.PM && currentHp > 0 && state[target].st !== STATUS.NONE && !antitoxin) {
                    state[target].tick++;
                    const isBadPoison = state[target].st === STATUS.BAD_POISON;
                    const effectiveTick = isBadPoison ? Math.min(state[target].tick, BAD_POISON_MAX_TICK) : 1;
                    const baseFrac = isBadPoison ? (effectiveTick * DMG_FRAC.BAD_POISON) : DMG_FRAC.POISON;

                    d.p = hpMax * baseFrac * (1 + potent * 0.1) * multP;
                    if (d.p > currentHp) d.p = currentHp;
                    currentHp -= d.p;
                }

                if (h.action === ACTIONS.PM && currentHp > 0 && state[target].tr && !escapeArtist) {
                    d.t = hpMax * DMG_FRAC.TRAP * (1 + pokey * 0.1) * multT;
                    if (d.t > currentHp) d.t = currentHp;
                    currentHp -= d.t;
                }

                // Check Field Immunity array before applying damage
                if (currentHp > 0 && state.field !== FIELD_NONE && (h.action === ACTIONS.PM || h.action === ACTIONS.TM)) {
                    if (!fieldImmunities.includes(state.field)) {
                        const weakMult = (state.field === weakness) ? 2 : 1;
                        const rBonus = REBUFF_MULT[state[target].rebuffs[state.field] || 0] || 0;
                        d.f = hpMax * DMG_FRAC.FIELD * (1 + rBonus) * multF * weakMult;
                        if (d.f > currentHp) d.f = currentHp;
                        currentHp -= d.f;
                    }
                }

                turnDmg = d.w + d.p + d.t + d.f;
                state[target].dmg += turnDmg;
                totalDmg += turnDmg;
            }

            events.push({ actor: h.actor, action: h.action, delta: h.delta, turn: actionTurn, dmg: { ...d }, turnDmg, antitoxin, escapeArtist, isLatest: (index === history.length - 1) });
        });

        const totalHP = circuit.mid + (circuit.side * 2);
        return { state: deepClone(state), turns: simTurns, totalDmg, score: Math.round((totalDmg / totalHP) * circuit.pts), events };
    },
};

// ============================================================
// RENDERER
// ============================================================

const renderer = {
    _typeOptionsHTML: '',

    initTypeOptions() {
        this._typeOptionsHTML = TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
        document.getElementById('weakness').innerHTML = this._typeOptionsHTML;
        document.getElementById('df_imm_type').innerHTML = this._typeOptionsHTML;
    },

    getTypeOptionsHTML() { return this._typeOptionsHTML; },

    renderFieldImmunities(immunities, isCustom) {
        const container = document.getElementById('df_imm_tags');
        container.innerHTML = '';
        
        if (immunities.length === 0) {
            container.innerHTML = '<span style="font-size:12px; color:var(--text-muted); font-style:italic;">None</span>';
            return;
        }

        immunities.forEach(t => {
            const icon = TYPE_ICONS[t] || '';
            const badge = document.createElement('span');
            badge.className = 'rebuff-badge';
            badge.innerHTML = `${icon} ${t} `;
            
            if (isCustom) {
                const removeBtn = document.createElement('b');
                removeBtn.textContent = '×';
                removeBtn.setAttribute('role', 'button');
                removeBtn.setAttribute('tabindex', '0');
                removeBtn.setAttribute('aria-label', `Remove ${t} immunity`);
                removeBtn.dataset.removeDfImm = t;
                badge.appendChild(removeBtn);
            }
            container.appendChild(badge);
        });
    },

    buildEnemyCards() {
        const container = document.getElementById('targetRowsContainer');
        const fragment = document.createDocumentFragment();

        SIDES.forEach(side => {
            const card = document.createElement('div');
            card.className = 'enemy-card';
            card.innerHTML = `
                <div class="enemy-card-title">${side.toUpperCase()} Enemy</div>
                <div class="mod-row-inner"><label style="margin:0;">Status</label><div class="btn-group" style="flex:1; margin-left:10px;"><button class="btn" style="flex:1; padding: 4px 0;" id="mod_${side}_st_Poison" data-mod-status="${side}" data-status-val="${STATUS.POISON}">🟣 Poison</button><button class="btn" style="flex:1; padding: 4px 0;" id="mod_${side}_st_BadPoison" data-mod-status="${side}" data-status-val="${STATUS.BAD_POISON}">☠️ Bad P.</button></div></div>
                <div class="mod-row-inner"><label style="margin:0;">Trap</label><div class="btn-group" style="flex:1; margin-left:10px;"><button class="btn" style="width:100%; padding: 4px 0;" id="mod_${side}_tr" data-mod-trap="${side}">🌪️ Trap</button></div></div>
                <div class="mod-row-inner" style="border-top:1px dashed var(--border-light); padding-top:8px; margin-top:4px;"><label style="margin:0;">Rebuff <span class="help-icon" role="button" tabindex="0" aria-label="Help: Type Rebuff" data-help="rebuff">?</span></label><div style="display:flex; align-items:center; gap:5px; flex:1; justify-content:flex-end;"><select id="mod_${side}_reb_type" class="compact" style="width:85px;">${this._typeOptionsHTML}</select><button class="btn btn-primary" style="padding: 4px 10px;" data-add-rebuff="${side}">+ Add</button></div></div><div id="mod_${side}_reb_tags" class="rebuff-tags-container"></div>
                <button id="btn_apply_all_${side}" class="btn" style="display:none; width:100%; margin-top:10px; color:var(--primary); border-color:var(--primary); background:var(--input-bg);" data-apply-all="${side}">⬇️ Apply to All</button>
            `;
            fragment.appendChild(card);
        });

        container.appendChild(fragment);
    },

    renderDashboard(config) {
        const { state, score, totalDmg, turns } = store.computed;
        const circuit = config.circuit;

        const scoreEl = document.getElementById('scoreDisplay');
        const newScore = score.toLocaleString() + ' pts';
        if (scoreEl.textContent !== newScore) {
            scoreEl.textContent = newScore;
            scoreEl.classList.add('score-bump');
            setTimeout(() => scoreEl.classList.remove('score-bump'), 250);
        }

        document.getElementById('dmgDisplay').textContent = 'Total DMG: ' + Math.floor(totalDmg).toLocaleString();
        document.getElementById('turnDisplay').textContent = `TURN ${turns}`;
        document.getElementById('envDisplay').textContent = `Environment — Weather: ${state.weather} | Field: ${state.field}`;

        SIDES.forEach(s => {
            const hpMax = s === 'mid' ? circuit.mid : circuit.side;
            const hpRemainingPct = (((hpMax * (config.startHp[s] / 100)) - state[s].dmg) / hpMax) * 100;
            const isDead = hpRemainingPct <= 0;

            let rebText = Object.entries(state[s].rebuffs).map(([t, val]) => `${TYPE_ICONS[t] || ''} ${t} -${val}`).join(', ') || 'None';
            const statusIcon = state[s].st === STATUS.POISON ? '🟣 Poison' : state[s].st === STATUS.BAD_POISON ? '☠️ Bad P.' : '✅ Healthy';

            document.getElementById(`dash_${s}`).innerHTML = `<span class="dash-name">${s.toUpperCase()} (${isDead ? '0.00' : hpRemainingPct.toFixed(2)}%)</span><div class="dash-detail">Stat: <span style="font-weight:bold; color:${state[s].st !== STATUS.NONE ? '#8e44ad' : 'inherit'}">${statusIcon}</span><br>Trap: <span style="font-weight:bold; color:${state[s].tr ? '#e67e22' : 'inherit'}">${state[s].tr ? '🌪️ Yes' : 'No'}</span><br>Rebuffs: <span style="font-weight:bold; color:#2980b9">${rebText}</span>${isDead ? '<br><span style="color:var(--danger); font-weight:bold;">KO</span>' : ''}</div>`;

            const btnIdPrefix = s.charAt(0).toUpperCase() + s.slice(1);
            if (document.getElementById(`btn_${btnIdPrefix}_TM`)) document.getElementById(`btn_${btnIdPrefix}_TM`).disabled = isDead;
            if (document.getElementById(`btn_${btnIdPrefix}_PM`)) document.getElementById(`btn_${btnIdPrefix}_PM`).disabled = isDead;
        });
    },

    renderTimeline(events) {
        const logArea = document.getElementById('logArea');
        if (events.length === 0) return logArea.innerHTML = '';

        const fragment = document.createDocumentFragment();
        for (let i = events.length - 1; i >= 0; i--) {
            const evt = events[i];
            const entry = document.createElement('div');
            entry.className = `log-entry ${evt.actor === ACTORS.ENTRY ? 'entry-phase' : ''} ${evt.isLatest ? 'latest-entry' : ''}`;
            if (evt.actor === ACTORS.USER) entry.style.borderLeftColor = '#f1c40f';

            const actorDisplay = evt.actor === ACTORS.ENTRY ? '⭐ ENTRY PHASE' : evt.actor === ACTORS.USER ? `🦸‍♂️ USER ${evt.action}` : `👿 ${evt.actor.toUpperCase()} ${evt.action}`;
            let detailsHtml = '<div class="detail-item">No passive damage taken.</div>';

            if (evt.actor === ACTORS.ENTRY || evt.actor === ACTORS.USER) {
                if (evt.delta) {
                    const changes = [];
                    if (evt.delta.weather !== undefined) changes.push(`🌤️ Weather ➔ ${evt.delta.weather}`);
                    if (evt.delta.field !== undefined) changes.push(`🌐 Field ➔ ${evt.delta.field}`);
                    SIDES.forEach(s => {
                        if (evt.delta[s]) {
                            const sName = s.toUpperCase();
                            if (evt.delta[s].st && !evt.antitoxin) changes.push(`☠️ ${sName} ➔ ${evt.delta[s].st}`);
                            if (evt.delta[s].tr && !evt.escapeArtist) changes.push(`🌪️ ${sName} ➔ Trapped`);
                            if (evt.delta[s].rebAdd) for (const t in evt.delta[s].rebAdd) changes.push(`📉 ${sName} ➔ ${t} Rebuff -${evt.delta[s].rebAdd[t]}`);
                        }
                    });
                    detailsHtml = changes.length > 0 ? changes.map(c => `<div class="detail-item">${c}</div>`).join('') : '<div class="detail-item" style="font-style:italic">No effects modified.</div>';
                }
            } else if (evt.turnDmg > 0) {
                let gridItems = '';
                if (evt.dmg.w > 0) gridItems += `<div>❄️/🏜️ Weather: ${Math.floor(evt.dmg.w).toLocaleString()}</div>`;
                if (evt.dmg.p > 0) gridItems += `<div>☠️ Poison: ${Math.floor(evt.dmg.p).toLocaleString()}</div>`;
                if (evt.dmg.t > 0) gridItems += `<div>🌪️ Trap: ${Math.floor(evt.dmg.t).toLocaleString()}</div>`;
                if (evt.dmg.f > 0) gridItems += `<div>🌐 Field: ${Math.floor(evt.dmg.f).toLocaleString()}</div>`;
                detailsHtml = `<div class="dmg-grid">${gridItems}</div><div class="total-line">Turn Passive DMG: ${Math.floor(evt.turnDmg).toLocaleString()}</div>`;
            }

            entry.innerHTML = `<div class="log-header"><span>${actorDisplay}</span><span class="turn-badge">Turn ${evt.turn}</span></div>${detailsHtml}`;
            fragment.appendChild(entry);
        }
        logArea.innerHTML = '';
        logArea.appendChild(fragment);
    },

    updateModifierPanel() {
        const anti = document.getElementById('antitoxin').checked;
        const esc = document.getElementById('escapeArtist').checked;
        const { pendingState, pendingRebuffs, sessionMods, appliedToAll } = store.panel;

        SIDES.forEach(side => {
            const isStLocked = store.current[side].st !== STATUS.NONE;
            document.getElementById(`mod_${side}_st_Poison`).disabled = isStLocked || anti;
            document.getElementById(`mod_${side}_st_BadPoison`).disabled = isStLocked || anti;
            document.getElementById(`mod_${side}_tr`).disabled = store.current[side].tr || esc;

            if (anti) pendingState[side].st = STATUS.NONE;
            if (esc) pendingState[side].tr = false;

            document.getElementById(`mod_${side}_st_Poison`).className = (pendingState[side].st === STATUS.POISON) ? 'btn btn-active' : 'btn';
            document.getElementById(`mod_${side}_st_BadPoison`).className = (pendingState[side].st === STATUS.BAD_POISON) ? 'btn btn-active' : 'btn';
            document.getElementById(`mod_${side}_tr`).className = (pendingState[side].tr) ? 'btn btn-active' : 'btn';

            const container = document.getElementById(`mod_${side}_reb_tags`);
            container.innerHTML = '';
            for (const t of TYPES) {
                if (pendingRebuffs[side][t] > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'rebuff-badge';
                    badge.innerHTML = `${TYPE_ICONS[t] || ''} ${t} -${pendingRebuffs[side][t]} <b role="button" tabindex="0" data-remove-rebuff-side="${side}" data-remove-rebuff-type="${t}">×</b>`;
                    container.appendChild(badge);
                }
            }

            const applyBtn = document.getElementById(`btn_apply_all_${side}`);
            if (applyBtn) applyBtn.style.display = ((sessionMods[side].st || sessionMods[side].tr || Object.keys(pendingRebuffs[side]).length > 0) && !appliedToAll[side]) ? 'block' : 'none';
        });
    },
};

// ============================================================
// UI & LOGIC
// ============================================================

const ui = {
    readConfig() {
        return {
            circuit: CIRCUITS[document.getElementById('circuit').value] || CIRCUITS[8],
            weakness: document.getElementById('weakness').value,
            potent: parseInt(document.getElementById('potent').value) || 0,
            pokey: parseInt(document.getElementById('pokey').value) || 0,
            lessenPoison: parseInt(document.getElementById('lessP').value) || 0,
            lessenTrap: parseInt(document.getElementById('lessT').value) || 0,
            lessenField: parseInt(document.getElementById('lessF').value) || 0,
            sandShelter: document.getElementById('sandShelter').checked,
            snowShelter: document.getElementById('snowShelter').checked,
            antitoxin: document.getElementById('antitoxin').checked,
            escapeArtist: document.getElementById('escapeArtist').checked,
            fieldImmunities: store.fieldImmunities,
            startHp: {
                left: clampInput('startHp_left', 1, 100, 100),
                mid: clampInput('startHp_mid', 1, 100, 100),
                right: clampInput('startHp_right', 1, 100, 100),
            },
        };
    },

    calc() {
        const config = ui.readConfig();
        const result = engine.simulate(store.history, config);
        store.computed = { state: result.state, score: result.score, totalDmg: result.totalDmg, turns: result.turns, events: result.events };
        store.current = deepClone(result.state);
        renderer.renderDashboard(config);
        renderer.renderTimeline(result.events);
        if (document.getElementById('modifierPanel').style.display === 'block') renderer.updateModifierPanel();
    },

    toggleSettings() {
        const content = document.getElementById('globalSettingsContent');
        const icon = document.getElementById('settingsToggleIcon');
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        icon.textContent = isHidden ? '▼' : '▶';
    },

    stepper(id, delta, min, max, isBossProp) {
        const inp = document.getElementById(id);
        if (inp.disabled) return;
        inp.value = Math.max(min, Math.min(max, (parseInt(inp.value) || 0) + delta));
        document.getElementById('txt_' + id).textContent = inp.value;
        if (isBossProp) ui.setCustomBoss();
        ui.calc();
    },

    applyBoss() {
        const b = document.getElementById('bossSelect').value;
        const props = document.querySelectorAll('.boss-prop');
        if (b === 'custom') {
            props.forEach(el => el.disabled = false);
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
        
        store.fieldImmunities = [...data.dfI];
        renderer.renderFieldImmunities(store.fieldImmunities, false);

        props.forEach(el => el.disabled = true);
        ui.calc();
    },

    setCustomBoss() {
        document.getElementById('bossSelect').value = 'custom';
        document.querySelectorAll('.boss-prop').forEach(el => el.disabled = false);
        renderer.renderFieldImmunities(store.fieldImmunities, true);
    },
    
    addFieldImmunity(type) {
        if (!store.fieldImmunities.includes(type)) {
            store.fieldImmunities.push(type);
            ui.setCustomBoss();
            ui.calc();
        }
    },
    
    removeFieldImmunity(type) {
        store.fieldImmunities = store.fieldImmunities.filter(t => t !== type);
        ui.setCustomBoss();
        ui.calc();
    },

    toggleTheme() {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        isDark ? document.body.removeAttribute('data-theme') : document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    },

    openHelp(key) {
        if (!HELP_TEXTS[key]) return;
        document.getElementById('modalTitle').textContent = HELP_TEXTS[key].title;
        document.getElementById('modalDesc').innerHTML = HELP_TEXTS[key].desc;
        document.getElementById('infoModal').style.display = 'block';
    },
    closeModal() { document.getElementById('infoModal').style.display = 'none'; },

    openModifier(action) {
        store.panel = { action, pendingState: deepClone(store.current), pendingRebuffs: { left: {}, mid: {}, right: {} }, sessionMods: { left: { st: false, tr: false }, mid: { st: false, tr: false }, right: { st: false, tr: false } }, appliedToAll: { left: false, mid: false, right: false } };
        const wSelect = document.getElementById('modWeather');
        const fSelect = document.getElementById('modField');
        
        wSelect.innerHTML = action !== ACTIONS.ENTRY ? '<option value="Unchanged">-- Unchanged --</option>' : '';
        fSelect.innerHTML = action !== ACTIONS.ENTRY ? '<option value="Unchanged">-- Unchanged --</option>' : '';
        wSelect.innerHTML += `<option value="${WEATHER.CLEAR}">Clear</option><option value="${WEATHER.SANDSTORM}">Sandstorm</option><option value="${WEATHER.HAILSTORM}">Hailstorm</option>`;
        fSelect.innerHTML += `<option value="${FIELD_NONE}">None</option>` + renderer.getTypeOptionsHTML();
        
        wSelect.value = action === ACTIONS.ENTRY ? store.current.weather : 'Unchanged';
        fSelect.value = action === ACTIONS.ENTRY ? store.current.field : 'Unchanged';
        
        document.getElementById('modTitle').textContent = action === ACTIONS.ENTRY ? '⭐ Initial Entry Effects' : `⚡ Configure Effects for User ${action}`;
        document.getElementById('modifierPanel').style.display = 'block';
        renderer.updateModifierPanel();
        if (action !== ACTIONS.ENTRY) document.getElementById('modifierPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    setModStatus(side, val) {
        if (store.current[side].st !== STATUS.NONE || document.getElementById('antitoxin').checked) return;
        store.panel.pendingState[side].st = store.panel.pendingState[side].st === val ? STATUS.NONE : val;
        store.panel.sessionMods[side].st = true; store.panel.appliedToAll[side] = false;
        renderer.updateModifierPanel();
    },

    toggleModTrap(side) {
        if (store.current[side].tr || document.getElementById('escapeArtist').checked) return;
        store.panel.pendingState[side].tr = !store.panel.pendingState[side].tr;
        store.panel.sessionMods[side].tr = true; store.panel.appliedToAll[side] = false;
        renderer.updateModifierPanel();
    },

    addRebuffTag(side) {
        const t = document.getElementById(`mod_${side}_reb_type`).value;
        if ((store.current[side].rebuffs[t] || 0) + (store.panel.pendingRebuffs[side][t] || 0) < MAX_REBUFF_STACKS) {
            store.panel.pendingRebuffs[side][t] = (store.panel.pendingRebuffs[side][t] || 0) + 1;
            store.panel.appliedToAll[side] = false;
            renderer.updateModifierPanel();
        }
    },

    removeRebuffTag(side, t) {
        if (store.panel.pendingRebuffs[side][t] > 0) {
            if (--store.panel.pendingRebuffs[side][t] === 0) delete store.panel.pendingRebuffs[side][t];
            store.panel.appliedToAll[side] = false;
            renderer.updateModifierPanel();
        }
    },

    applyToAll(source) {
        SIDES.filter(t => t !== source).forEach(target => {
            store.panel.pendingState[target].st = store.current[target].st;
            store.panel.pendingState[target].tr = store.current[target].tr;
            store.panel.pendingRebuffs[target] = {};

            if (store.panel.sessionMods[source].st && !document.getElementById('antitoxin').checked && store.current[target].st === STATUS.NONE) {
                store.panel.pendingState[target].st = store.panel.pendingState[source].st;
                store.panel.sessionMods[target].st = true;
            }
            if (store.panel.sessionMods[source].tr && !document.getElementById('escapeArtist').checked && !store.current[target].tr) {
                store.panel.pendingState[target].tr = store.panel.pendingState[source].tr;
                store.panel.sessionMods[target].tr = true;
            }
            for (const t in store.panel.pendingRebuffs[source]) {
                const max = MAX_REBUFF_STACKS - (store.current[target].rebuffs[t] || 0);
                if (max > 0) store.panel.pendingRebuffs[target][t] = Math.min(store.panel.pendingRebuffs[source][t], max);
            }
            store.panel.appliedToAll[target] = true;
        });
        store.panel.appliedToAll[source] = true;
        renderer.updateModifierPanel();
    },

    commitModifier() {
        // Discard any active toast cleanly when making a new action
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();
        
        const delta = { left: {}, mid: {}, right: {} };
        const wVal = document.getElementById('modWeather').value;
        const fVal = document.getElementById('modField').value;

        if (store.panel.action === ACTIONS.ENTRY) {
            if (wVal !== store.current.weather) delta.weather = wVal;
            if (fVal !== store.current.field) delta.field = fVal;
        } else {
            if (wVal !== 'Unchanged') delta.weather = wVal;
            if (fVal !== 'Unchanged') delta.field = fVal;
        }

        SIDES.forEach(s => {
            if (store.panel.pendingState[s].st !== store.current[s].st) delta[s].st = store.panel.pendingState[s].st;
            if (store.panel.pendingState[s].tr !== store.current[s].tr) delta[s].tr = true;
            if (Object.keys(store.panel.pendingRebuffs[s]).length > 0) delta[s].rebAdd = { ...store.panel.pendingRebuffs[s] };
        });

        store.history.push({ actor: store.panel.action === ACTIONS.ENTRY ? ACTORS.ENTRY : ACTORS.USER, action: store.panel.action, delta });
        store.redoStack = [];
        document.getElementById('modifierPanel').style.display = 'none';
        document.getElementById('actionContainer').style.display = 'block';
        document.getElementById('tlHeader').style.display = 'flex';
        ui.calc();
    },

    commitEnemy(actor, action) {
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();

        store.history.push({ actor, action, delta: null });
        store.redoStack = [];
        document.getElementById('modifierPanel').style.display = 'none';
        ui.calc();
    },

    undo() {
        if (store.history.length === 0) return;
        store.redoStack.push(store.history.pop());
        ui.calc();
        showToast('↺ Action undone.', {
            duration: 5000, actionLabel: '↻ Redo', onAction: () => {
                if (store.redoStack.length > 0) { store.history.push(store.redoStack.pop()); ui.calc(); }
            }
        });
    },

    resetBattle() {
        if (confirm('Are you sure you want to reset the entire battle?')) {
            window.history.replaceState({}, document.title, window.location.pathname);
            location.reload();
        }
    },

    // --- Import / Export (LZ-String Compressed & Minified) ---
    _minifyHistory(history) {
        return history.map(h => {
            const min = { a: h.actor, c: h.action };
            if (h.delta) {
                min.d = {};
                if (h.delta.weather !== undefined) min.d.w = h.delta.weather;
                if (h.delta.field !== undefined) min.d.f = h.delta.field;
                SIDES.forEach(s => {
                    if (h.delta[s]) {
                        min.d[s.charAt(0)] = {};
                        if (h.delta[s].st !== undefined) min.d[s.charAt(0)].s = h.delta[s].st;
                        if (h.delta[s].tr !== undefined) min.d[s.charAt(0)].t = h.delta[s].tr;
                        if (h.delta[s].rebAdd) min.d[s.charAt(0)].r = h.delta[s].rebAdd;
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
                        h.delta[sm[sc]] = {};
                        if (min.d[sc].s !== undefined) h.delta[sm[sc]].st = min.d[sc].s;
                        if (min.d[sc].t !== undefined) h.delta[sm[sc]].tr = min.d[sc].t;
                        if (min.d[sc].r) h.delta[sm[sc]].rebAdd = min.d[sc].r;
                    }
                });
            }
            return h;
        });
    },

    validateHistory(h) {
        if (!Array.isArray(h)) return [];
        return h.filter(entry => {
            if (!entry || typeof entry !== 'object' || !VALID_ACTORS.includes(entry.actor) || !VALID_ACTIONS.includes(entry.action)) return false;
            if (entry.delta !== null && entry.delta !== undefined) {
                if (typeof entry.delta !== 'object') return false;
                if (entry.delta.weather !== undefined && !VALID_WEATHERS.includes(entry.delta.weather)) return false;
                if (entry.delta.field !== undefined && entry.delta.field !== FIELD_NONE && !TYPES.includes(entry.delta.field)) return false;
            }
            return true;
        });
    },

    exportToURL() {
        const exportData = { b: document.getElementById('bossSelect').value, c: document.getElementById('circuit').value };
        
        if (exportData.b === 'custom') {
            exportData.w = document.getElementById('weakness').value;
            exportData.lp = document.getElementById('lessP').value;
            exportData.lt = document.getElementById('lessT').value;
            exportData.lf = document.getElementById('lessF').value;
            if (document.getElementById('sandShelter').checked) exportData.ss = 1;
            if (document.getElementById('snowShelter').checked) exportData.sno = 1;
            if (document.getElementById('escapeArtist').checked) exportData.ea = 1;
            if (document.getElementById('antitoxin').checked) exportData.anti = 1;
            if (store.fieldImmunities.length > 0) exportData.dfi = store.fieldImmunities;
        }

        const hpl = document.getElementById('startHp_left').value; if (hpl !== '100') exportData.hpl = hpl;
        const hpm = document.getElementById('startHp_mid').value; if (hpm !== '100') exportData.hpm = hpm;
        const hpr = document.getElementById('startHp_right').value; if (hpr !== '100') exportData.hpr = hpr;
        const pt = document.getElementById('potent').value; if (pt !== '0') exportData.pt = pt;
        const pk = document.getElementById('pokey').value; if (pk !== '0') exportData.pk = pk;
        
        if (store.history.length > 0) exportData.h = this._minifyHistory(store.history);

        const url = new URL(window.location.href);
        url.searchParams.set('data', LZString.compressToEncodedURIComponent(JSON.stringify(exportData)));
        navigator.clipboard.writeText(url.href).then(() => showToast('🔗 Shareable link copied to clipboard!')).catch(() => prompt('Copy this URL:', url.href));
    },

    importFromURL() {
        const dataParam = new URLSearchParams(window.location.search).get('data');
        if (!dataParam) return;
        try {
            const data = JSON.parse(LZString.decompressFromEncodedURIComponent(dataParam));
            const b = importVal(data.b, 'custom');
            document.getElementById('bossSelect').value = b;
            document.getElementById('circuit').value = importVal(data.c, '8');

            if (b !== 'custom') {
                this.applyBoss();
            } else {
                document.getElementById('weakness').value = importVal(data.w, 'Ice');
                document.getElementById('lessP').value = importVal(data.lp, 10);
                document.getElementById('txt_lessP').textContent = importVal(data.lp, 10);
                document.getElementById('lessT').value = importVal(data.lt, 9);
                document.getElementById('txt_lessT').textContent = importVal(data.lt, 9);
                document.getElementById('lessF').value = importVal(data.lf, 9);
                document.getElementById('txt_lessF').textContent = importVal(data.lf, 9);
                document.getElementById('sandShelter').checked = !!data.ss;
                document.getElementById('snowShelter').checked = !!data.sno;
                document.getElementById('escapeArtist').checked = !!data.ea;
                document.getElementById('antitoxin').checked = !!data.anti;
                store.fieldImmunities = Array.isArray(data.dfi) ? data.dfi : [];
                renderer.renderFieldImmunities(store.fieldImmunities, true);
            }

            document.getElementById('startHp_left').value = importVal(data.hpl, 100);
            document.getElementById('startHp_mid').value = importVal(data.hpm, 100);
            document.getElementById('startHp_right').value = importVal(data.hpr, 100);
            document.getElementById('potent').value = importVal(data.pt, 0);
            document.getElementById('txt_potent').textContent = importVal(data.pt, 0);
            document.getElementById('pokey').value = importVal(data.pk, 0);
            document.getElementById('txt_pokey').textContent = importVal(data.pk, 0);

            store.history = this.validateHistory(this._hydrateHistory(data.h || []));
        } catch (e) {
            console.error('Failed to import data:', e);
            showToast('⚠️ Link corrupted. Loading fresh battle.', { duration: 5000 });
        }
    },

    bindEvents() {
        document.getElementById('themeToggleBtn').addEventListener('click', () => ui.toggleTheme());
        document.getElementById('settingsToggle').addEventListener('click', () => ui.toggleSettings());
        document.getElementById('bossSelect').addEventListener('change', () => ui.applyBoss());
        document.getElementById('circuit').addEventListener('change', () => ui.calc());
        document.getElementById('weakness').addEventListener('change', () => { ui.setCustomBoss(); ui.calc(); });
        ['sandShelter', 'snowShelter', 'escapeArtist', 'antitoxin'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => { ui.setCustomBoss(); ui.calc(); });
        });
        ['startHp_left', 'startHp_mid', 'startHp_right'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => ui.calc());
        });

        document.addEventListener('click', (e) => {
            const stepBtn = e.target.closest('[data-stepper]');
            if (stepBtn) { e.preventDefault(); ui.stepper(stepBtn.dataset.stepper, parseInt(stepBtn.dataset.delta), parseInt(stepBtn.dataset.min), parseInt(stepBtn.dataset.max), stepBtn.dataset.boss === 'true'); return; }
            const helpEl = e.target.closest('[data-help]');
            if (helpEl) { e.preventDefault(); e.stopPropagation(); ui.openHelp(helpEl.dataset.help); return; }
            const userBtn = e.target.closest('[data-user-action]');
            if (userBtn) { e.preventDefault(); ui.openModifier(userBtn.dataset.userAction); return; }
            const enemyBtn = e.target.closest('[data-enemy-actor]');
            if (enemyBtn) { e.preventDefault(); ui.commitEnemy(enemyBtn.dataset.enemyActor, enemyBtn.dataset.enemyAction); return; }
            const statusBtn = e.target.closest('[data-mod-status]');
            if (statusBtn) { e.preventDefault(); ui.setModStatus(statusBtn.dataset.modStatus, statusBtn.dataset.statusVal); return; }
            const trapBtn = e.target.closest('[data-mod-trap]');
            if (trapBtn) { e.preventDefault(); ui.toggleModTrap(trapBtn.dataset.modTrap); return; }
            const addRebuffBtn = e.target.closest('[data-add-rebuff]');
            if (addRebuffBtn) { e.preventDefault(); ui.addRebuffTag(addRebuffBtn.dataset.addRebuff); return; }
            const removeRebuffBtn = e.target.closest('[data-remove-rebuff-side]');
            if (removeRebuffBtn) { e.preventDefault(); ui.removeRebuffTag(removeRebuffBtn.dataset.removeRebuffSide, removeRebuffBtn.dataset.removeRebuffType); return; }
            const applyBtn = e.target.closest('[data-apply-all]');
            if (applyBtn) { e.preventDefault(); ui.applyToAll(applyBtn.dataset.applyAll); return; }
            const addDfImmBtn = e.target.closest('[data-add-df-imm]');
            if (addDfImmBtn) { e.preventDefault(); ui.addFieldImmunity(document.getElementById('df_imm_type').value); return; }
            const removeDfImmBtn = e.target.closest('[data-remove-df-imm]');
            if (removeDfImmBtn) { e.preventDefault(); ui.removeFieldImmunity(removeDfImmBtn.dataset.removeDfImm); return; }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const helpEl = e.target.closest('[data-help]');
                if (helpEl) { e.preventDefault(); ui.openHelp(helpEl.dataset.help); }
            }
            if (e.key === 'Escape' && document.getElementById('infoModal').style.display === 'block') ui.closeModal();
        });

        document.getElementById('modalCloseBtn').addEventListener('click', () => ui.closeModal());
        document.getElementById('infoModal').addEventListener('click', (e) => { if (e.target === document.getElementById('infoModal')) ui.closeModal(); });
        document.getElementById('confirmModifierBtn').addEventListener('click', () => ui.commitModifier());
        document.getElementById('exportBtn').addEventListener('click', () => ui.exportToURL());
        document.getElementById('undoBtn').addEventListener('click', () => ui.undo());
        document.getElementById('resetBtn').addEventListener('click', () => ui.resetBattle());
    }
};

// ============================================================
// AUTO-UPDATE CHECKER
// ============================================================

function checkForUpdates() {
    const currentVersion = document.querySelector('meta[name="app-version"]')?.content;
    if (!currentVersion) return;

    fetch(window.location.pathname + '?t=' + Date.now())
        .then(res => res.text())
        .then(html => {
            const match = html.match(/<meta name="app-version" content="([^"]+)">/);
            if (match && match[1] !== currentVersion) {
                showToast('🔄 A new version of the simulator is available!', {
                    duration: 15000, actionLabel: 'Update Now', onAction: () => location.reload()
                });
            }
        })
        .catch(e => console.log('Update check failed', e));
}

// ============================================================
// INITIALISATION
// ============================================================

function initApp() {
    if (localStorage.getItem('theme') === 'dark') document.body.setAttribute('data-theme', 'dark');

    renderer.initTypeOptions();
    renderer.buildEnemyCards();
    ui.bindEvents();
    store.current = createBattleState();
    
    ui.importFromURL();

    if (store.history.length > 0) {
        document.getElementById('modifierPanel').style.display = 'none';
        document.getElementById('actionContainer').style.display = 'block';
        document.getElementById('tlHeader').style.display = 'flex';
    } else {
        document.getElementById('bossSelect').value = 'custom';
        renderer.renderFieldImmunities(store.fieldImmunities, true);
        ui.openModifier(ACTIONS.ENTRY);
    }

    ui.calc();
    checkForUpdates();
}

document.addEventListener('DOMContentLoaded', initApp);
