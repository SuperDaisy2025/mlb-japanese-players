// ============================================================
//  MLB Japanese Players Tracker - App v2
// ============================================================

let currentTab = 'batting';
let currentPeriod = 'season';
let currentPlayer = null;
let currentPlayerTab = 'summary';
let selectedBatterIds  = new Set(DEFAULT_BATTER_IDS);
let selectedPitcherIds = new Set(DEFAULT_PITCHER_IDS);
let gameLogCache = {};

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[MLB v11] App starting...');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  setLang(currentLang);
  await switchTab('batting');
  updateLastUpdatedDisplay();
  console.log('[MLB v11] App ready.');
});

// ── Tab switching ─────────────────────────────────────────────────────────
async function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.id===`tab-${tab}`));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id===`panel-${tab}`));
  if (tab==='batting')  await renderBattingTab();
  if (tab==='pitching') await renderPitchingTab();
  if (tab==='players')  renderPlayersTab();
}

async function switchPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period===period));
  if (currentTab==='batting')  await renderBattingCharts();
  if (currentTab==='pitching') await renderPitchingCharts();
}

// ── Player filter selector ────────────────────────────────────────────────
function buildPlayerFilter(players, selectedSet, onChange) {
  return `
    <div class="player-filter">
      <div class="pf-label">${t('filterPlayers')}</div>
      <div class="pf-chips">
        ${players.map(p => `
          <label class="pf-chip ${selectedSet.has(p.id)?'active':''}" data-id="${p.id}">
            <input type="checkbox" ${selectedSet.has(p.id)?'checked':''} onchange="${onChange}(${p.id},this.checked)">
            ${teamLogoImg(p.team,'pf-logo')}
            <span>${currentLang==='ja'?p.nameJa:p.nameEn}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;
}

function toggleBatter(id, checked) {
  if (checked) selectedBatterIds.add(id); else selectedBatterIds.delete(id);
  document.querySelectorAll('.pf-chip').forEach(c => {
    if (parseInt(c.dataset.id)===id) c.classList.toggle('active', checked);
  });
  renderBattingCharts();
}

function togglePitcher(id, checked) {
  if (checked) selectedPitcherIds.add(id); else selectedPitcherIds.delete(id);
  document.querySelectorAll('.pf-chip').forEach(c => {
    if (parseInt(c.dataset.id)===id) c.classList.toggle('active', checked);
  });
  renderPitchingCharts();
}

// ============================================================
//  BATTING TAB
// ============================================================
async function renderBattingTab() {
  await renderBattingOverview();
  renderBattingFilterUI();
  await renderBattingCharts();
}

async function renderBattingOverview() {
  const container = document.getElementById('batting-overview');
  container.innerHTML = `<div class="loading-spinner"></div>`;
  try {
    const stats = await fetchAllBattingStats();
    const sorted = [...stats].sort((a,b)=>(b.stat.homeRuns||0)-(a.stat.homeRuns||0));
    container.innerHTML = `<div class="stats-cards">${sorted.map((r,i) => {
      const pi = JAPANESE_PLAYERS.findIndex(p=>p.id===r.player.id);
      return `
        <div class="stat-card ${i===0?'leader':''}" onclick="openPlayer(${r.player.id})">
          <div class="stat-card-header">
            <div class="team-logo-wrap">
              ${teamLogoImg(r.player.team,'team-logo-sm')}
            </div>
            <div class="stat-card-name">
              <div class="name-ja">${r.player.nameJa}</div>
              <div class="name-en">${r.player.nameEn} · ${r.player.team} · #${r.player.number}</div>
            </div>
          </div>
          <div class="stat-card-stats">
            ${miniStat(r.stat.homeRuns??'-','HR')}
            ${miniStat(r.stat.avg??'-','AVG')}
            ${miniStat(r.stat.ops??'-','OPS')}
            ${miniStat(r.stat.rbi??'-','RBI')}
          </div>
        </div>`;
    }).join('')}</div>`;
  } catch(e) {
    container.innerHTML = `<div class="error-msg">${t('error')}</div>`;
  }
}

function renderBattingFilterUI() {
  const el = document.getElementById('batting-filter');
  if (el) el.innerHTML = buildPlayerFilter(BATTERS, selectedBatterIds, 'toggleBatter');
}

async function renderBattingCharts() {
  const section = document.getElementById('batting-charts');
  section.innerHTML = `<div class="loading-spinner"></div>`;
  try {
    const selected = BATTERS.filter(p => selectedBatterIds.has(p.id));
    if (!selected.length) { section.innerHTML = `<div class="no-data">選手を選択してください</div>`; return; }

    const { start, end } = periodDates(currentPeriod);

    const makeDataset = async (p, statKey, group, cumulative) => {
      const games = await fetchGameLog(p.id, group);
      let cum = 0;
      const allData = games.map(g => {
        const v = parseFloat(g.stat[statKey]) || 0;
        if (cumulative) { cum += v; return { x: g.date, y: cum }; }
        return { x: g.date, y: v };
      });
      // All charts: filter by period X axis
      const filtered = allData.filter(d => d.x >= start && d.x <= end);
      return { label: currentLang==='ja'?p.nameJa:p.nameEn, data: filtered, isHighlight: p.id===660271 };
    };

    const [hrSets, avgSets, opsSets] = await Promise.all([
      Promise.all(selected.map(p => makeDataset(p,'homeRuns','hitting',true))),
      Promise.all(selected.map(p => makeDataset(p,'avg','hitting',false))),
      Promise.all(selected.map(p => makeDataset(p,'ops','hitting',false))),
    ]);

    const periodLabel = t(currentPeriod==='1w'?'period1W':currentPeriod==='1m'?'period1M':'periodSeason');
    section.innerHTML = `
      <div class="chart-block">
        <h3 class="chart-title">${t('homeRuns')} <span class="chart-badge">${t('cumulative')} · ${periodLabel}</span></h3>
        <div class="chart-wrap"><canvas id="chart-hr"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">${t('avg')} <span class="chart-badge">${periodLabel}</span></h3>
        <div class="chart-wrap"><canvas id="chart-avg"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">OPS <span class="chart-badge">${periodLabel}</span></h3>
        <div class="chart-wrap"><canvas id="chart-ops"></canvas></div>
      </div>
    `;
    renderLineChart('chart-hr',  hrSets.filter(d=>d.data.length),  {yLabel:'Cumulative HR', xMin: start, xMax: end});
    renderLineChart('chart-avg', avgSets.filter(d=>d.data.length), {yLabel:'Batting Avg',   xMin: start, xMax: end});
    renderLineChart('chart-ops', opsSets.filter(d=>d.data.length), {yLabel:'OPS',           xMin: start, xMax: end});
  } catch(e) {
    section.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

// ============================================================
//  PITCHING TAB
// ============================================================
async function renderPitchingTab() {
  await renderPitchingOverview();
  renderPitchingFilterUI();
  await renderPitchingCharts();
}

async function renderPitchingOverview() {
  const container = document.getElementById('pitching-overview');
  container.innerHTML = `<div class="loading-spinner"></div>`;
  try {
    const stats = await fetchAllPitchingStats();
    const sorted = [...stats].sort((a,b)=>(parseFloat(a.stat.era)||99)-(parseFloat(b.stat.era)||99));
    container.innerHTML = `<div class="stats-cards">${sorted.map((r,i)=>`
      <div class="stat-card ${i===0?'leader':''}" onclick="openPlayer(${r.player.id})">
        <div class="stat-card-header">
          <div class="team-logo-wrap">
            ${teamLogoImg(r.player.team,'team-logo-sm')}
          </div>
          <div class="stat-card-name">
            <div class="name-ja">${r.player.nameJa}</div>
            <div class="name-en">${r.player.nameEn} · ${r.player.team} · #${r.player.number}</div>
          </div>
        </div>
        <div class="stat-card-stats">
          ${miniStat(`${r.stat.wins??0}-${r.stat.losses??0}`,'W-L')}
          ${miniStat(r.stat.era??'-','ERA')}
          ${miniStat(r.stat.whip??'-','WHIP')}
          ${miniStat(r.stat.strikeOuts??'-','K')}
        </div>
      </div>`).join('')}</div>`;
  } catch(e) {
    container.innerHTML = `<div class="error-msg">${t('error')}</div>`;
  }
}

function renderPitchingFilterUI() {
  const el = document.getElementById('pitching-filter');
  if (el) el.innerHTML = buildPlayerFilter(PITCHERS, selectedPitcherIds, 'togglePitcher');
}

async function renderPitchingCharts() {
  const section = document.getElementById('pitching-charts');
  section.innerHTML = `<div class="loading-spinner"></div>`;
  try {
    const selected = PITCHERS.filter(p => selectedPitcherIds.has(p.id));
    if (!selected.length) { section.innerHTML = `<div class="no-data">選手を選択してください</div>`; return; }

    const { start, end } = periodDates(currentPeriod);

    const makeDataset = async (p, statKey, cumulative=false) => {
      const games = await fetchGameLog(p.id, 'pitching');
      let cum = 0;
      const allData = games.map(g => {
        const v = parseFloat(g.stat[statKey]) || 0;
        if (cumulative) { cum += v; return { x: g.date, y: cum }; }
        return { x: g.date, y: v };
      });
      // All charts: filter by period
      const filtered = allData.filter(d => d.x >= start && d.x <= end);
      return { label: currentLang==='ja'?p.nameJa:p.nameEn, data: filtered, isHighlight: p.id===660271 };
    };

    const [eraSets, winSets, kSets] = await Promise.all([
      Promise.all(selected.map(p => makeDataset(p,'era',false))),
      Promise.all(selected.map(p => makeDataset(p,'wins',true))),
      Promise.all(selected.map(p => makeDataset(p,'strikeOuts',true))),
    ]);

    const periodLabel = t(currentPeriod==='1w'?'period1W':currentPeriod==='1m'?'period1M':'periodSeason');
    section.innerHTML = `
      <div class="chart-block">
        <h3 class="chart-title">${t('era')} <span class="chart-badge">${periodLabel}</span></h3>
        <div class="chart-wrap"><canvas id="chart-era"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">${t('wins')} <span class="chart-badge">${t('cumulative')} · ${periodLabel}</span></h3>
        <div class="chart-wrap"><canvas id="chart-wins"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">${t('strikeouts')} <span class="chart-badge">${t('cumulative')} · ${periodLabel}</span></h3>
        <div class="chart-wrap"><canvas id="chart-k"></canvas></div>
      </div>
    `;
    renderLineChart('chart-era',  eraSets.filter(d=>d.data.length),  {yLabel:'ERA',         xMin: start, xMax: end});
    renderLineChart('chart-wins', winSets.filter(d=>d.data.length),  {yLabel:'Wins',        xMin: start, xMax: end});
    renderLineChart('chart-k',    kSets.filter(d=>d.data.length),    {yLabel:'Strikeouts',  xMin: start, xMax: end});
  } catch(e) {
    section.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

// ============================================================
//  PLAYERS TAB
// ============================================================
function renderPlayersTab() {
  const container = document.getElementById('panel-players');
  if (currentPlayer) { renderPlayerDetail(currentPlayer); return; }
  container.innerHTML = `
    <div class="section-heading">打者 / Batters</div>
    <div class="player-select-grid">
      ${BATTERS.map((p,i) => playerCard(p,i)).join('')}
    </div>
    <div class="section-heading">投手 / Pitchers</div>
    <div class="player-select-grid">
      ${PITCHERS.filter(p=>!p.isBatter).map((p,i) => playerCard(p,BATTERS.length+i)).join('')}
    </div>
  `;
}

function playerCard(p, i) {
  return `
    <div class="player-select-card" onclick="openPlayer(${p.id})" style="--accent:${PLAYER_COLORS[i%PLAYER_COLORS.length]}">
      ${teamLogoImg(p.team,'psc-logo')}
      <div class="psc-number">#${p.number}</div>
      <div class="psc-ja">${p.nameJa}</div>
      <div class="psc-en">${p.nameEn}</div>
      <div class="psc-meta">${p.team} · ${p.pos.join('/')}</div>
    </div>`;
}

async function openPlayer(playerId) {
  currentPlayer = JAPANESE_PLAYERS.find(p=>p.id===playerId);
  currentPlayerTab = 'summary';
  window._playsCache = new Map(); // reset cache for new player
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.id==='tab-players'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='panel-players'));
  currentTab = 'players';
  await renderPlayerDetail(currentPlayer);
}

async function renderPlayerDetail(player) {
  const container = document.getElementById('panel-players');
  const pi = JAPANESE_PLAYERS.findIndex(p=>p.id===player.id);
  const color = PLAYER_COLORS[pi%PLAYER_COLORS.length];

  container.innerHTML = `
    <div class="player-detail">
      <div class="player-detail-header" style="border-left:4px solid ${color}">
        <button class="back-btn" onclick="backToPlayers()">← ${currentLang==='ja'?'戻る':'Back'}</button>
        ${teamLogoImg(player.team,'team-logo-md')}
        <div>
          <div class="player-detail-ja">${player.nameJa}</div>
          <div class="player-detail-en">${player.nameEn} · ${player.team} · #${player.number} · ${player.pos.join('/')}</div>
        </div>
      </div>
      <div class="player-subtabs">
        <button class="subtab-btn active" id="stab-summary" onclick="switchPlayerTab('summary')">${t('playerSummary')}</button>
        ${player.isBatter?`<button class="subtab-btn" id="stab-batting-log" onclick="switchPlayerTab('batting-log')">打席詳細</button>`:''}
        ${player.isPitcher?`<button class="subtab-btn" id="stab-pitching-log" onclick="switchPlayerTab('pitching-log')">投球詳細</button>`:''}
        <button class="subtab-btn" id="stab-team" onclick="switchPlayerTab('team')">チーム成績</button>
      </div>
      <div id="player-subtab-content"><div class="loading-spinner"></div></div>
    </div>
  `;
  await switchPlayerTab('summary');
}

function backToPlayers() { currentPlayer = null; renderPlayersTab(); }

async function switchPlayerTab(tab) {
  currentPlayerTab = tab;
  document.querySelectorAll('.subtab-btn').forEach(b => {
    b.classList.toggle('active', b.id===`stab-${tab}`);
  });
  const content = document.getElementById('player-subtab-content');
  content.innerHTML = `<div class="loading-spinner"></div>`;
  if (tab==='summary')      await renderPlayerSummary(content);
  if (tab==='batting-log')  await renderBattingLog(content);
  if (tab==='pitching-log') await renderPitchingLog(content);
  if (tab==='team')         await renderTeamStandings(content);
}

// ── Summary ────────────────────────────────────────────────────────────────
async function renderPlayerSummary(container) {
  try {
    const [hitStat, pitchStat] = await Promise.all([
      currentPlayer.isBatter  ? fetchSeasonStats(currentPlayer.id,'hitting')  : null,
      currentPlayer.isPitcher ? fetchSeasonStats(currentPlayer.id,'pitching') : null,
    ]);

    let html = `<div class="summary-outer">`;

    if (hitStat) {
      html += `
        <div class="summary-section">
          <div class="summary-title">${t('asBatter')}</div>
          <div class="summary-grid-stats">
            ${sr('AVG','打率',hitStat.avg)}${sr('OBP','出塁率',hitStat.obp)}${sr('SLG','長打率',hitStat.slg)}
            ${sr('OPS','OPS',hitStat.ops)}${sr('HR','本塁打',hitStat.homeRuns)}${sr('RBI','打点',hitStat.rbi)}
            ${sr('H','安打',hitStat.hits)}${sr('AB','打数',hitStat.atBats)}${sr('G','試合',hitStat.gamesPlayed)}
            ${sr('R','得点',hitStat.runs)}${sr('2B','二塁打',hitStat.doubles)}${sr('3B','三塁打',hitStat.triples)}
            ${sr('BB','四球',hitStat.baseOnBalls)}${sr('SO','三振',hitStat.strikeOuts)}${sr('SB','盗塁',hitStat.stolenBases)}
          </div>
        </div>`;
    }

    if (pitchStat) {
      html += `
        <div class="summary-section">
          <div class="summary-title">${t('asPitcher')}</div>
          <div class="summary-grid-stats">
            ${sr('W-L','勝敗',`${pitchStat.wins??0}-${pitchStat.losses??0}`)}${sr('ERA','防御率',pitchStat.era)}${sr('WHIP','WHIP',pitchStat.whip)}
            ${sr('K','奪三振',pitchStat.strikeOuts)}${sr('IP','投球回',pitchStat.inningsPitched)}${sr('G','登板',pitchStat.gamesPlayed)}
            ${sr('GS','先発',pitchStat.gamesStarted)}${sr('BB','四球',pitchStat.baseOnBalls)}${sr('H','被安打',pitchStat.hits)}
            ${sr('HR','被本塁打',pitchStat.homeRuns)}${sr('K/9','K/9',pitchStat.strikeoutsPer9Inn)}${sr('BB/9','BB/9',pitchStat.walksPer9Inn)}
          </div>
        </div>`;
    }

    html += `</div>`;

    // Statcast - no button, use top-right button
    const sc = await loadStatcastData(currentPlayer.id, currentPlayer.isPitcher?'pitcher':'batter');
    html += `<div class="statcast-section">
      <div class="summary-title">Statcast <span class="badge-sc">Advanced</span></div>`;
    if (sc) {
      html += `<div class="summary-grid-stats">
        ${sc.exit_velocity?sr('Exit Velo','打球速度',sc.exit_velocity+' mph'):''}
        ${sc.launch_angle?sr('Launch Angle','打球角度',sc.launch_angle+'°'):''}
        ${sc.hard_hit_pct?sr('Hard Hit%','強打率',sc.hard_hit_pct+'%'):''}
        ${sc.xba?sr('xBA','期待打率',sc.xba):''}
        ${sc.xslg?sr('xSLG','期待長打率',sc.xslg):''}
        ${sc.whiff_rate?sr('Whiff%','空振率',sc.whiff_rate+'%'):''}
        ${sc.zone_pct?sr('Zone%','ゾーン率',sc.zone_pct+'%'):''}
      </div>`;
    } else {
      html += `<p class="statcast-note">${currentLang==='ja'?'右上の📡Statcastボタンでデータを更新できます。':'Use the 📡 Statcast button (top right) to fetch data.'}</p>`;
    }
    html += `</div>`;

    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

function sr(label, jaLabel, value) {
  // Support both sr(label, value) and sr(label, jaLabel, value)
  if (value === undefined) { value = jaLabel; jaLabel = ''; }
  if (value===undefined||value===null) return '';
  const subLabel = jaLabel ? `<span class="sr-ja">${jaLabel}</span>` : '';
  return `<div class="sr-item"><span class="sr-lbl">${label}${subLabel}</span><span class="sr-val">${value}</span></div>`;
}

// ── Batting log ────────────────────────────────────────────────────────────
async function renderBattingLog(container) {
  try {
    const games = (await fetchGameLog(currentPlayer.id,'hitting')).reverse();
    if (!games.length) { container.innerHTML=`<div class="no-data">${t('noData')}</div>`; return; }

    container.innerHTML = `<div class="loading-spinner"></div>`;

    // Fetch linescore + play-by-play for each game in parallel (limited to 20)
    const recent = games.slice(0, 20);
    const gameDetails = await Promise.all(recent.map(async game => {
      const gamePk = game.game?.gamePk;
      if (!gamePk) return { game, linescore: null, plays: [] };
      try {
        const [linescore, plays] = await Promise.all([
          fetchGameLinescore(gamePk),
          fetchGamePlayByPlay(gamePk),
        ]);
        return { game, linescore, plays };
      } catch { return { game, linescore: null, plays: [] }; }
    }));

    let html = `<div class="game-log">`;
    for (const { game, linescore, plays } of gameDetails) {
      const s = game.stat;
      const gamePk = game.game?.gamePk;
      const opp = game.opponent?.name || game.team?.name || '?';
      const isHome = game.isHome;

      // Score
      let scoreHtml = '<span class="gl-score-nd">-</span>';
      if (linescore?.teams) {
        const awayR = linescore.teams.away?.runs;
        const homeR = linescore.teams.home?.runs;
        if (awayR !== undefined && homeR !== undefined) {
          const myR  = isHome ? homeR : awayR;
          const oppR = isHome ? awayR : homeR;
          const wl   = myR > oppR ? 'W' : myR < oppR ? 'L' : 'T';
          scoreHtml = `<span class="gl-wl ${wl==='W'?'win':wl==='L'?'loss':''}">${wl}${myR}-${oppR}</span>`;
        }
      }

      // At-bat results inline
      const myPlays = plays.filter(p => p.matchup?.batter?.id === currentPlayer.id);
      const abResultsInline = myPlays.map(p => shortResult(p.result?.event)).join(' ');

      // Cache play data in JS Map BEFORE setting innerHTML
      window._playsCache = window._playsCache || new Map();
      window._playsCache.set(String(gamePk), myPlays.map(p=>({
        event: p.result?.event,
        pitcher: p.matchup?.pitcher?.fullName,
        inning: p.about?.inning,
        outs: p.count?.outs ?? p.about?.halfInning === 'top' ? p.count?.outs : p.count?.outs,
        outsWhenUp: p.count?.outs ?? 0,
        runners: {
          first:  !!p.matchup?.postOnFirst?.id  || !!p.runners?.find(r=>r.movement?.end==='1B'),
          second: !!p.matchup?.postOnSecond?.id || !!p.runners?.find(r=>r.movement?.end==='2B'),
          third:  !!p.matchup?.postOnThird?.id  || !!p.runners?.find(r=>r.movement?.end==='3B'),
        },
        runnersOnBefore: {
          first:  !!p.matchup?.splits?.menOnBase?.includes('Men_On') || false,
          second: false,
          third:  false,
        },
        onFirst:  !!p.matchup?.splits?.menOnBase,
        pitches: (p.playEvents?.filter(e=>e.isPitch)||[]).map(pitch=>({
          type: pitch.details?.type?.description,
          speed: pitch.pitchData?.startSpeed ? Math.round(pitch.pitchData.startSpeed) : null,
          desc: pitch.details?.description,
          balls: pitch.count?.balls??0,
          strikes: pitch.count?.strikes??0,
          outs: pitch.count?.outs??0,
          pX: pitch.pitchData?.coordinates?.pX,
          pZ: pitch.pitchData?.coordinates?.pZ,
          isStrike: isStrikeCall(pitch.details?.description),
        }))
      })));

      html += `
        <div class="game-log-row" onclick="toggleGameAtBats('${gamePk}',this,${isHome})">
          <span class="gl-date">${game.date?.slice(5)||''}</span>
          <span class="gl-ha">${isHome?'🏠':'✈'}</span>
          <span class="gl-opp">${opp}</span>
          <span class="gl-score">${scoreHtml}</span>
          <span class="gl-stat">${s.hits??0}/${s.atBats??0}</span>
          <span class="gl-stat">${s.homeRuns??0}HR</span>
          <span class="gl-stat">${s.rbi??0}RBI</span>
          <span class="gl-avg">AVG ${s.avg??'.000'}</span>
          <span class="gl-ops">OPS ${s.ops??'-'}</span>
          <span class="gl-ab-inline">${abResultsInline}</span>
          <span class="gl-arrow">▶</span>
        </div>
        <div class="game-atbats" id="atbats-${gamePk}" style="display:none"></div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = `<div class="error-msg">${t('error')}</div>`;
  }
}

async function toggleGameAtBats(gamePk, rowEl, isHome) {
  if (!gamePk||gamePk==='undefined') return;
  const el = document.getElementById(`atbats-${gamePk}`);
  if (!el) return;
  const icon = rowEl.querySelector('.gl-arrow');
  if (el.style.display==='block') { el.style.display='none'; if(icon) icon.textContent='▶'; return; }
  el.style.display='block';
  if(icon) icon.textContent='▼';

  // Get play data from JS Map cache
  const myPlays = (window._playsCache || new Map()).get(String(gamePk)) || [];
  console.log(`[MLB v11] toggleGameAtBats gamePk=${gamePk}, plays found=${myPlays.length}, cache size=${(window._playsCache||new Map()).size}`);
  if (!myPlays.length) { el.innerHTML=`<div class="no-data-sm">${t('noData')}</div>`; return; }

  let html = `<div class="ab-summary-list">`;
  myPlays.forEach((play, idx) => {
    const result  = shortResult(play.event);
    const pitcher = play.pitcher || '?';
    const pitches = play.pitches || [];
    const last    = pitches[pitches.length-1];
    const balls   = last?.balls ?? 0;
    const strikes = last?.strikes ?? 0;
    const inning  = play.inning ? `${play.inning}回` : '';
    const outsWhenUp = play.outsWhenUp ?? 0;
    const outsDisplay = '●'.repeat(outsWhenUp) + '○'.repeat(Math.max(0,2-outsWhenUp));
    const r1 = play.runners?.first, r2 = play.runners?.second, r3 = play.runners?.third;
    const runnersDisplay = `
      <span class="ab-runners">
        <span class="base-diamond">
          <span class="base b2 ${r2?'on':''}"></span>
          <span class="base b3 ${r3?'on':''}"></span>
          <span class="base b1 ${r1?'on':''}"></span>
          <span class="base-home"></span>
        </span>
      </span>
    `;
    const abId    = `ab-${gamePk}-${idx}`;

    html += `
      <div class="ab-summary-row" onclick="toggleAbDetail('${abId}',this)">
        <span class="ab-inning">${inning}</span>
        <span class="ab-outs" title="${outsWhenUp} outs">${outsDisplay}</span>
        ${runnersDisplay}
        <span class="ab-result-badge ${getResultClass(play.event)}">${result}</span>
        <span class="ab-count">${balls}-${strikes}</span>
        <span class="ab-pitcher-name">vs ${pitcher}</span>
        <span class="ab-npitches">${pitches.length}球</span>
        <span class="ab-arrow">▶</span>
      </div>
      <div class="ab-detail-panel" id="${abId}" style="display:none">
        <div class="ab-detail-inner">
          <div class="pitch-detail-left">
            <div class="pitch-table-header">
              <span>#</span><span>${t('pitchType')}</span><span>${t('speed')}</span><span>B-S</span><span>${t('outcome')}</span>
            </div>
            ${pitches.map((pitch,i)=>`
              <div class="pitch-row ${i===pitches.length-1?'last-pitch':''}"
                   onmouseenter="highlightBatterZonePitch('${abId}',${i})"
                   onmouseleave="clearBatterZoneHighlight('${abId}')">
                <span>${i+1}</span>
                <span style="color:${pitchTypeColor(pitch.type)}">${pitch.type||'-'}</span>
                <span>${pitch.speed ? pitch.speed+' mph' : '-'}</span>
                <span>${pitch.balls??0}-${pitch.strikes??0}</span>
                <span class="pitch-desc">${pitchShort(pitch.desc)}</span>
              </div>
            `).join('')}
          </div>
          <div class="pitch-zone-wrap">
            <div class="zone-label">Strike Zone</div>
            ${buildPitchZoneTyped(pitches, abId, 'bzdot')}
          </div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  el.innerHTML = html;
}

function toggleAbDetail(id, rowEl) {
  const el = document.getElementById(id);
  if (!el) return;
  const icon = rowEl.querySelector('.ab-arrow');
  const open = el.style.display === 'block';
  el.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▶' : '▼';
}

function highlightBatterZonePitch(abId, idx) {
  document.querySelectorAll(`[id^="bzdot-${abId}-"]`).forEach(el => el.classList.add('zone-dot-dim'));
  const tgt = document.getElementById(`bzdot-${abId}-${idx}`);
  if (tgt) { tgt.classList.remove('zone-dot-dim'); tgt.classList.add('zone-dot-highlight'); }
}
function clearBatterZoneHighlight(abId) {
  document.querySelectorAll(`[id^="bzdot-${abId}-"]`).forEach(el => el.classList.remove('zone-dot-dim','zone-dot-highlight'));
}

// ── Pitch type color map ───────────────────────────────────────────────────
const PITCH_TYPE_COLORS = {
  '4-Seam Fastball':'#ef4444','Fastball':'#ef4444',
  '2-Seam Fastball':'#f97316','Sinker':'#f97316',
  'Cutter':'#f59e0b',
  'Slider':'#22c55e','Sweeper':'#16a34a',
  'Curveball':'#3b82f6','Knuckle Curve':'#6366f1',
  'Changeup':'#a855f7','Splitter':'#ec4899',
  'Forkball':'#db2777','Knuckleball':'#06b6d4',
};
function pitchTypeColor(type) {
  if (!type) return '#6a8aaa';
  for (const [key, color] of Object.entries(PITCH_TYPE_COLORS)) {
    if (type.includes(key)||key.includes(type)) return color;
  }
  return '#6a8aaa';
}

function isStrikeCall(desc) {
  if (!desc) return false;
  const d = desc.toLowerCase();
  return d.includes('strike') || d.includes('foul') || d.includes('swinging');
}

// ── SVG scatter plot pitch zone ────────────────────────────────────────────
function buildPitchZoneTyped(pitches, zoneId, dotPrefix='zdot') {
  const W=200, H=220;
  const toSvgX = x => ((parseFloat(x)+2)/4)*W;
  const toSvgY = z => H - ((parseFloat(z)/5)*H);
  const szX1=toSvgX(-0.83), szX2=toSvgX(0.83);
  const szY1=toSvgY(3.5),   szY2=toSvgY(1.5);
  const szW=szX2-szX1, szH=szY2-szY1;

  let svg = `<svg class="pitch-scatter" width="100%" viewBox="0 0 ${W} ${H}" style="max-width:${W}px">`;
  svg += `<rect x="${szX1}" y="${szY1}" width="${szW}" height="${szH}" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>`;
  for(let i=1;i<3;i++){
    svg += `<line x1="${szX1+szW/3*i}" y1="${szY1}" x2="${szX1+szW/3*i}" y2="${szY2}" stroke="rgba(255,255,255,.15)" stroke-width=".5"/>`;
    svg += `<line x1="${szX1}" y1="${szY1+szH/3*i}" x2="${szX2}" y2="${szY1+szH/3*i}" stroke="rgba(255,255,255,.15)" stroke-width=".5"/>`;
  }
  svg += `<polygon points="${W/2-5},${H-4} ${W/2+5},${H-4} ${W/2+7},${H-1} ${W/2-7},${H-1}" fill="rgba(255,255,255,.25)"/>`;

  pitches.forEach((pitch,i) => {
    const x=pitch.pX??pitch.pitchData?.coordinates?.pX;
    const z=pitch.pZ??pitch.pitchData?.coordinates?.pZ;
    if(x==null||z==null||isNaN(parseFloat(x))||isNaN(parseFloat(z))) return;
    const cx=parseFloat(toSvgX(x).toFixed(1));
    const cy=parseFloat(toSvgY(z).toFixed(1));
    if(cx<-15||cx>W+15||cy<-15||cy>H+15) return;
    const type=pitch.type||pitch.details?.type?.description||'';
    const color=pitchTypeColor(type);
    const desc=(pitch.desc||pitch.details?.description||'').toLowerCase();
    const isStr=desc.includes('strike')||desc.includes('foul')||desc.includes('swinging');
    const isHit=desc.includes('in play')||desc.includes('hit_into');
    const isLast=i===pitches.length-1;
    const r=isLast?6:4.5;
    const stroke=isStr?'rgba(255,255,255,.9)':isHit?'rgba(255,220,50,.9)':'rgba(255,255,255,.2)';
    const sw=isStr||isHit?1.5:.5;
    svg += `<circle id="${dotPrefix}-${zoneId}-${i}" cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="${isStr?.9:.55}" stroke="${stroke}" stroke-width="${sw}" style="cursor:pointer" onmouseenter="highlightScatterDot('${dotPrefix}','${zoneId}',${i},${r})" onmouseleave="clearScatterHighlight('${dotPrefix}','${zoneId}',${r})"><title>${type}${pitch.speed?' '+pitch.speed+'mph':''}</title></circle>`;
  });
  svg += `</svg>`;
  return svg;
}

function buildPitchZoneLarge(pitches, gamePk) {
  console.log(`[MLB v11] buildPitchZoneLarge called: ${pitches.length} pitches, gamePk=${gamePk}`);
  return buildPitchZoneTyped(pitches, gamePk, 'zdot');
}
function buildPitchZoneFromData(pitches)       { return buildPitchZoneTyped(pitches, 'batter', 'bzdot'); }

function highlightScatterDot(prefix, zoneId, idx, origR) {
  document.querySelectorAll(`[id^="${prefix}-${zoneId}-"]`).forEach(el=>{ el.setAttribute('fill-opacity','.15'); });
  const t=document.getElementById(`${prefix}-${zoneId}-${idx}`);
  if(t){ t.setAttribute('fill-opacity','1'); t.setAttribute('r',origR*1.8); t.style.filter='drop-shadow(0 0 4px rgba(255,255,255,.9))'; }
}
function clearScatterHighlight(prefix, zoneId, origR) {
  document.querySelectorAll(`[id^="${prefix}-${zoneId}-"]`).forEach((el,i)=>{
    el.setAttribute('fill-opacity', el.getAttribute('fill-opacity')==='1' ? '.9' : '.55');
    el.style.filter='none';
  });
  // simpler: just restore all
  document.querySelectorAll(`[id^="${prefix}-${zoneId}-"]`).forEach(el=>{ el.removeAttribute('style'); el.setAttribute('fill-opacity','.6'); });
}

function highlightZonePitch(gamePk, idx)    { highlightScatterDot('zdot', gamePk, idx, 4.5); }
function clearZoneHighlight(gamePk)          { clearScatterHighlight('zdot', gamePk, 4.5); }
function highlightBatterZonePitch(abId, idx) { highlightScatterDot('bzdot', abId, idx, 4.5); }
function clearBatterZoneHighlight(abId)      { clearScatterHighlight('bzdot', abId, 4.5); }

// ── Pitching log ───────────────────────────────────────────────────────────
async function renderPitchingLog(container) {
  try {
    const games = (await fetchGameLog(currentPlayer.id,'pitching')).reverse();
    if (!games.length) { container.innerHTML=`<div class="no-data">${t('noData')}</div>`; return; }

    let html = `<div class="game-log">`;
    for (const game of games.slice(0,30)) {
      const s = game.stat;
      const gamePk = game.game?.gamePk;
      const opp = game.opponent?.name || game.team?.name || '?';
      const wl = s.wins?'W':s.losses?'L':'ND';
      html += `
        <div class="game-log-row" onclick="toggleGamePitching('${gamePk}',this)">
          <span class="gl-date">${game.date?.slice(5)||''}</span>
          <span class="gl-ha">${game.isHome?'🏠':'✈'}</span>
          <span class="gl-opp">${opp}</span>
          <span class="gl-wl ${wl==='W'?'win':wl==='L'?'loss':''}">${wl}</span>
          <span class="gl-stat">${s.inningsPitched??0}IP</span>
          <span class="gl-stat">${s.strikeOuts??0}K</span>
          <span class="gl-stat">${s.baseOnBalls??0}BB</span>
          <span class="gl-avg">ERA ${s.era??'-'}</span>
          <span class="gl-arrow">▶</span>
        </div>
        <div class="game-pitching" id="pitching-${gamePk}" style="display:none"></div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch(e) {
    container.innerHTML=`<div class="error-msg">${t('error')}</div>`;
  }
}

async function toggleGamePitching(gamePk, rowEl) {
  if (!gamePk||gamePk==='undefined') return;
  const el = document.getElementById(`pitching-${gamePk}`);
  if (!el) return;
  const icon = rowEl.querySelector('.gl-arrow');
  if (el.style.display==='block') { el.style.display='none'; if(icon) icon.textContent='▶'; return; }
  el.style.display='block';
  if(icon) icon.textContent='▼';
  el.innerHTML=`<div class="loading-spinner-sm"></div>`;

  try {
    console.log(`[MLB v11] toggleGamePitching gamePk=${gamePk}, playerId=${currentPlayer?.id}`);
    const [plays, linescore] = await Promise.all([
      fetchPitchData(gamePk, currentPlayer.id),
      fetchGameLinescore(gamePk),
    ]);
    console.log(`[MLB v11] pitching plays=${plays.length}`);

    if (!plays.length) { el.innerHTML=`<div class="no-data-sm">${t('noData')}</div>`; return; }

    // Collect all pitches with metadata
    const allPitches = [];
    let pitchCount = 0;
    plays.forEach(play => {
      const batter = play.matchup?.batter?.fullName||'?';
      const pitches = play.playEvents?.filter(e=>e.isPitch)||[];
      pitches.forEach((pitch, i) => {
        pitchCount++;
        const isFinal = i===pitches.length-1;
        allPitches.push({
          num: pitchCount,
          type: pitch.details?.type?.description||'-',
          typeCode: pitch.details?.type?.code||'',
          speed: pitch.pitchData?.startSpeed ? Math.round(pitch.pitchData.startSpeed) : null,
          desc: pitch.details?.description||'-',
          balls: pitch.count?.balls??0,
          strikes: pitch.count?.strikes??0,
          outs: pitch.count?.outs??0,
          batter,
          isFinal,
          finalEvent: isFinal ? play.result?.event : null,
          pX: pitch.pitchData?.coordinates?.pX,
          pZ: pitch.pitchData?.coordinates?.pZ,
          inning: play.about?.inning,
        });
      });
    });

    // Build pitching detail HTML - new layout: charts vertical left, zone sticky right
    const chartId = `pitch-chart-${gamePk}`;

    let html = `
      <div class="pitching-detail-wrap">

        <!-- Top: list (left) + zone (right) -->
        <div class="pitching-top-row">
          <div class="pitching-list-col">
            <div class="pst-header">
              <span>#</span><span>${t('pitchType')}</span><span>${t('speed')}</span>
              <span>Batter</span><span>B-S</span><span>${t('outcome')}</span>
            </div>
            ${allPitches.map(p => `
              <div class="pst-row ${p.isFinal?'final-pitch':''}"
                   onmouseenter="highlightZonePitch('${gamePk}',${p.num-1})"
                   onmouseleave="clearZoneHighlight('${gamePk}')">
                <span>${p.num}</span>
                <span style="color:${pitchTypeColor(p.type)}">${p.type}</span>
                <span>${p.speed?p.speed+' mph':'-'}</span>
                <span class="batter-cell">${p.batter}</span>
                <span>${p.balls}-${p.strikes}</span>
                <span class="pitch-outcome ${p.isFinal&&p.finalEvent?getResultClass(p.finalEvent):''}">
                  ${p.isFinal&&p.finalEvent ? shortResult(p.finalEvent) : pitchShort(p.desc)}
                </span>
              </div>
            `).join('')}
          </div>

          <div class="pitching-zone-col">
            <div class="zone-sticky">
              <div class="zone-title">投球コース / Zone</div>
              <div class="zone-type-legend" id="zone-legend-${gamePk}"></div>
              ${buildPitchZoneLarge(allPitches, gamePk)}
            </div>
          </div>
        </div>

        <!-- Bottom: full-width charts -->
        <div class="pitching-charts-fullwidth">
          <div class="chart-block">
            <h3 class="chart-title">球速推移 / Speed <span class="chart-badge">mph</span></h3>
            <div class="chart-wrap"><canvas id="${chartId}-speed"></canvas></div>
          </div>
          <div class="chart-block">
            <h3 class="chart-title">カウント推移 / Count</h3>
            <div class="chart-wrap"><canvas id="${chartId}-count"></canvas></div>
          </div>
          <div class="chart-block">
            <h3 class="chart-title">アウト数 / Outs</h3>
            <div class="chart-wrap"><canvas id="${chartId}-outs"></canvas></div>
          </div>
        </div>

      </div>
    `;

    el.innerHTML = html;

    // Store pitch data for zone highlight
    window._pitchZoneData = window._pitchZoneData || {};
    window._pitchZoneData[gamePk] = allPitches;

    // Draw charts
    setTimeout(() => {
      const nums    = allPitches.map(p=>p.num);
      const speeds  = allPitches.map(p=>p.speed);
      const balls   = allPitches.map(p=>p.balls);
      const strikes = allPitches.map(p=>p.strikes);
      const outs    = allPitches.map(p=>p.outs);

      // Compute inning boundaries for vertical annotations
      const inningLines = [];
      let lastInning = allPitches[0]?.inning;
      allPitches.forEach((p,i)=>{
        if(i>0 && p.inning !== lastInning) {
          inningLines.push({ num: p.num, inning: p.inning });
          lastInning = p.inning;
        }
      });

      // Cumulative average speeds
      const cumulativeAvg = speeds.map((s,i) => {
        const valid = speeds.slice(0,i+1).filter(v=>v!=null);
        return valid.length ? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length*10)/10 : null;
      });

      // Inning boundary annotations - yellow vertical lines
      // Always show 1回 at pitch 1
      const inningAnnotations = {
        inning1_start: {
          type: 'line', xMin: 0.5, xMax: 0.5,
          borderColor: 'rgba(255,230,0,.7)', borderWidth: 1.5,
          label: { content:'1回', display:true, color:'rgba(255,230,0,.9)', font:{size:10,weight:'bold'}, position:'end', yAdjust:6, backgroundColor:'transparent' }
        }
      };
      inningLines.forEach(il => {
        inningAnnotations[`inning${il.inning}`] = {
          type: 'line',
          xMin: il.num - 0.5, xMax: il.num - 0.5,
          borderColor: 'rgba(255,230,0,.7)', borderWidth: 1.5,
          label: { content:`${il.inning}回`, display:true, color:'rgba(255,230,0,.9)', font:{size:10,weight:'bold'}, position:'end', yAdjust:6, backgroundColor:'transparent' }
        };
      });

      drawMiniLineChart(`${chartId}-speed`, nums,
        [{label:'Speed (mph)', data:speeds, color:'#ef4444'},
         {label:'Avg', data:cumulativeAvg, color:'#f59e0b', dash:[4,4], width:1}],
        'mph', inningAnnotations);

      drawMiniLineChart(`${chartId}-count`, nums, [
        {label:'Balls',   data:balls,   color:'#3b82f6'},
        {label:'Strikes', data:strikes, color:'#ef4444'},
      ], '', inningAnnotations);

      drawMiniLineChart(`${chartId}-outs`, nums,
        [{label:'Outs', data:outs, color:'#f59e0b'}],
        '', inningAnnotations);

      // Build pitch type legend
      const typesSeen = {};
      allPitches.forEach(p => { if(p.type&&p.type!=='-') typesSeen[p.type]=pitchTypeColor(p.type); });
      const legendEl = document.getElementById(`zone-legend-${gamePk}`);
      if (legendEl) {
        legendEl.innerHTML = Object.entries(typesSeen).map(([type,color])=>
          `<span class="zt-legend-item"><span class="zt-dot" style="background:${color}"></span>${type}</span>`
        ).join('');
      }
    }, 100);

  } catch(e) {
    console.error('[MLB v11] toggleGamePitching error:', e);
    el.innerHTML=`<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

function drawMiniLineChart(canvasId, labels, datasets, yLabel, annotations={}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color,
        backgroundColor: ds.color+'22',
        borderWidth: ds.width||2,
        borderDash: ds.dash||[],
        pointRadius: ds.dash ? 0 : 3,
        pointStyle: 'circle',
        tension: 0,
        spanGaps: true,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: datasets.length>1, position:'top', labels:{color:'#8ba3be',font:{size:10},padding:8,usePointStyle:true} },
        tooltip: { backgroundColor:'#1a2035', titleColor:'#a0b4cc', bodyColor:'#e0e6f0', borderColor:'#2a3a55', borderWidth:1 },
        annotation: { annotations: annotations || {} },
      },
      scales: {
        x: { ticks:{color:'#6a8aaa',font:{size:10}}, grid:{color:'#1a2a3a'}, title:{display:true,text:'Pitch #',color:'#4a6278',font:{size:10}} },
        y: { ticks:{color:'#6a8aaa',font:{size:10}}, grid:{color:'#1a2a3a'}, title:{display:!!yLabel,text:yLabel,color:'#4a6278',font:{size:10}} }
      }
    }
  });
}

// ── Large pitch zone (SVG scatter plot) ───────────────────────────────────
function buildPitchZoneLarge(pitches, gamePk) {
  return buildPitchZoneTyped(pitches, gamePk, 'zdot');
}

function highlightZonePitch(gamePk, idx) { highlightScatterDot('zdot', gamePk, idx, 4.5); }
function clearZoneHighlight(gamePk)       { clearScatterHighlight('zdot', gamePk); }

// ── Team Standings ─────────────────────────────────────────────────────────
async function renderTeamStandings(container) {
  container.innerHTML = `<div class="loading-spinner"></div>`;
  try {
    const player = currentPlayer;
    const teamId = player.teamId;

    // Determine league (AL=103, NL=104) based on team
    const alTeams = [108,111,114,117,118,133,136,139,141,142,145,147]; // LAA,BOS,CLE,HOU,KC,OAK,SEA,TB,TOR,MIN,CWS,NYY
    const leagueId = alTeams.includes(teamId) ? 103 : 104;
    const leagueName = leagueId===103 ? 'American League' : 'National League';

    const [standingsRecords] = await Promise.all([
      fetchStandings(leagueId),
    ]);
    const scheduleDates = await fetchTeamStandingsHistory(teamId);

    console.log('[MLB v11c] standings divisions:', standingsRecords.map(d=>({
      divisionName: d.division?.name,
      divisionId: d.division?.id,
      teams: d.teamRecords?.length
    })));

    // Build standings table - grouped by division
    let myDivision = null;
    let standingsHtml = `<div class="team-standings-section"><div class="standings-league-title">${leagueName}</div>`;

    standingsRecords.forEach(division => {
      // MLB API returns division info in multiple possible locations
      const divName = division.division?.name 
        || division.division?.nameShort
        || division.divisionRecords?.[0]?.division?.name
        || `Division ${division.division?.id || ''}`;
      const hasMyTeam = division.teamRecords?.some(r => r.team?.id === teamId);
      if (hasMyTeam) myDivision = division;

      // Map division IDs to readable names as fallback
      const divId = division.division?.id;
      const divNameMap = {
        200: 'AL West', 201: 'AL East', 202: 'AL Central',
        203: 'NL West', 204: 'NL East', 205: 'NL Central',
      };
      const displayDivName = divName || divNameMap[divId] || `Division ${divId||''}`;

      standingsHtml += `
        <div class="standings-division">
          <div class="standings-div-title">${displayDivName}</div>
          <div class="standings-table">
            <div class="standings-header">
              <span>順位</span><span>チーム</span><span>W</span><span>L</span><span>Pct</span><span>GB</span>
            </div>
      `;
      division.teamRecords?.forEach((rec, idx) => {
        const isMyTeam = rec.team?.id === teamId;
        const gb = idx===0 ? '-' : (rec.gamesBack||'-');
        standingsHtml += `
          <div class="standings-row ${isMyTeam?'my-team':''}">
            <span class="standings-rank">${idx+1}</span>
            <span class="standings-team">
              <img class="standings-logo" src="https://www.mlbstatic.com/team-logos/${rec.team?.id}.svg" onerror="this.style.display='none'">
              ${isMyTeam?`<strong>${rec.team?.name||''}</strong>`:rec.team?.name||''}
            </span>
            <span class="standings-w">${rec.wins??'-'}</span>
            <span class="standings-l">${rec.losses??'-'}</span>
            <span>${rec.winningPercentage??'-'}</span>
            <span>${gb}</span>
          </div>
        `;
      });
      standingsHtml += `</div></div>`;
    });
    standingsHtml += `</div>`;

    // Build division rank history from each team's schedule
    const chartCanvasId = `team-rank-chart-${teamId}`;
    let rankChartHtml = `
      <div class="team-standings-section">
        <div class="summary-title">地区順位推移 / Division Rank Trend</div>
        <div class="chart-block" style="margin:0">
          <div class="chart-wrap" style="height:240px"><canvas id="${chartCanvasId}"></canvas></div>
        </div>
      </div>
    `;

    let html = standingsHtml + rankChartHtml;
    container.innerHTML = html;

    // Build rank history: fetch schedule for each team in my division
    setTimeout(async () => {
      try {
        if (!myDivision) return;
        const divTeams = myDivision.teamRecords || [];

        // For each team, build cumulative W/L history → derive rank per game date
        const teamHistories = await Promise.all(divTeams.map(async rec => {
          const tid = rec.team?.id;
          const dates = await fetchTeamStandingsHistory(tid);
          let w=0, l=0;
          const history = [];
          dates.forEach(d => {
            d.games?.forEach(game => {
              if (game.status?.abstractGameState !== 'Final') return;
              const isHome = game.teams?.home?.team?.id === tid;
              const myT = isHome ? game.teams?.home : game.teams?.away;
              if (myT?.isWinner === undefined) return;
              if (myT.isWinner) w++; else l++;
              history.push({ date: d.date, w, l, pct: w/(w+l||1) });
            });
          });
          return { teamId: tid, name: rec.team?.name||'?', history };
        }));

        // Collect all unique dates
        const allDates = [...new Set(teamHistories.flatMap(th=>th.history.map(h=>h.date)))].sort();

        // For each date, compute rank of each team
        const rankDataByTeam = teamHistories.map(th => ({ name: th.name, isMyTeam: th.teamId===teamId, data: [] }));

        allDates.forEach(date => {
          // Get pct of each team up to this date
          const pctsAtDate = teamHistories.map(th => {
            const games = th.history.filter(h=>h.date<=date);
            return games.length ? games[games.length-1].pct : 0;
          });
          // Sort descending → rank
          const sorted = [...pctsAtDate].sort((a,b)=>b-a);
          pctsAtDate.forEach((pct,i) => {
            const rank = sorted.indexOf(pct)+1;
            rankDataByTeam[i].data.push({ x: date, y: rank });
          });
        });

        // Draw chart
        destroyChart(chartCanvasId);
        const ctx = document.getElementById(chartCanvasId)?.getContext('2d');
        if (!ctx) return;

        const colors = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7'];
        chartInstances[chartCanvasId] = new Chart(ctx, {
          type: 'line',
          data: {
            datasets: rankDataByTeam.map((td, i) => ({
              label: td.name,
              data: td.data,
              borderColor: colors[i % colors.length],
              backgroundColor: colors[i % colors.length]+'22',
              borderWidth: td.isMyTeam ? 3 : 1.5,
              pointRadius: td.isMyTeam ? 4 : 2,
              pointStyle: td.isMyTeam ? 'circle' : 'circle',
              tension: 0,
              fill: false,
            }))
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode:'index', intersect:false },
            plugins: {
              legend: { display:true, position:'top', labels:{color:'#e0e6f0',font:{size:11},padding:10,usePointStyle:true} },
              tooltip: { backgroundColor:'#1a2035', titleColor:'#a0b4cc', bodyColor:'#e0e6f0', borderColor:'#2a3a55', borderWidth:1 }
            },
            scales: {
              x: { type:'time', time:{unit:'day',displayFormats:{day:'M/d'}}, ticks:{color:'#6a8aaa',font:{size:11},maxRotation:0}, grid:{color:'#1a2a3a'} },
              y: {
                reverse: true, // 1位が上
                min:1, max: divTeams.length,
                ticks:{ color:'#6a8aaa', font:{size:12}, stepSize:1,
                  callback: v => `${v}位` },
                grid:{ color:'#1a2a3a' },
                title:{ display:true, text:'順位 / Rank', color:'#6a8aaa' }
              }
            }
          }
        });
      } catch(e) {
        console.error('Division rank chart error:', e);
      }
    }, 100);

  } catch(e) {
    container.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function miniStat(val, lbl) {
  return `<div class="mini-stat"><span class="mini-val">${val}</span><span class="mini-lbl">${lbl}</span></div>`;
}

function getResultClass(event) {
  if (!event) return '';
  const e = event.toLowerCase();
  if (e.includes('home_run')) return 'r-hr';
  if (e==='strikeout') return 'r-k';
  if (e.includes('single')||e.includes('double')||e.includes('triple')) return 'r-hit';
  if (e.includes('walk')||e.includes('hit_by')) return 'r-walk';
  return 'r-out';
}

// ── Refresh ────────────────────────────────────────────────────────────────
async function refreshData() {
  const btn = document.getElementById('refresh-btn');
  btn.disabled=true;
  btn.innerHTML=`<span class="spin">↻</span> ${t('btnRefreshing')}`;
  gameLogCache={};
  try {
    if (currentTab==='batting')  await renderBattingTab();
    if (currentTab==='pitching') await renderPitchingTab();
    if (currentTab==='players'&&currentPlayer) await renderPlayerDetail(currentPlayer);
    localStorage.setItem('lastUpdated', new Date().toISOString());
    updateLastUpdatedDisplay();
  } finally {
    btn.disabled=false;
    btn.innerHTML=`↻ ${t('btnRefresh')}`;
  }
}

function updateLastUpdatedDisplay() {
  const el = document.getElementById('last-updated');
  if (!el) return;
  const ts = localStorage.getItem('lastUpdated');
  if (ts) {
    const d = new Date(ts);
    el.textContent = `${t('lastUpdated')}: ${d.toLocaleTimeString(currentLang==='ja'?'ja-JP':'en-US',{hour:'2-digit',minute:'2-digit'})}`;
  }
}

// ── Statcast / GitHub Actions trigger ────────────────────────────────────────
async function triggerGithubActions() {
  const token = localStorage.getItem('gh_token');
  const repo  = localStorage.getItem('gh_repo');

  if (!token || !repo) {
    openGhSettings();
    return;
  }

  const btn = document.getElementById('statcast-btn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Running...'; }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/fetch_statcast.yml/dispatches`,{
      method:'POST',
      headers:{'Authorization':`token ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({ref:'main'})
    });
    if (res.ok) {
      if (btn) { btn.textContent='✅ Started!'; setTimeout(()=>{ if(btn){btn.disabled=false;btn.textContent='📡 Statcast';} }, 3000); }
    } else {
      alert('Error: '+res.status+' — Check token/repo in ⚙ settings');
      if (btn) { btn.disabled=false; btn.textContent='📡 Statcast'; }
    }
  } catch(e) {
    alert('Failed: '+e.message);
    if (btn) { btn.disabled=false; btn.textContent='📡 Statcast'; }
  }
}

function openGhSettings() {
  // Remove existing modal if any
  document.getElementById('gh-modal')?.remove();

  const token = localStorage.getItem('gh_token') || '';
  const repo  = localStorage.getItem('gh_repo')  || 'SuperDaisy2025/mlb-japanese-players';

  const modal = document.createElement('div');
  modal.id = 'gh-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="document.getElementById('gh-modal').remove()"></div>
    <div class="modal-box">
      <div class="modal-title">⚙ Statcast設定 / GitHub Actions</div>
      <div class="modal-field">
        <label>Repository (owner/repo)</label>
        <input id="gh-repo-input" type="text" value="${repo}" placeholder="SuperDaisy2025/mlb-japanese-players">
      </div>
      <div class="modal-field">
        <label>GitHub Personal Access Token</label>
        <input id="gh-token-input" type="password" value="${token}" placeholder="ghp_...">
        <div class="modal-hint">Settings → Developer settings → Personal access tokens → workflow scope</div>
      </div>
      <div class="modal-actions">
        <button onclick="saveGhSettings()" class="btn-primary">保存して実行 / Save & Run</button>
        <button onclick="document.getElementById('gh-modal').remove()" class="btn-cancel">キャンセル</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveGhSettings() {
  const token = document.getElementById('gh-token-input').value.trim();
  const repo  = document.getElementById('gh-repo-input').value.trim();
  if (!token || !repo) { alert('Token と Repository を入力してください'); return; }
  localStorage.setItem('gh_token', token);
  localStorage.setItem('gh_repo', repo);
  document.getElementById('gh-modal')?.remove();
  triggerGithubActions();
}
