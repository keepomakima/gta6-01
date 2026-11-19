// NEON TIDE v7 "Golden Hour" — chatter.js
// The city talks back. A one-line ticker under the objective that carries
// police dispatch when the heat rises, the radio DJ when the station
// changes, and Port Solano street gossip when nothing is happening. Every
// line is written for this city — no line is reused from anywhere else in
// the game. The ticker is cosmetic only: it never touches money, health,
// wanted level, or mission state, and it stays silent while a cutscene or
// a mission briefing is on screen.

// Police dispatch: the heat is on and every cruiser in the district hears
// about it. Picked when the wanted level climbs.
const DISPATCH_LINES = [
  'Dispatch: suspect last seen tearing down the Neon Mile — all units converge.',
  'Dispatch: air unit AIR-1 is over Downtown, keep the suspect in the spotlight.',
  'Dispatch: roadblock going up at the Marina junction. Do not let them through.',
  'Dispatch: suspect vehicle is a red Neon GT, repeat, red Neon GT.',
  'Dispatch: spike strip ready on the Harbor road. Watch your tires, officers.',
  'Dispatch: Kestrel’s people are asking questions. Bring this one in quiet.',
  'Dispatch: the suspect just blew through a red light at the airfield road. No regard.',
  'Dispatch: witnesses say the driver is grinning. Do not let them enjoy this.',
  'Dispatch: harbor patrol is closing the marina exits. The net is tightening.',
];

// The helicopter crew talks when AIR-1 is overhead at wanted 4 or 5.
const HELI_LINES = [
  'AIR-1: I’ve got eyes on the car. They’re not shaking us tonight.',
  'AIR-1: Spotlight on the suspect — ground units, move in.',
  'AIR-1: Suspect is pushing 200 on the boardwalk. This one’s fearless.',
  'AIR-1: Fuel’s fine, we can stay up all night. Can they?',
  'AIR-1: The suspect keeps cutting through side streets. Somebody knows this city.',
  'AIR-1: Ground units are two blocks out. Keep the light on them.',
];

// The three stations have their own DJs, and each one greets von when the
// dial lands on them.
const DJ_LINES = {
  tide: [
    'Tide FM: golden hour, golden tunes — this one’s for everyone stuck in traffic on the Mile.',
    'Tide FM: you’re listening to the sound of Port Solano at sunset. Stay smooth out there.',
    'Tide FM: request line’s open. Somebody asked for a getaway song — I wonder why.',
  ],
  neon: [
    'Neon Nights: the casino never sleeps and neither does this station.',
    'Neon Nights: that bass you hear is the whole Mile breathing. Turn it up.',
    'Neon Nights: midnight on the strip, and the city is just getting started.',
  ],
  harbor: [
    'Harbor Rock: guitars, salt air, and a long road out of the Marina.',
    'Harbor Rock: this one goes out to every driver who ever outran a roadblock.',
    'Harbor Rock: keep your windows down and your eyes on the horizon.',
  ],
};

// Street gossip: the city idles, and Port Solano fills the silence.
const STREET_LINES = [
  'A vendor on the boardwalk is selling sunset photos of the pier. Business is good.',
  'Somewhere in the Marina, a yacht party is arguing about who owns the harbor.',
  'The Kestrel Club’s line stretches around the block again tonight.',
  'A taxi driver swears the red Neon GT is the fastest thing he’s ever seen.',
  'Gulls over the pier. The fishermen say the tide brings in more than fish.',
  'Neon Mile shopkeepers are already counting tonight’s take.',
  'An old-timer at the docks says Rook used to own these streets. Used to.',
  'The Ironworks Arms sign flickers twice, then holds. Somebody’s buying.',
  'A street musician on the Mile is playing the same three chords as yesterday.',
  'The sunset crowd at the pier is bigger than the church crowd on Sundays.',
  'Somebody painted over the Rook tag on the harbor warehouse overnight.',
];

// Low health: the city notices von is hurting.
const HURT_LINES = [
  'You’re bleeding out — find a safehouse before the heat finds you.',
  'That was too close. Patch up, then get back in the car.',
  'Kestrel hates funerals. Don’t make her attend one.',
];

// Rain: Port Solano gets dramatic when the sky opens.
const RAIN_LINES = [
  'Rain on the Neon Mile — the whole city turns into a mirror.',
  'The storm’s rolling in off the water. Wipers up, foot down.',
  'Even the gulls are taking cover. The harbor doesn’t forgive a slow driver.',
];

// A mission well done: somebody in the crew noticed.
const WIN_LINES = [
  'Clean work. Kestrel will want to hear about this one.',
  'That’s how you do it in Port Solano. No witnesses, no mess.',
  'The crew’s talking about you tonight. Keep it that way.',
  'One more job off the list. The city feels a little smaller already.',
];

// Madame Kestrel, when a new job starts: short, expensive, and never
// repeated twice in a row if she can help it.
const KESTREL_LINES = [
  'Kestrel: another job, another payday. Don’t make me regret trusting you, Deke.',
  'Kestrel: the plan is simple because simple is what survives contact with cops.',
  'Kestrel: Rook’s people are watching the harbor. Be the ghost, not the headline.',
  'Kestrel: I’ve paid for the best driver in Port Solano. Prove the invoice right.',
  'Kestrel: no noise before the job, no trace after it. That’s the whole sermon.',
  'Kestrel: the Neon Mile never forgets a face. Wear the city like it’s yours.',
];

// Deke, when a job goes sideways: gallows humour, then back to work.
const DEKE_LINES = [
  'Deke: well, that went sideways. Dust off, reload, run it back.',
  'Deke: the plan was good. The plan did not survive the cops. Next one will.',
  'Deke: Kestrel’s going to love hearing about this. Not really. At all.',
  'Deke: alright, Port Solano — you win this round. I’ll take the next one.',
  'Deke: note to self — next time, fewer sirens, more exit plan.',
];

// Heat Wave: the endless chase has a voice of its own, and it is not
// a friendly one. Announced once, when the wave starts.
const HEAT_LINES = [
  'Heat Wave is live. Every cruiser in Port Solano just got the same order: you.',
  'Heat Wave: the city is coming for you in waves. Survive them all.',
  'Heat Wave: AIR-1 is up, the roadblocks are up, and the clock is running.',
  'Heat Wave: no missions, no backup, no mercy. Just you and the heat.',
  'Heat Wave: Kestrel is watching this one. Make it worth her time.',
];

// Escaped: the sirens fade and the city exhales. Said once, when a
// three-star-or-worse chase ends with von free.
const ESCAPED_LINES = [
  'You lost them. The sirens fade, the Mile goes back to minding its business.',
  'Clean getaway. Somewhere, a dispatcher is quietly deleting your file.',
  'The heat’s off — for now. Port Solano forgets fast, but it never forgets.',
  'Five minutes ago every cruiser in the city wanted you. Now you’re just traffic.',
];

const STATION_KEYS = ['tide', 'neon', 'harbor'];

function pick(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

// The chatter state: the line on screen, when it fades, and the last
// values that were announced so a change is only said once.
export function createChatter() {
  return {
    line: '',
    until: 0,
    quietUntil: 0,
    lastWanted: 0,
    lastStation: -1,
    lastMode: '',
    lastIndex: -1,
    lastHeat: false,
    lastRain: 0,
    ambientAt: 0,
  };
}

// Say something now, for a few seconds. Used by the ticker and by the
// mission code when a moment deserves a word.
export function sayChatter(S, text, secs) {
  const c = S.chatter;
  c.line = text;
  c.until = S.time + (secs || 4);
}

// Once a frame from the main loop. Watches the state for changes worth
// announcing, and fills dead air with street gossip when the city is calm.
export function chatterTick(S) {
  const c = S.chatter;
  if (S.cutscene && S.cutscene.active) return;
  if (S.dialog) return;
  if (S.time < c.quietUntil) return;
  if (c.line && S.time < c.until) return;
  c.line = '';
  const P = S.player;
  const prevWanted = c.lastWanted;
  if (S.wanted > c.lastWanted) {
    c.lastWanted = S.wanted;
    if (S.wanted >= 4) sayChatter(S, pick(HELI_LINES), 5);
    else if (S.wanted >= 3) sayChatter(S, pick(DISPATCH_LINES), 5);
    else sayChatter(S, pick(DISPATCH_LINES), 4);
    c.quietUntil = S.time + 6;
    return;
  }
  c.lastWanted = S.wanted;
  if (S.wanted === 0 && prevWanted >= 3) {
    sayChatter(S, pick(ESCAPED_LINES), 5);
    c.quietUntil = S.time + 6;
    return;
  }
  if (S.heatwave.active && !c.lastHeat) {
    c.lastHeat = true;
    sayChatter(S, pick(HEAT_LINES), 5);
    c.quietUntil = S.time + 6;
    return;
  }
  if (!S.heatwave.active) c.lastHeat = false;
  if (S.audio && S.audio.station !== c.lastStation) {
    c.lastStation = S.audio.station;
    sayChatter(S, pick(DJ_LINES[STATION_KEYS[S.audio.station]] || DJ_LINES.tide), 5);
    c.quietUntil = S.time + 6;
    return;
  }
  if (S.missions.mode === 'complete' && c.lastMode !== 'complete') {
    c.lastMode = 'complete';
    sayChatter(S, pick(WIN_LINES), 5);
    c.quietUntil = S.time + 6;
    return;
  }
  if (S.missions.mode === 'failed' && c.lastMode !== 'failed') {
    c.lastMode = 'failed';
    sayChatter(S, pick(DEKE_LINES), 5);
    c.quietUntil = S.time + 6;
    return;
  }
  c.lastMode = S.missions.mode;
  if (S.missions.mode === 'playing' && S.missions.index !== c.lastIndex) {
    c.lastIndex = S.missions.index;
    sayChatter(S, pick(KESTREL_LINES), 5);
    c.quietUntil = S.time + 6;
    return;
  }
  c.lastIndex = S.missions.index;
  if (P.health > 0 && P.health < 30 && S.time > c.ambientAt) {
    c.ambientAt = S.time + 30;
    sayChatter(S, pick(HURT_LINES), 5);
    c.quietUntil = S.time + 6;
    return;
  }
  if (S.weather.rain >= 0.5 && c.lastRain < 0.5) {
    c.lastRain = S.weather.rain;
    sayChatter(S, pick(RAIN_LINES), 5);
    c.quietUntil = S.time + 6;
    return;
  }
  c.lastRain = S.weather.rain;
  if (S.wanted === 0 && S.time >= c.ambientAt) {
    c.ambientAt = S.time + 26;
    sayChatter(S, pick(STREET_LINES), 5);
  }
}
