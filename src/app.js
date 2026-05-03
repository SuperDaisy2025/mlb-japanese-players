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
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  setLang(currentLang);
  await switchTab('batting');
  updateLastUpdatedDisplay();
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
            <img class="pf-logo" src="${teamLogoUrl(p.team)}" onerror="this.style.display='none'">
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
              <img class="team-logo-sm" src="${teamLogoUrl(r.player.team)}" onerror="this.style.display='none'">
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
      // Always fetch full season
      const games = await fetchGameLog(p.id, group);
      let cum = 0;
      const allData = games.map(g => {
        const v = parseFloat(g.stat[statKey]) || 0;
        if (cumulative) { cum += v; return { x: g.date, y: cum }; }
        return { x: g.date, y: v };
      });
      // Cumulative: always show full season so you can see the true total
      // AVG/OPS/ERA: filter to period
      if (cumulative) {
        return { label: currentLang==='ja'?p.nameJa:p.nameEn, data: allData, isHighlight: p.id===660271 };
      }
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
    renderLineChart('chart-hr',  hrSets.filter(d=>d.data.length),  {yLabel:'Cumulative HR'});
    renderLineChart('chart-avg', avgSets.filter(d=>d.data.length), {yLabel:'Batting Avg'});
    renderLineChart('chart-ops', opsSets.filter(d=>d.data.length), {yLabel:'OPS'});
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
            <img class="team-logo-sm" src="${teamLogoUrl(r.player.team)}" onerror="this.style.display='none'">
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
      if (cumulative) {
        return { label: currentLang==='ja'?p.nameJa:p.nameEn, data: allData, isHighlight: p.id===660271 };
      }
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
        <h3 class="chart-title">${t('wins')} <span class="chart-badge">${t('cumulative')}</span></h3>
        <div class="chart-wrap"><canvas id="chart-wins"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">${t('strikeouts')} <span class="chart-badge">${t('cumulative')}</span></h3>
        <div class="chart-wrap"><canvas id="chart-k"></canvas></div>
      </div>
    `;
    renderLineChart('chart-era',  eraSets.filter(d=>d.data.length),  {yLabel:'ERA'});
    renderLineChart('chart-wins', winSets.filter(d=>d.data.length),  {yLabel:'Wins'});
    renderLineChart('chart-k',    kSets.filter(d=>d.data.length),    {yLabel:'Strikeouts'});
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
      <img class="psc-logo" src="${teamLogoUrl(p.team)}" onerror="this.style.display='none'">
      <div class="psc-number">#${p.number}</div>
      <div class="psc-ja">${p.nameJa}</div>
      <div class="psc-en">${p.nameEn}</div>
      <div class="psc-meta">${p.team} · ${p.pos.join('/')}</div>
    </div>`;
}

async function openPlayer(playerId) {
  currentPlayer = JAPANESE_PLAYERS.find(p=>p.id===playerId);
  currentPlayerTab = 'summary';
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
        <img class="team-logo-md" src="${teamLogoUrl(player.team)}" onerror="this.style.display='none'">
        <div>
          <div class="player-detail-ja">${player.nameJa}</div>
          <div class="player-detail-en">${player.nameEn} · ${player.team} · #${player.number} · ${player.pos.join('/')}</div>
        </div>
      </div>
      <div class="player-subtabs">
        <button class="subtab-btn active" id="stab-summary" onclick="switchPlayerTab('summary')">${t('playerSummary')}</button>
        ${player.isBatter?`<button class="subtab-btn" id="stab-batting-log" onclick="switchPlayerTab('batting-log')">${t('asBatter')}</button>`:''}
        ${player.isPitcher?`<button class="subtab-btn" id="stab-pitching-log" onclick="switchPlayerTab('pitching-log')">${t('asPitcher')}</button>`:''}
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
            ${sr('AVG', hitStat.avg)}${sr('OBP', hitStat.obp)}${sr('SLG', hitStat.slg)}
            ${sr('OPS', hitStat.ops)}${sr('HR', hitStat.homeRuns)}${sr('RBI', hitStat.rbi)}
            ${sr('H', hitStat.hits)}${sr('AB', hitStat.atBats)}${sr('G', hitStat.gamesPlayed)}
            ${sr('R', hitStat.runs)}${sr('2B', hitStat.doubles)}${sr('3B', hitStat.triples)}
            ${sr('BB', hitStat.baseOnBalls)}${sr('SO', hitStat.strikeOuts)}${sr('SB', hitStat.stolenBases)}
          </div>
        </div>`;
    }

    if (pitchStat) {
      html += `
        <div class="summary-section">
          <div class="summary-title">${t('asPitcher')}</div>
          <div class="summary-grid-stats">
            ${sr('W-L', `${pitchStat.wins??0}-${pitchStat.losses??0}`)}${sr('ERA', pitchStat.era)}${sr('WHIP', pitchStat.whip)}
            ${sr('K', pitchStat.strikeOuts)}${sr('IP', pitchStat.inningsPitched)}${sr('G', pitchStat.gamesPlayed)}
            ${sr('GS', pitchStat.gamesStarted)}${sr('BB', pitchStat.baseOnBalls)}${sr('H', pitchStat.hits)}
            ${sr('HR', pitchStat.homeRuns)}${sr('K/9', pitchStat.strikeoutsPer9Inn)}${sr('BB/9', pitchStat.walksPer9Inn)}
          </div>
        </div>`;
    }

    html += `</div>`;

    // Statcast
    const sc = await loadStatcastData(currentPlayer.id, currentPlayer.isPitcher?'pitcher':'batter');
    html += `<div class="statcast-section">
      <div class="summary-title">Statcast <span class="badge-sc">Advanced</span></div>`;
    if (sc) {
      html += `<div class="summary-grid-stats">
        ${sc.exit_velocity?sr('Exit Velo', sc.exit_velocity+' mph'):''}
        ${sc.launch_angle?sr('Launch Angle', sc.launch_angle+'°'):''}
        ${sc.hard_hit_pct?sr('Hard Hit%', sc.hard_hit_pct+'%'):''}
        ${sc.xba?sr('xBA', sc.xba):''}${sc.xslg?sr('xSLG', sc.xslg):''}
        ${sc.whiff_rate?sr('Whiff%', sc.whiff_rate+'%'):''}
        ${sc.zone_pct?sr('Zone%', sc.zone_pct+'%'):''}
      </div>`;
    } else {
      html += `<p class="statcast-note">${t('gbNote')}</p>
        <button class="btn-secondary" onclick="triggerGithubActions()">🔄 ${t('gbTrigger')}</button>`;
    }
    html += `</div>`;

    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

function sr(label, value) {
  if (value===undefined||value===null) return '';
  return `<div class="sr-item"><span class="sr-lbl">${label}</span><span class="sr-val">${value}</span></div>`;
}

// ── Batting log ────────────────────────────────────────────────────────────
async function renderBattingLog(container) {
  try {
    const games = (await fetchGameLog(currentPlayer.id,'hitting')).reverse();
    if (!games.length) { container.innerHTML=`<div class="no-data">${t('noData')}</div>`; return; }

    let html = `<div class="game-log">`;
    for (const game of games.slice(0,40)) {
      const s = game.stat;
      const gamePk = game.game?.gamePk;
      const opp = game.opponent?.name || game.team?.name || '?';
      const isHome = game.isHome;
      // Team score from game stat (not always available in gameLog, we'll fetch on expand)
      html += `
        <div class="game-log-row" onclick="toggleGameAtBats('${gamePk}',this,'${opp.replace(/'/g,"\\'")}',${isHome})">
          <span class="gl-date">${game.date?.slice(5)||''}</span>
          <span class="gl-ha">${isHome?'🏠':'✈'}</span>
          <span class="gl-opp">${opp}</span>
          <span class="gl-score-placeholder" id="score-${gamePk}">-</span>
          <span class="gl-stat">${s.hits??0}/${s.atBats??0}</span>
          <span class="gl-stat">${s.homeRuns??0}HR</span>
          <span class="gl-stat">${s.rbi??0}RBI</span>
          <span class="gl-avg">AVG ${s.avg??'.000'}</span>
          <span class="gl-ops">OPS ${s.ops??'-'}</span>
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

async function toggleGameAtBats(gamePk, rowEl, opp, isHome) {
  if (!gamePk||gamePk==='undefined') return;
  const el = document.getElementById(`atbats-${gamePk}`);
  if (!el) return;
  const icon = rowEl.querySelector('.gl-arrow');
  if (el.style.display==='block') { el.style.display='none'; if(icon) icon.textContent='▶'; return; }
  el.style.display='block';
  if(icon) icon.textContent='▼';
  el.innerHTML=`<div class="loading-spinner-sm"></div>`;

  try {
    // Fetch play-by-play and linescore in parallel
    const [plays, linescore] = await Promise.all([
      fetchGamePlayByPlay(gamePk),
      fetchGameLinescore(gamePk),
    ]);

    // Update score in row
    if (linescore) {
      const away = linescore.teams?.away;
      const home = linescore.teams?.home;
      const scoreEl = document.getElementById(`score-${gamePk}`);
      if (scoreEl && away && home) {
        const myRuns  = isHome ? home.runs : away.runs;
        const oppRuns = isHome ? away.runs : home.runs;
        const wl = myRuns > oppRuns ? 'W' : myRuns < oppRuns ? 'L' : 'T';
        scoreEl.innerHTML = `<span class="gl-wl ${wl==='W'?'win':wl==='L'?'loss':''}">${wl}${myRuns}-${oppRuns}</span>`;
      }
    }

    const myPlays = plays.filter(p => p.matchup?.batter?.id===currentPlayer.id);
    if (!myPlays.length) { el.innerHTML=`<div class="no-data-sm">${t('noData')}</div>`; return; }

    // Build at-bat results summary line
    const abResults = myPlays.map(p => shortResult(p.result?.event)).join('　');

    let html = `<div class="ab-results-line">${abResults}</div>`;
    html += `<div class="ab-summary-list">`;

    myPlays.forEach((play, idx) => {
      const result = shortResult(play.result?.event);
      const pitcher = play.matchup?.pitcher?.fullName || '?';
      const pitches = play.playEvents?.filter(e=>e.isPitch)||[];
      const lastPitch = pitches[pitches.length-1];
      const balls = lastPitch?.count?.balls??0;
      const strikes = lastPitch?.count?.strikes??0;
      const abId = `ab-${gamePk}-${idx}`;

      html += `
        <div class="ab-summary-row" onclick="toggleAbDetail('${abId}',this)">
          <span class="ab-idx">${idx+1}</span>
          <span class="ab-result-badge ${getResultClass(play.result?.event)}">${result}</span>
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
                <div class="pitch-row ${i===pitches.length-1?'last-pitch':''}">
                  <span>${i+1}</span>
                  <span>${pitch.details?.type?.description||'-'}</span>
                  <span>${pitch.pitchData?.startSpeed?Math.round(pitch.pitchData.startSpeed)+' mph':'-'}</span>
                  <span>${pitch.count?.balls??0}-${pitch.count?.strikes??0}</span>
                  <span class="pitch-desc">${pitchShort(pitch.details?.description)}</span>
                </div>
              `).join('')}
            </div>
            <div class="pitch-zone-wrap">
              <div class="zone-label">Strike Zone</div>
              ${buildPitchZone(pitches)}
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML=`<div class="error-msg">${t('error')}</div>`;
  }
}

// Build 3×3 pitch zone grid
function buildPitchZone(pitches) {
  // plate: x -0.83 to 0.83, z roughly 1.5 to 3.5
  // 3x3 grid: cols left/mid/right, rows high/mid/low
  const zones = Array(3).fill(null).map(()=>Array(3).fill(null).map(()=>[]));

  pitches.forEach((pitch, i) => {
    const x = pitch.pitchData?.coordinates?.pX;
    const z = pitch.pitchData?.coordinates?.pZ;
    if (x===undefined||z===undefined||x===null||z===null) return;
    const col = x < -0.28 ? 0 : x > 0.28 ? 2 : 1;
    const row = z > 2.83 ? 0 : z < 2.0 ? 2 : 1;
    const desc = pitch.details?.description || '';
    const type = pitch.details?.type?.code || '';
    zones[row][col].push({ num: i+1, desc, type, isStrike: isStrikePitch(desc), isHit: desc.includes('play') });
  });

  let html = `<div class="pitch-zone">`;
  // Outside border row (high)
  for (let row=0; row<3; row++) {
    for (let col=0; col<3; col++) {
      const cell = zones[row][col];
      const dots = cell.map(p => `<span class="zone-dot ${p.isHit?'hit':p.isStrike?'strike':'ball'}" title="${p.desc}">${p.num}</span>`).join('');
      html += `<div class="zone-cell">${dots}</div>`;
    }
  }
  html += `</div>`;
  return html;
}

function isStrikePitch(desc) {
  if (!desc) return false;
  const d = desc.toLowerCase();
  return d.includes('strike') || d.includes('foul') || d.includes('swinging');
}

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
    const [plays, linescore] = await Promise.all([
      fetchPitchData(gamePk, currentPlayer.id),
      fetchGameLinescore(gamePk),
    ]);

    if (!plays.length) { el.innerHTML=`<div class="no-data-sm">${t('noData')}</div>`; return; }

    // Collect all pitches with metadata
    const allPitches = [];
    let pitchCount = 0;
    plays.forEach(play => {
      const batter = play.matchup?.batter?.fullName||'?';
      const pitches = play.playEvents?.filter(e=>e.isPitch)||[];
      pitches.forEach((pitch, i) => {
        pitchCount++;
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
          isFinal: i===pitches.length-1,
          finalEvent: isFinal && i===pitches.length-1 ? play.result?.event : null,
          pX: pitch.pitchData?.coordinates?.pX,
          pZ: pitch.pitchData?.coordinates?.pZ,
          inning: play.about?.inning,
        });
      });
    });

    // Build speed/count chart using canvas
    const chartId = `pitch-chart-${gamePk}`;
    const zoneId  = `pitch-zone-p-${gamePk}`;

    let html = `
      <div class="pitching-detail-wrap">
        <div class="pitching-charts-mini">
          <div class="mini-chart-block">
            <div class="mini-chart-title">球速推移 / Pitch Speed</div>
            <div class="mini-chart-wrap"><canvas id="${chartId}-speed"></canvas></div>
          </div>
          <div class="mini-chart-block">
            <div class="mini-chart-title">ボール-ストライク / Count</div>
            <div class="mini-chart-wrap"><canvas id="${chartId}-count"></canvas></div>
          </div>
          <div class="mini-chart-block">
            <div class="mini-chart-title">アウト数 / Outs</div>
            <div class="mini-chart-wrap"><canvas id="${chartId}-outs"></canvas></div>
          </div>
        </div>
        <div class="pitching-log-zone-wrap">
          <div class="pitch-log-left">
            <div class="pst-header">
              <span>#</span><span>${t('pitchType')}</span><span>${t('speed')}</span>
              <span>Batter</span><span>B-S</span><span>${t('outcome')}</span>
            </div>
            ${allPitches.map(p => `
              <div class="pst-row ${p.isFinal?'final-pitch':''}">
                <span>${p.num}</span>
                <span>${p.type}</span>
                <span>${p.speed?p.speed+' mph':'-'}</span>
                <span class="batter-cell">${p.batter}</span>
                <span>${p.balls}-${p.strikes}</span>
                <span class="pitch-outcome ${p.isFinal&&p.finalEvent?getResultClass(p.finalEvent):''}">
                  ${p.isFinal&&p.finalEvent ? shortResult(p.finalEvent) : pitchShort(p.desc)}
                </span>
              </div>
            `).join('')}
          </div>
          <div class="pitch-zone-wrap">
            <div class="zone-label">投球コース / Zone</div>
            ${buildPitchZone(allPitches.map(p=>({
              pitchData:{coordinates:{pX:p.pX,pZ:p.pZ}},
              details:{description:p.desc,type:{code:p.typeCode}}
            })))}
          </div>
        </div>
      </div>
    `;

    el.innerHTML = html;

    // Draw mini charts
    setTimeout(() => {
      const nums   = allPitches.map(p=>p.num);
      const speeds = allPitches.map(p=>p.speed);
      const balls  = allPitches.map(p=>p.balls);
      const strikes= allPitches.map(p=>p.strikes);
      const outs   = allPitches.map(p=>p.outs);

      drawMiniLineChart(`${chartId}-speed`, nums, [{label:'Speed (mph)', data:speeds, color:'#ef4444'}], 'mph');
      drawMiniLineChart(`${chartId}-count`, nums, [
        {label:'Balls',   data:balls,   color:'#3b82f6'},
        {label:'Strikes', data:strikes, color:'#ef4444'},
      ], '');
      drawMiniLineChart(`${chartId}-outs`, nums, [{label:'Outs', data:outs, color:'#f59e0b'}], '');
    }, 100);

  } catch(e) {
    el.innerHTML=`<div class="error-msg">${t('error')}</div>`;
  }
}

function drawMiniLineChart(canvasId, labels, datasets, yLabel) {
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
        borderWidth: 2,
        pointRadius: 3,
        pointStyle: 'circle',
        tension: 0,
        spanGaps: true,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: datasets.length>1, position:'top', labels:{color:'#8ba3be',font:{size:10},padding:8} },
        tooltip: { backgroundColor:'#1a2035', titleColor:'#a0b4cc', bodyColor:'#e0e6f0', borderColor:'#2a3a55', borderWidth:1 }
      },
      scales: {
        x: { ticks:{color:'#6a8aaa',font:{size:10}}, grid:{color:'#1a2a3a'}, title:{display:true,text:'Pitch #',color:'#4a6278',font:{size:10}} },
        y: { ticks:{color:'#6a8aaa',font:{size:10}}, grid:{color:'#1a2a3a'}, title:{display:!!yLabel,text:yLabel,color:'#4a6278',font:{size:10}} }
      }
    }
  });
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

async function triggerGithubActions() {
  let token = localStorage.getItem('gh_token');
  let repo  = localStorage.getItem('gh_repo');
  if (!token||!repo) {
    const v = prompt('GitHub Token と リポジトリ名を入力\n形式: TOKEN|owner/repo');
    if (!v) return;
    const [t2,r] = v.split('|');
    localStorage.setItem('gh_token', t2.trim());
    localStorage.setItem('gh_repo', r.trim());
    token=t2.trim(); repo=r.trim();
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/fetch_statcast.yml/dispatches`,{
      method:'POST',
      headers:{'Authorization':`token ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({ref:'main'})
    });
    alert(res.ok?(currentLang==='ja'?'GitHub Actions開始！約2分後に更新されます。':'GitHub Actions triggered! Updates in ~2 min.'):'Error: '+res.status);
  } catch(e) { alert('Failed: '+e.message); }
}
