// MLB Stats API wrapper
const MLB_API = 'https://statsapi.mlb.com/api/v1';

// 2026 Japanese players in MLB - confirmed rosters
const JAPANESE_PLAYERS = [
  // ── 打者 / Two-Way ─────────────────────────────────────────
  { id: 660271, nameEn: 'Shohei Ohtani',         nameJa: '大谷翔平',         team: 'LAD', teamId: 119, pos: ['DH','SP'], number: 17, isBatter: true,  isPitcher: true  },
  { id: 673548, nameEn: 'Seiya Suzuki',           nameJa: '鈴木誠也',         team: 'CHC', teamId: 112, pos: ['RF'],      number: 27, isBatter: true,  isPitcher: false },
  { id: 646240, nameEn: 'Masataka Yoshida',       nameJa: '吉田正尚',         team: 'BOS', teamId: 111, pos: ['DH','LF'], number: 36, isBatter: true,  isPitcher: false },
  { id: 808959, nameEn: 'Munetaka Murakami',      nameJa: '村上宗隆',         team: 'CWS', teamId: 145, pos: ['1B','DH'], number: 55, isBatter: true,  isPitcher: false },
  { id: 672960, nameEn: 'Kazuma Okamoto',         nameJa: '岡本和真',         team: 'TOR', teamId: 141, pos: ['3B','1B'], number: 34, isBatter: true,  isPitcher: false },
  // ── 投手 ─────────────────────────────────────────────────
  { id: 808967, nameEn: 'Yoshinobu Yamamoto',     nameJa: '山本由伸',         team: 'LAD', teamId: 119, pos: ['SP'],      number: 18, isBatter: false, isPitcher: true  },
  { id: 808963, nameEn: 'Roki Sasaki',            nameJa: '佐々木朗希',       team: 'LAD', teamId: 119, pos: ['SP'],      number: 14, isBatter: false, isPitcher: true  },
  { id: 506433, nameEn: 'Yu Darvish',             nameJa: 'ダルビッシュ有',   team: 'SD',  teamId: 135, pos: ['SP'],      number: 11, isBatter: false, isPitcher: true  },
  { id: 579328, nameEn: 'Yusei Kikuchi',          nameJa: '菊池雄星',         team: 'LAA', teamId: 108, pos: ['SP'],      number: 16, isBatter: false, isPitcher: true  },
  { id: 673540, nameEn: 'Kodai Senga',            nameJa: '千賀滉大',         team: 'NYM', teamId: 121, pos: ['SP'],      number: 34, isBatter: false, isPitcher: true  },
  { id: 684007, nameEn: 'Shota Imanaga',          nameJa: '今永昇太',         team: 'CHC', teamId: 112, pos: ['SP'],      number: 18, isBatter: false, isPitcher: true  },
  { id: 669022, nameEn: 'Yuki Matsui',            nameJa: '松井裕樹',         team: 'SD',  teamId: 135, pos: ['RP'],      number: 73, isBatter: false, isPitcher: true  },
];

const BATTERS  = JAPANESE_PLAYERS.filter(p => p.isBatter);
const PITCHERS = JAPANESE_PLAYERS.filter(p => p.isPitcher);

const DEFAULT_BATTER_IDS  = [660271, 808959, 673548]; // 大谷, 村上, 鈴木
const DEFAULT_PITCHER_IDS = [660271, 808967, 808963]; // 大谷, 山本, 佐々木

const TEAM_COLORS = {
  LAD:'#005A9C', CHC:'#0E3386', BOS:'#BD3039',
  CWS:'#27251F', TOR:'#134A8E', SD:'#2F241D',
  LAA:'#BA0021', NYM:'#002D72',
};

function teamLogoUrl(teamAbbr) {
  const ids = { LAD:119,CHC:112,BOS:111,CWS:145,TOR:141,SD:135,LAA:108,NYM:121 };
  return ids[teamAbbr] ? `https://www.mlbstatic.com/team-logos/${ids[teamAbbr]}.svg` : '';
}

// Returns full <img> tag with Padres-specific brightness class
function teamLogoImg(teamAbbr, cls='team-logo-sm') {
  const url = teamLogoUrl(teamAbbr);
  if (!url) return '';
  const extra = teamAbbr === 'SD' ? ' logo-padres' : '';
  return `<img class="${cls}${extra}" src="${url}" onerror="this.style.display='none'">`;
}

function playerName(p) { return currentLang === 'ja' ? p.nameJa : p.nameEn; }

const POINT_STYLES = ['circle','triangle','rect','rectRot','star','cross','crossRot','dash','circle','triangle','rect','rectRot','star','cross','crossRot'];
const PLAYER_COLORS = [
  '#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7',
  '#06b6d4','#f97316','#ec4899','#14b8a6','#84cc16',
  '#8b5cf6','#fb7185','#fbbf24','#34d399','#60a5fa',
];

// ── MLB Stats API ──────────────────────────────────────────────────────────

async function fetchSeasonStats(playerId, group = 'hitting') {
  const season = new Date().getFullYear();
  const res = await fetch(`${MLB_API}/people/${playerId}/stats?stats=season&season=${season}&group=${group}`);
  const data = await res.json();
  return data.stats?.[0]?.splits?.[0]?.stat || null;
}

async function fetchGameLog(playerId, group = 'hitting') {
  const season = new Date().getFullYear();
  const res = await fetch(`${MLB_API}/people/${playerId}/stats?stats=gameLog&season=${season}&group=${group}&hydrate=team`);
  const data = await res.json();
  return data.stats?.[0]?.splits || [];
}

async function fetchGamePlayByPlay(gamePk) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/playByPlay`);
  const data = await res.json();
  return data.allPlays || [];
}

async function fetchPitchData(gamePk, pitcherId) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/playByPlay`);
  const data = await res.json();
  return (data.allPlays || []).filter(p => p.matchup?.pitcher?.id === pitcherId);
}

// ── Standings ──────────────────────────────────────────────────────────────
async function fetchStandings(leagueId) {
  const season = new Date().getFullYear();
  const res = await fetch(`${MLB_API}/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason`);
  const data = await res.json();
  return data.records || [];
}

async function fetchTeamStandingsHistory(teamId) {
  const season = new Date().getFullYear();
  const start  = `${season}-03-26`;
  const end    = dateStr(new Date());
  const res = await fetch(`${MLB_API}/schedule?teamId=${teamId}&startDate=${start}&endDate=${end}&sportId=1&gameType=R`);
  const data = await res.json();
  return data.dates || [];
}

async function fetchGameLinescore(gamePk) {
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`);
    return await res.json();
  } catch { return null; }
}

async function fetchAllBattingStats() {
  return Promise.all(BATTERS.map(async p => {
    try { return { player: p, stat: await fetchSeasonStats(p.id, 'hitting') }; }
    catch { return { player: p, stat: null }; }
  })).then(r => r.filter(x => x.stat));
}

async function fetchAllPitchingStats() {
  return Promise.all(PITCHERS.map(async p => {
    try { return { player: p, stat: await fetchSeasonStats(p.id, 'pitching') }; }
    catch { return { player: p, stat: null }; }
  })).then(r => r.filter(x => x.stat));
}

function dateStr(d) { return d.toISOString().split('T')[0]; }
function periodDates(period) {
  const now = new Date();
  if (period === '1w') { const s=new Date(now); s.setDate(s.getDate()-7); return {start:dateStr(s),end:dateStr(now)}; }
  if (period === '1m') { const s=new Date(now); s.setMonth(s.getMonth()-1); return {start:dateStr(s),end:dateStr(now)}; }
  // Season: always start from Opening Day 3/26
  return { start:`${now.getFullYear()}-03-26`, end:dateStr(now) };
}

async function loadStatcastData(playerId, type='batter') {
  try {
    const res = await fetch(`data/statcast_${type}_${playerId}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Standings API ──────────────────────────────────────────────────────────
async function fetchStandings(leagueId) {
  // leagueId: 103=AL, 104=NL
  const season = new Date().getFullYear();
  const res = await fetch(`${MLB_API}/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason`);
  const data = await res.json();
  return data.records || [];
}

async function fetchTeamStandingsHistory(teamId) {
  // Use schedule endpoint to build wins/losses over time
  const season = new Date().getFullYear();
  const start = `${season}-03-26`;
  const end = dateStr(new Date());
  const res = await fetch(`${MLB_API}/schedule?teamId=${teamId}&startDate=${start}&endDate=${end}&sportId=1&hydrate=linescore`);
  const data = await res.json();
  return data.dates || [];
}

function shortResult(event) {
  if (!event) return '-';
  const e = event.toLowerCase();
  if (e.includes('home_run'))   return '🏠 Home Run';
  if (e === 'strikeout')        return '🔴 Strike Out';
  if (e.includes('single'))     return '✅ Single';
  if (e.includes('double') && !e.includes('play')) return '✅ Double';
  if (e.includes('triple'))     return '✅ Triple';
  if (e.includes('walk'))       return '🔵 Walk';
  if (e.includes('hit_by'))     return '🔵 Hit By Pitch';
  if (e.includes('sac_fly'))    return '⬆ Sac Fly';
  if (e.includes('double_play'))return '⬇ Double Play';
  if (e.includes('grounded_into')) return '⬇ Ground Out';
  if (e.includes('ground_out')) return '⬇ Ground Out';
  if (e.includes('flyout')||e.includes('fly_out')) return '⬆ Fly Out';
  if (e.includes('lineout')||e.includes('line_out')) return '➡ Line Out';
  if (e.includes('pop_out')||e.includes('popout')) return '⬆ Pop Out';
  if (e.includes('fielders_choice')) return '⬇ Fielder\'s Choice';
  if (e.includes('error'))      return '🟡 Reach on Error';
  if (e.includes('intent_walk')) return '🔵 Int. Walk';
  if (e.includes('catcher_interf')) return '🔵 Catcher Int.';
  return event.replace(/_/g,' ');
}

function pitchShort(desc) {
  if (!desc) return '-';
  const d = desc.toLowerCase();
  if (d.includes('called strike'))    return 'Called ☆';
  if (d.includes('swinging strike'))  return 'Swing ✗';
  if (d.includes('foul tip'))         return 'Foul tip';
  if (d.includes('foul'))             return 'Foul';
  if (d.includes('ball'))             return 'Ball';
  if (d.includes('hit_into_play') || d.includes('in play')) return 'In play';
  if (d.includes('blocked'))          return 'Blocked';
  return desc;
}
