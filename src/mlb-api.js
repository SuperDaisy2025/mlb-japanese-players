// MLB Stats API wrapper
const MLB_API = 'https://statsapi.mlb.com/api/v1';

// Japanese players in MLB 2025 (playerID, name, team, positions)
const JAPANESE_PLAYERS = [
  { id: 660271, nameEn: 'Shohei Ohtani',     nameJa: '大谷翔平',   team: 'LAD', pos: ['DH','SP'], number: 17 },
  { id: 673237, nameEn: 'Yoshinobu Yamamoto', nameJa: '山本由伸',   team: 'LAD', pos: ['SP'],       number: 18 },
  { id: 669203, nameEn: 'Shota Imanaga',      nameJa: '今永昇太',   team: 'CHC', pos: ['SP'],       number: 18 },
  { id: 673548, nameEn: 'Seiya Suzuki',        nameJa: '鈴木誠也',   team: 'CHC', pos: ['RF'],       number: 27 },
  { id: 665750, nameEn: 'Yusei Kikuchi',       nameJa: '菊池雄星',   team: 'TOR', pos: ['SP'],       number: 16 },
  { id: 547180, nameEn: 'Kenta Maeda',         nameJa: '前田健太',   team: 'NYM', pos: ['SP'],       number: 18 },
  { id: 660644, nameEn: 'Kodai Senga',         nameJa: '千賀滉大',   team: 'NYM', pos: ['SP'],       number: 34 },
];

function playerName(p) {
  return currentLang === 'ja' ? p.nameJa : p.nameEn;
}

// ---- Season stats ----
async function fetchSeasonStats(playerId, group = 'hitting') {
  const season = new Date().getFullYear();
  const url = `${MLB_API}/people/${playerId}/stats?stats=season&season=${season}&group=${group}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.stats?.[0]?.splits?.[0]?.stat || null;
}

// ---- Game log (per game stats) ----
async function fetchGameLog(playerId, group = 'hitting') {
  const season = new Date().getFullYear();
  const url = `${MLB_API}/people/${playerId}/stats?stats=gameLog&season=${season}&group=${group}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.stats?.[0]?.splits || [];
}

// ---- Schedule (team games) ----
async function fetchTeamSchedule(teamId, startDate, endDate) {
  const url = `${MLB_API}/schedule?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&sportId=1&hydrate=linescore`;
  const res = await fetch(url);
  const data = await res.json();
  return data.dates || [];
}

// ---- Game play-by-play (at-bat breakdown) ----
async function fetchGamePlayByPlay(gamePk) {
  const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/playByPlay`;
  const res = await fetch(url);
  const data = await res.json();
  return data.allPlays || [];
}

// ---- Game pitching log (pitch-by-pitch) ----
async function fetchPitchData(gamePk, pitcherId) {
  const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/playByPlay`;
  const res = await fetch(url);
  const data = await res.json();
  const plays = data.allPlays || [];
  // Filter plays where our pitcher was pitching
  return plays.filter(p => p.matchup?.pitcher?.id === pitcherId);
}

// ---- Cumulative HR data for chart ----
async function fetchCumulativeStats(playerId, stat = 'homeRuns') {
  const games = await fetchGameLog(playerId, 'hitting');
  let cumulative = 0;
  return games.map(g => {
    cumulative += (g.stat[stat] || 0);
    return {
      date: g.date,
      value: cumulative,
      gameNum: g.stat.gamesPlayed
    };
  });
}

// ---- Fetch all players' season batting stats ----
async function fetchAllBattingStats() {
  const results = await Promise.all(
    JAPANESE_PLAYERS.map(async p => {
      const stat = await fetchSeasonStats(p.id, 'hitting');
      return { player: p, stat };
    })
  );
  return results.filter(r => r.stat);
}

// ---- Fetch all players' season pitching stats ----
async function fetchAllPitchingStats() {
  const pitchers = JAPANESE_PLAYERS.filter(p => p.pos.includes('SP'));
  const results = await Promise.all(
    pitchers.map(async p => {
      const stat = await fetchSeasonStats(p.id, 'pitching');
      return { player: p, stat };
    })
  );
  return results.filter(r => r.stat);
}

// ---- Date helpers ----
function dateStr(d) {
  return d.toISOString().split('T')[0];
}
function periodDates(period) {
  const now = new Date();
  if (period === '1w') {
    const start = new Date(now); start.setDate(start.getDate() - 7);
    return { start: dateStr(start), end: dateStr(now) };
  }
  if (period === '1m') {
    const start = new Date(now); start.setMonth(start.getMonth() - 1);
    return { start: dateStr(start), end: dateStr(now) };
  }
  // full season
  return { start: `${now.getFullYear()}-03-01`, end: dateStr(now) };
}

// ---- Load Statcast JSON (from GitHub Actions) ----
async function loadStatcastData(playerId) {
  try {
    const res = await fetch(`data/statcast_${playerId}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---- Team ID lookup ----
const TEAM_IDS = { LAD: 119, CHC: 112, TOR: 141, NYM: 121 };
