// NEON TIDE v7-coverfix — cutscene.js
// Cutscene / dialog system: the story layer v6r2 never had. Letterboxed
// portrait panels with the speaker's name, colour and initials, advanced
// with Enter / Space / click, skippable. The world freezes while a cutscene
// plays (missions and police hold), so a staged screenshot can keep its
// dialog on screen. State lives on S.cutscene; hud.js renders it.
export const CHARACTERS = {
  kestrel: { name: 'Madame Kestrel', short: 'MK', color: '#8a2a6a', line: 'The queen of the harbor. She owns your debt — and your future.' },
  deke: { name: 'Deke Marlowe', short: 'DM', color: '#0f8a7a', line: 'The getaway driver who came home. Fifty thousand in the hole.' },
  rook: { name: 'Rook', short: 'RK', color: '#aa1111', line: 'The rival who took the Neon Mile while Deke was away.' },
  rosa: { name: "Rosa", short: 'RO', color: '#ff8844', line: 'Runs the garage. Best hands in Port Solano.' },
  vex: { name: 'Vex, the Broker', short: 'VX', color: '#5a3a8a', line: 'Buys and sells the whole east docks.' },
};

export const INTRO_SCENES = [
  { who: 'kestrel', text: '"Fifty thousand dollars, Deke. You left Port Solano. The debt did not."' },
  { who: 'deke', text: '"I came back to pay it. Every cent. Give me work, Madame."' },
  { who: 'kestrel', text: '"Then run my jobs. Eighteen of them. And Deke — Rook owns the Neon Mile now. Take it back."' },
];

export const FINALE_SCENES = [
  { who: 'rook', text: '"You think one driver takes my city? I AM the Neon Mile."' },
  { who: 'deke', text: '"Not anymore. The tide just came in, Rook."' },
  { who: 'kestrel', text: '"Debt paid. The city is yours, Deke. Golden hour, every hour."' },
];

// Mission briefing lines: one spoken line per mission, shown when the
// mission starts (briefing panel) and kept as S.dialog for the HUD.
export const BRIEFINGS = {
  0: { who: 'kestrel', text: '"Welcome back, Deke. Walk to my club. We talk face to face."' },
  1: { who: 'rosa', text: '"That Neon GT out front? Bring it to my garage. No scratches — well, few scratches."' },
  2: { who: 'kestrel', text: '"A package for the Harbor Docks. Ninety seconds. The tide waits for no one."' },
  3: { who: 'deke', text: '"Three stars. Time to disappear. Break their line of sight."' },
  4: { who: 'kestrel', text: '"Rook\'s boys hold the Old Town corner. Clear them off it."' },
  5: { who: 'deke', text: '"Grab the stash, drive it to the drop. Clean and quick."' },
  6: { who: 'kestrel', text: '"Tail the courier. Close enough to hear him — far enough he never sees you."' },
  7: { who: 'deke', text: '"Three crates on the docks. Mine now."' },
  8: { who: 'kestrel', text: '"Five rivals hold the west docks. Take them out."' },
  9: { who: 'rosa', text: '"Race the gates across town. My money says you can\'t. Prove me wrong."' },
  10: { who: 'kestrel', text: '"The vault guards, then the cash, then home. No heroes, Deke."' },
  11: { who: 'deke', text: '"A VIP to Beachfront. No scratches, no cops. Smooth."' },
  12: { who: 'kestrel', text: '"Midnight run. Three stops, ninety seconds. The city is yours tonight."' },
  13: { who: 'kestrel', text: '"Quiet now. The sentries watch the pier. Stay out of their cones."' },
  14: { who: 'deke', text: '"The TIDE Casino. Four thousand dollars, then vanish at the Airfield."' },
  15: { who: 'kestrel', text: '"A storm hit the harbor and the rivals moved in. Clear six of them."' },
  16: { who: 'vex', text: '"You want the east docks, driver? Come and take them from me."' },
  17: { who: 'rook', text: '"King of Port Solano? That crown is mine, Deke. Come and take it."' },
};

export function createCutscene() {
  return { active: false, lines: [], index: 0, who: null, text: '', until: 0, skippable: true };
}

// Start a multi-line cutscene (intro / finale). The world freezes until it
// ends or is skipped; the HUD draws the letterbox + portrait panel.
export function startCutscene(S, lines) {
  const C = S.cutscene;
  C.active = true;
  C.lines = lines;
  C.index = 0;
  C.who = lines[0].who;
  C.text = lines[0].text;
  C.until = S.time + 9999;
  S.missions.frozen = true;
}

export function endCutscene(S) {
  const C = S.cutscene;
  C.active = false;
  C.lines = [];
  C.index = 0;
  C.who = null;
  C.text = '';
  S.missions.frozen = false;
}

// Advance one line; returns true when the cutscene just ended.
export function advanceCutscene(S) {
  const C = S.cutscene;
  if (!C.active) return true;
  C.index += 1;
  if (C.index >= C.lines.length) {
    endCutscene(S);
    return true;
  }
  C.who = C.lines[C.index].who;
  C.text = C.lines[C.index].text;
  return false;
}

export function skipCutscene(S) {
  if (S.cutscene.active) endCutscene(S);
}

// A single spoken briefing line for a mission start: shows the portrait
// panel for a few seconds without freezing the whole world.
export function missionBriefing(S, index) {
  const b = BRIEFINGS[index];
  if (!b) return null;
  S.dialog = { text: `${CHARACTERS[b.who].name}: ${b.text}`, until: S.time + 7, who: b.who };
  return b;
}
