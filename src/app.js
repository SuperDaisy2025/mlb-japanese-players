// ============================================================
//  MLB Japanese Players Tracker - Main App
// ============================================================

let currentTab = 'batting';
let currentPeriod = 'season';
let currentPlayer = null;
let currentPlayerTab = 'summary';
let battingCache = {};
let pitchingCache = {};
let gameLogCache = {};

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  setLang(currentLang);
  renderPlayerSelector();
  await switchTab('batting');
  updateLastUpdatedDisplay();
});

// ---- Tab switching ----
async function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${tab}`)?.classList.add('active');

  if (tab === 'batting') await renderBattingTab();
  if (tab === 'pitching') await renderPitchingTab();
  if (tab === 'players') renderPlayersTab();
}

// ---- Period switching ----
async function switchPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.period-btn[data-period="${period}"]`).forEach(b => b.classList.add('active'));
  if (currentTab === 'batting') await renderBattingCharts();
  if (currentTab === 'pitching') await renderPitchingCharts();
}

// ============================================================
//  BATTING TAB
// ============================================================
async function renderBattingTab() {
  await renderBattingOverview();
  await renderBattingCharts();
}

async function renderBattingOverview() {
  const container = document.getElementById('batting-overview');
  container.innerHTML = `<div class="loading-spinner"></div>`;
  try {
    const stats = await fetchAllBattingStats();
    battingCache.overview = stats;
    const sorted = [...stats].sort((a, b) => (b.stat.homeRuns || 0) - (a.stat.homeRuns || 0));

    container.innerHTML = `
      <div class="stats-cards">
        ${sorted.map((r, i) => `
          <div class="stat-card ${i === 0 ? 'leader' : ''}" onclick="openPlayer(${r.player.id})">
            <div class="stat-card-header">
              <span class="player-badge" style="background:${PLAYER_COLORS[JAPANESE_PLAYERS.findIndex(p=>p.id===r.player.id)%7]}">
                ${r.player.number}
              </span>
              <div class="stat-card-name">
                <div class="name-ja">${r.player.nameJa}</div>
                <div class="name-en">${r.player.nameEn}</div>
              </div>
              <div class="team-badge">${r.player.team}</div>
            </div>
            <div class="stat-card-stats">
              <div class="mini-stat">
                <span class="mini-val">${r.stat.homeRuns ?? '-'}</span>
                <span class="mini-lbl">HR</span>
              </div>
              <div class="mini-stat">
                <span class="mini-val">${r.stat.avg ?? '-'}</span>
                <span class="mini-lbl">AVG</span>
              </div>
              <div class="mini-stat">
                <span class="mini-val">${r.stat.ops ?? '-'}</span>
                <span class="mini-lbl">OPS</span>
              </div>
              <div class="mini-stat">
                <span class="mini-val">${r.stat.rbi ?? '-'}</span>
                <span class="mini-lbl">RBI</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="error-msg">${t('error')}</div>`;
  }
}

async function renderBattingCharts() {
  const period = currentPeriod;
  const section = document.getElementById('batting-charts');
  section.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    // Fetch cumulative HR data for all batters
    const batters = JAPANESE_PLAYERS.filter(p => p.pos.includes('DH') || p.pos.includes('RF') || p.pos.includes('OF'));
    const allPlayers = JAPANESE_PLAYERS; // All can bat

    const hrDatasets = await Promise.all(
      allPlayers.map(async (p, i) => {
        const games = await fetchGameLog(p.id, 'hitting');
        const { start, end } = periodDates(period);
        const filtered = games.filter(g => g.date >= start && g.date <= end);
        let cum = 0;
        const data = filtered.map(g => {
          cum += (g.stat.homeRuns || 0);
          return { x: g.date, y: cum };
        });
        return { label: currentLang === 'ja' ? p.nameJa : p.nameEn, data };
      })
    );

    const avgDatasets = await Promise.all(
      allPlayers.map(async (p, i) => {
        const games = await fetchGameLog(p.id, 'hitting');
        const { start, end } = periodDates(period);
        const filtered = games.filter(g => g.date >= start && g.date <= end);
        const data = filtered.map(g => ({ x: g.date, y: parseFloat(g.stat.avg) || 0 }));
        return { label: currentLang === 'ja' ? p.nameJa : p.nameEn, data };
      })
    );

    const opsDatasets = await Promise.all(
      allPlayers.map(async (p) => {
        const games = await fetchGameLog(p.id, 'hitting');
        const { start, end } = periodDates(period);
        const filtered = games.filter(g => g.date >= start && g.date <= end);
        const data = filtered.map(g => ({ x: g.date, y: parseFloat(g.stat.ops) || 0 }));
        return { label: currentLang === 'ja' ? p.nameJa : p.nameEn, data };
      })
    );

    section.innerHTML = `
      <div class="chart-block">
        <h3 class="chart-title">${t('homeRuns')} <span class="chart-period-label">${t(period === '1w' ? 'period1W' : period === '1m' ? 'period1M' : 'periodSeason')}</span></h3>
        <div class="chart-wrap"><canvas id="chart-hr"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">${t('avg')}</h3>
        <div class="chart-wrap"><canvas id="chart-avg"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">OPS</h3>
        <div class="chart-wrap"><canvas id="chart-ops"></canvas></div>
      </div>
    `;

    renderLineChart('chart-hr', hrDatasets.filter(d => d.data.length > 0), { yLabel: 'HR' });
    renderLineChart('chart-avg', avgDatasets.filter(d => d.data.length > 0), { yLabel: 'AVG' });
    renderLineChart('chart-ops', opsDatasets.filter(d => d.data.length > 0), { yLabel: 'OPS' });

  } catch (e) {
    section.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

// ============================================================
//  PITCHING TAB
// ============================================================
async function renderPitchingTab() {
  await renderPitchingOverview();
  await renderPitchingCharts();
}

async function renderPitchingOverview() {
  const container = document.getElementById('pitching-overview');
  container.innerHTML = `<div class="loading-spinner"></div>`;
  try {
    const stats = await fetchAllPitchingStats();
    pitchingCache.overview = stats;
    const sorted = [...stats].sort((a, b) => (parseFloat(a.stat.era) || 99) - (parseFloat(b.stat.era) || 99));

    container.innerHTML = `
      <div class="stats-cards">
        ${sorted.map((r, i) => `
          <div class="stat-card ${i === 0 ? 'leader' : ''}" onclick="openPlayer(${r.player.id})">
            <div class="stat-card-header">
              <span class="player-badge" style="background:${PLAYER_COLORS[JAPANESE_PLAYERS.findIndex(p=>p.id===r.player.id)%7]}">
                ${r.player.number}
              </span>
              <div class="stat-card-name">
                <div class="name-ja">${r.player.nameJa}</div>
                <div class="name-en">${r.player.nameEn}</div>
              </div>
              <div class="team-badge">${r.player.team}</div>
            </div>
            <div class="stat-card-stats">
              <div class="mini-stat">
                <span class="mini-val">${r.stat.wins ?? '-'}-${r.stat.losses ?? '-'}</span>
                <span class="mini-lbl">W-L</span>
              </div>
              <div class="mini-stat">
                <span class="mini-val">${r.stat.era ?? '-'}</span>
                <span class="mini-lbl">ERA</span>
              </div>
              <div class="mini-stat">
                <span class="mini-val">${r.stat.whip ?? '-'}</span>
                <span class="mini-lbl">WHIP</span>
              </div>
              <div class="mini-stat">
                <span class="mini-val">${r.stat.strikeOuts ?? '-'}</span>
                <span class="mini-lbl">K</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="error-msg">${t('error')}</div>`;
  }
}

async function renderPitchingCharts() {
  const section = document.getElementById('pitching-charts');
  section.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    const pitchers = JAPANESE_PLAYERS.filter(p => p.pos.includes('SP'));
    const { start, end } = periodDates(currentPeriod);

    const eraDatasets = await Promise.all(pitchers.map(async (p) => {
      const games = await fetchGameLog(p.id, 'pitching');
      const filtered = games.filter(g => g.date >= start && g.date <= end);
      const data = filtered.map(g => ({ x: g.date, y: parseFloat(g.stat.era) || 0 }));
      return { label: currentLang === 'ja' ? p.nameJa : p.nameEn, data };
    }));

    const winDatasets = await Promise.all(pitchers.map(async (p) => {
      const games = await fetchGameLog(p.id, 'pitching');
      const filtered = games.filter(g => g.date >= start && g.date <= end);
      let cum = 0;
      const data = filtered.map(g => {
        cum += (g.stat.wins || 0);
        return { x: g.date, y: cum };
      });
      return { label: currentLang === 'ja' ? p.nameJa : p.nameEn, data };
    }));

    const kDatasets = await Promise.all(pitchers.map(async (p) => {
      const games = await fetchGameLog(p.id, 'pitching');
      const filtered = games.filter(g => g.date >= start && g.date <= end);
      let cum = 0;
      const data = filtered.map(g => {
        cum += (g.stat.strikeOuts || 0);
        return { x: g.date, y: cum };
      });
      return { label: currentLang === 'ja' ? p.nameJa : p.nameEn, data };
    }));

    section.innerHTML = `
      <div class="chart-block">
        <h3 class="chart-title">${t('era')} <span class="chart-period-label">${t(currentPeriod === '1w' ? 'period1W' : currentPeriod === '1m' ? 'period1M' : 'periodSeason')}</span></h3>
        <div class="chart-wrap"><canvas id="chart-era"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">${t('wins')} (累積)</h3>
        <div class="chart-wrap"><canvas id="chart-wins"></canvas></div>
      </div>
      <div class="chart-block">
        <h3 class="chart-title">${t('strikeouts')} (累積)</h3>
        <div class="chart-wrap"><canvas id="chart-k"></canvas></div>
      </div>
    `;

    renderLineChart('chart-era', eraDatasets.filter(d => d.data.length > 0), { yLabel: 'ERA' });
    renderLineChart('chart-wins', winDatasets.filter(d => d.data.length > 0), { yLabel: 'Wins' });
    renderLineChart('chart-k', kDatasets.filter(d => d.data.length > 0), { yLabel: 'K' });

  } catch (e) {
    section.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

// ============================================================
//  PLAYERS TAB
// ============================================================
function renderPlayersTab() {
  const container = document.getElementById('panel-players');
  if (currentPlayer) {
    renderPlayerDetail(currentPlayer);
  } else {
    container.innerHTML = `
      <div class="player-select-grid">
        ${JAPANESE_PLAYERS.map((p, i) => `
          <div class="player-select-card" onclick="openPlayer(${p.id})" style="--accent:${PLAYER_COLORS[i%7]}">
            <div class="psc-number">${p.number}</div>
            <div class="psc-name">
              <div class="psc-ja">${p.nameJa}</div>
              <div class="psc-en">${p.nameEn}</div>
            </div>
            <div class="psc-team">${p.team}</div>
            <div class="psc-pos">${p.pos.join(' / ')}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

async function openPlayer(playerId) {
  currentPlayer = JAPANESE_PLAYERS.find(p => p.id === playerId);
  currentTab = 'players';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-players')?.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-players')?.classList.add('active');
  await renderPlayerDetail(currentPlayer);
}

async function renderPlayerDetail(player) {
  const container = document.getElementById('panel-players');
  const isTwoWay = player.pos.includes('SP') && (player.pos.includes('DH') || player.id === 660271);

  container.innerHTML = `
    <div class="player-detail">
      <div class="player-detail-header">
        <button class="back-btn" onclick="backToPlayers()">← ${currentLang === 'ja' ? '戻る' : 'Back'}</button>
        <div class="player-detail-title">
          <span class="player-detail-number" style="color:${PLAYER_COLORS[JAPANESE_PLAYERS.findIndex(p=>p.id===player.id)%7]}">#${player.number}</span>
          <div>
            <div class="player-detail-ja">${player.nameJa}</div>
            <div class="player-detail-en">${player.nameEn} · ${player.team}</div>
          </div>
        </div>
      </div>

      <div class="player-subtabs">
        <button class="subtab-btn ${currentPlayerTab==='summary'?'active':''}" onclick="switchPlayerTab('summary')">${t('playerSummary')}</button>
        <button class="subtab-btn ${currentPlayerTab==='batting-log'?'active':''}" onclick="switchPlayerTab('batting-log')">${t('asBatter')}</button>
        ${isTwoWay || player.pos.includes('SP') ? `<button class="subtab-btn ${currentPlayerTab==='pitching-log'?'active':''}" onclick="switchPlayerTab('pitching-log')">${t('asPitcher')}</button>` : ''}
      </div>

      <div id="player-subtab-content">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;

  await switchPlayerTab(currentPlayerTab);
}

function backToPlayers() {
  currentPlayer = null;
  currentPlayerTab = 'summary';
  renderPlayersTab();
}

async function switchPlayerTab(tab) {
  currentPlayerTab = tab;
  document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.subtab-btn`).forEach(b => {
    if (b.textContent.trim() === t(tab === 'summary' ? 'playerSummary' : tab === 'batting-log' ? 'asBatter' : 'asPitcher')) {
      b.classList.add('active');
    }
  });

  const content = document.getElementById('player-subtab-content');
  content.innerHTML = `<div class="loading-spinner"></div>`;

  if (tab === 'summary') await renderPlayerSummary(content);
  if (tab === 'batting-log') await renderBattingLog(content);
  if (tab === 'pitching-log') await renderPitchingLog(content);
}

async function renderPlayerSummary(container) {
  try {
    const [hitStat, pitchStat] = await Promise.all([
      fetchSeasonStats(currentPlayer.id, 'hitting'),
      currentPlayer.pos.includes('SP') ? fetchSeasonStats(currentPlayer.id, 'pitching') : null
    ]);

    let html = `<div class="summary-grid">`;

    if (hitStat) {
      html += `
        <div class="summary-section">
          <h3 class="summary-title">${t('asBatter')}</h3>
          <div class="summary-stats">
            ${statRow('Games', hitStat.gamesPlayed)}
            ${statRow('AB', hitStat.atBats)}
            ${statRow('AVG', hitStat.avg)}
            ${statRow('OBP', hitStat.obp)}
            ${statRow('SLG', hitStat.slg)}
            ${statRow('OPS', hitStat.ops)}
            ${statRow('HR', hitStat.homeRuns)}
            ${statRow('RBI', hitStat.rbi)}
            ${statRow('R', hitStat.runs)}
            ${statRow('H', hitStat.hits)}
            ${statRow('2B', hitStat.doubles)}
            ${statRow('3B', hitStat.triples)}
            ${statRow('BB', hitStat.baseOnBalls)}
            ${statRow('SO', hitStat.strikeOuts)}
            ${statRow('SB', hitStat.stolenBases)}
          </div>
        </div>
      `;
    }

    if (pitchStat) {
      html += `
        <div class="summary-section">
          <h3 class="summary-title">${t('asPitcher')}</h3>
          <div class="summary-stats">
            ${statRow('W-L', `${pitchStat.wins}-${pitchStat.losses}`)}
            ${statRow('ERA', pitchStat.era)}
            ${statRow('G', pitchStat.gamesPlayed)}
            ${statRow('GS', pitchStat.gamesStarted)}
            ${statRow('IP', pitchStat.inningsPitched)}
            ${statRow('WHIP', pitchStat.whip)}
            ${statRow('K', pitchStat.strikeOuts)}
            ${statRow('BB', pitchStat.baseOnBalls)}
            ${statRow('H', pitchStat.hits)}
            ${statRow('HR', pitchStat.homeRuns)}
            ${statRow('K/9', pitchStat.strikeoutsPer9Inn)}
            ${statRow('BB/9', pitchStat.walksPer9Inn)}
          </div>
        </div>
      `;
    }

    html += `</div>`;

    // Statcast section
    const statcast = await loadStatcastData(currentPlayer.id);
    if (statcast) {
      html += `
        <div class="statcast-section">
          <h3 class="summary-title">Statcast <span class="badge-statcast">Advanced</span></h3>
          <div class="statcast-note">${t('statcastNote')}</div>
          <div class="statcast-stats">
            ${statcast.exit_velocity ? statRow('Exit Velo (avg)', statcast.exit_velocity + ' mph') : ''}
            ${statcast.launch_angle ? statRow('Launch Angle', statcast.launch_angle + '°') : ''}
            ${statcast.hard_hit_pct ? statRow('Hard Hit %', statcast.hard_hit_pct + '%') : ''}
            ${statcast.xba ? statRow('xBA', statcast.xba) : ''}
            ${statcast.xslg ? statRow('xSLG', statcast.xslg) : ''}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="statcast-section">
          <h3 class="summary-title">Statcast <span class="badge-statcast">GitHub Actions</span></h3>
          <p class="statcast-note">${t('gbNote')}</p>
          <button class="btn-secondary" onclick="triggerGithubActions()">🔄 ${t('gbTrigger')}</button>
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

function statRow(label, value) {
  return `
    <div class="stat-row">
      <span class="stat-row-label">${label}</span>
      <span class="stat-row-value">${value ?? '-'}</span>
    </div>
  `;
}

async function renderBattingLog(container) {
  try {
    const games = await fetchGameLog(currentPlayer.id, 'hitting');
    if (!games.length) {
      container.innerHTML = `<div class="no-data">${t('noData')}</div>`;
      return;
    }

    const reversed = [...games].reverse();
    let html = `<div class="game-log">`;

    for (const game of reversed.slice(0, 30)) {
      const s = game.stat;
      const opp = game.team?.name || game.opponent?.name || '?';
      const isHome = game.isHome;

      html += `
        <div class="game-log-row" onclick="toggleGameAtBats('${game.game?.gamePk}', this)">
          <div class="game-log-date">${game.date}</div>
          <div class="game-log-opp">${isHome ? 'vs' : '@'} ${opp}</div>
          <div class="game-log-stats">
            <span>${s.hits ?? 0}-${s.atBats ?? 0}</span>
            <span>${s.homeRuns ?? 0} HR</span>
            <span>${s.rbi ?? 0} RBI</span>
            <span class="avg-badge">${s.avg ?? '.000'}</span>
          </div>
          <span class="expand-icon">▶</span>
        </div>
        <div class="game-atbats" id="atbats-${game.game?.gamePk}" style="display:none">
          <div class="loading-spinner-sm"></div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

async function toggleGameAtBats(gamePk, rowEl) {
  if (!gamePk) return;
  const el = document.getElementById(`atbats-${gamePk}`);
  if (!el) return;

  const icon = rowEl.querySelector('.expand-icon');
  if (el.style.display === 'block') {
    el.style.display = 'none';
    if (icon) icon.textContent = '▶';
    return;
  }

  el.style.display = 'block';
  if (icon) icon.textContent = '▼';

  try {
    const plays = await fetchGamePlayByPlay(gamePk);
    const playerPlays = plays.filter(p =>
      p.matchup?.batter?.id === currentPlayer.id
    );

    if (!playerPlays.length) {
      el.innerHTML = `<div class="no-data-sm">${t('noData')}</div>`;
      return;
    }

    let html = `<div class="atbat-list">`;
    playerPlays.forEach((play, abIdx) => {
      const pitcher = play.matchup?.pitcher?.fullName || '?';
      const pitches = play.playEvents?.filter(e => e.isPitch) || [];
      const result = play.result?.description || play.result?.event || '-';
      const count = play.result?.rbi || 0;

      html += `
        <div class="atbat-block">
          <div class="atbat-header">
            <span class="ab-num">${currentLang==='ja'?'第':'AB '}${abIdx+1}${currentLang==='ja'?' 打席':''}</span>
            <span class="ab-pitcher">vs ${pitcher}</span>
            <span class="ab-result ${getResultClass(play.result?.event)}">${result}</span>
            ${count ? `<span class="ab-rbi">${count} RBI</span>` : ''}
          </div>
          <div class="pitch-table">
            <div class="pitch-table-header">
              <span>#</span><span>${t('pitchType')}</span><span>${t('speed')}</span><span>${t('outcome')}</span>
            </div>
            ${pitches.map((pitch, i) => `
              <div class="pitch-row ${i === pitches.length-1 ? 'last-pitch' : ''}">
                <span>${i+1}</span>
                <span>${pitch.details?.type?.description || '-'}</span>
                <span>${pitch.pitchData?.startSpeed ? Math.round(pitch.pitchData.startSpeed) + ' mph' : '-'}</span>
                <span class="pitch-outcome">${pitch.details?.description || '-'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="error-msg">${t('error')}</div>`;
  }
}

async function renderPitchingLog(container) {
  try {
    const games = await fetchGameLog(currentPlayer.id, 'pitching');
    if (!games.length) {
      container.innerHTML = `<div class="no-data">${t('noData')}</div>`;
      return;
    }

    const reversed = [...games].reverse();
    let html = `<div class="game-log">`;

    for (const game of reversed.slice(0, 20)) {
      const s = game.stat;
      const opp = game.team?.name || '?';

      html += `
        <div class="game-log-row" onclick="toggleGamePitching('${game.game?.gamePk}', this)">
          <div class="game-log-date">${game.date}</div>
          <div class="game-log-opp">${opp}</div>
          <div class="game-log-stats">
            <span>${s.wins ? 'W' : s.losses ? 'L' : 'ND'}</span>
            <span>${s.inningsPitched ?? 0} IP</span>
            <span>${s.strikeOuts ?? 0} K</span>
            <span class="era-badge">ERA ${s.era ?? '-'}</span>
          </div>
          <span class="expand-icon">▶</span>
        </div>
        <div class="game-pitching" id="pitching-${game.game?.gamePk}" style="display:none">
          <div class="loading-spinner-sm"></div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="error-msg">${t('error')}: ${e.message}</div>`;
  }
}

async function toggleGamePitching(gamePk, rowEl) {
  if (!gamePk) return;
  const el = document.getElementById(`pitching-${gamePk}`);
  if (!el) return;

  const icon = rowEl.querySelector('.expand-icon');
  if (el.style.display === 'block') {
    el.style.display = 'none';
    if (icon) icon.textContent = '▶';
    return;
  }

  el.style.display = 'block';
  if (icon) icon.textContent = '▼';

  try {
    const plays = await fetchPitchData(gamePk, currentPlayer.id);

    if (!plays.length) {
      el.innerHTML = `<div class="no-data-sm">${t('noData')}</div>`;
      return;
    }

    let html = `<div class="pitching-detail">`;
    html += `
      <div class="pitch-summary-table">
        <div class="pst-header">
          <span>${t('pitchNum')}</span>
          <span>${t('pitchType')}</span>
          <span>${t('speed')}</span>
          <span>${currentLang==='ja'?'打者':'Batter'}</span>
          <span>${t('outcome')}</span>
        </div>
    `;

    let pitchCount = 0;
    plays.forEach(play => {
      const batter = play.matchup?.batter?.fullName || '?';
      const pitches = play.playEvents?.filter(e => e.isPitch) || [];
      pitches.forEach(pitch => {
        pitchCount++;
        const type = pitch.details?.type?.description || '-';
        const speed = pitch.pitchData?.startSpeed ? Math.round(pitch.pitchData.startSpeed) + ' mph' : '-';
        const desc = pitch.details?.description || '-';
        const isFinal = pitch === pitches[pitches.length - 1];

        html += `
          <div class="pst-row ${isFinal ? 'final-pitch' : ''}">
            <span>${pitchCount}</span>
            <span>${type}</span>
            <span>${speed}</span>
            <span class="batter-name">${batter}</span>
            <span class="pitch-outcome ${getResultClass(pitch.details?.code)}">${desc}</span>
          </div>
        `;
      });
    });

    html += `</div></div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="error-msg">${t('error')}</div>`;
  }
}

function getResultClass(event) {
  if (!event) return '';
  const e = event.toLowerCase();
  if (e.includes('home run') || e.includes('homer')) return 'result-hr';
  if (e.includes('strikeout') || e === 'k') return 'result-k';
  if (e.includes('hit') || e.includes('single') || e.includes('double') || e.includes('triple')) return 'result-hit';
  if (e.includes('walk')) return 'result-walk';
  if (e.includes('out')) return 'result-out';
  return '';
}

// ---- Player selector ----
function renderPlayerSelector() {
  // Used by the header quick-select if needed
}

// ---- Refresh ----
async function refreshData() {
  const btn = document.getElementById('refresh-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spin">↻</span> ${t('btnRefreshing')}`;

  battingCache = {};
  pitchingCache = {};
  gameLogCache = {};

  try {
    if (currentTab === 'batting') await renderBattingTab();
    if (currentTab === 'pitching') await renderPitchingTab();
    if (currentTab === 'players' && currentPlayer) await renderPlayerDetail(currentPlayer);
    localStorage.setItem('lastUpdated', new Date().toISOString());
    updateLastUpdatedDisplay();
  } finally {
    btn.disabled = false;
    btn.innerHTML = `↻ ${t('btnRefresh')}`;
  }
}

function updateLastUpdatedDisplay() {
  const el = document.getElementById('last-updated');
  if (!el) return;
  const ts = localStorage.getItem('lastUpdated');
  if (ts) {
    const d = new Date(ts);
    el.textContent = `${t('lastUpdated')}: ${d.toLocaleString(currentLang === 'ja' ? 'ja-JP' : 'en-US')}`;
  }
}

// ---- GitHub Actions trigger ----
async function triggerGithubActions() {
  const token = localStorage.getItem('gh_token');
  const repo = localStorage.getItem('gh_repo');

  if (!token || !repo) {
    const entered = prompt(
      currentLang === 'ja'
        ? 'GitHubトークンとリポジトリを入力 (形式: TOKEN|owner/repo)'
        : 'Enter GitHub token and repo (format: TOKEN|owner/repo)'
    );
    if (!entered) return;
    const [t2, r] = entered.split('|');
    localStorage.setItem('gh_token', t2.trim());
    localStorage.setItem('gh_repo', r.trim());
  }

  const ghToken = localStorage.getItem('gh_token');
  const ghRepo = localStorage.getItem('gh_repo');

  try {
    const res = await fetch(`https://api.github.com/repos/${ghRepo}/actions/workflows/fetch_statcast.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' })
    });

    if (res.ok) {
      alert(currentLang === 'ja' ? 'GitHub Actionsを開始しました！約2分後にデータが更新されます。' : 'GitHub Actions triggered! Data will update in ~2 minutes.');
    } else {
      alert('Error: ' + res.status);
    }
  } catch (e) {
    alert('Failed: ' + e.message);
  }
}
