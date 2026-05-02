const I18N = {
  en: {
    appTitle: 'MLB Japanese Players',
    tabBatting: 'Batting',
    tabPitching: 'Pitching',
    tabPlayers: 'Players',
    btnRefresh: 'Refresh Data',
    btnRefreshing: 'Updating...',
    lastUpdated: 'Last updated',
    period1W: '1 Week',
    period1M: '1 Month',
    periodSeason: 'Full Season',
    homeRuns: 'Home Runs',
    avg: 'Batting Avg',
    ops: 'OPS',
    wins: 'Wins',
    era: 'ERA',
    whip: 'WHIP',
    strikeouts: 'Strikeouts',
    playerSummary: 'Summary',
    atBats: 'At-Bats',
    pitchLog: 'Pitch Log',
    game: 'Game',
    date: 'Date',
    opponent: 'Opponent',
    result: 'Result',
    pitcher: 'Pitcher',
    pitchNum: 'Pitch #',
    pitchType: 'Pitch Type',
    speed: 'Speed',
    outcome: 'Outcome',
    ab: 'AB',
    hits: 'H',
    rbi: 'RBI',
    loading: 'Loading...',
    error: 'Failed to load data',
    noData: 'No data available',
    selectPlayer: 'Select a player',
    asBatter: 'As Batter',
    asPitcher: 'As Pitcher',
    losses: 'Losses',
    innings: 'IP',
    gbTrigger: 'Trigger GitHub Actions Update',
    gbNote: 'Statcast data update (takes ~2 min)',
    statcastNote: 'Statcast detail (via GitHub Actions)',
    cumHR: 'Cumulative HR',
    season: 'Season',
  },
  ja: {
    appTitle: 'MLB日本人選手トラッカー',
    tabBatting: '打者',
    tabPitching: '投手',
    tabPlayers: '選手',
    btnRefresh: 'データ更新',
    btnRefreshing: '更新中...',
    lastUpdated: '最終更新',
    period1W: '直近1週間',
    period1M: '直近1か月',
    periodSeason: '今季全体',
    homeRuns: 'ホームラン',
    avg: '打率',
    ops: 'OPS',
    wins: '勝利',
    era: '防御率',
    whip: 'WHIP',
    strikeouts: '奪三振',
    playerSummary: 'サマリ',
    atBats: '打席詳細',
    pitchLog: '投球詳細',
    game: '試合',
    date: '日付',
    opponent: '対戦相手',
    result: '結果',
    pitcher: '投手',
    pitchNum: '球数',
    pitchType: '球種',
    speed: '球速',
    outcome: '結果',
    ab: '打数',
    hits: 'H',
    rbi: 'RBI',
    loading: '読み込み中...',
    error: 'データの取得に失敗しました',
    noData: 'データなし',
    selectPlayer: '選手を選んでください',
    asBatter: '打者として',
    asPitcher: '投手として',
    losses: '敗北',
    innings: '投球回',
    gbTrigger: 'GitHub Actions更新トリガー',
    gbNote: 'Statcastデータ更新（約2分かかります）',
    statcastNote: 'Statcast詳細（GitHub Actions経由）',
    cumHR: '累積HR',
    season: 'シーズン',
  }
};

let currentLang = localStorage.getItem('lang') || 'ja';

function t(key) {
  return I18N[currentLang][key] || I18N['en'][key] || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.getElementById('langBtn').textContent = lang === 'ja' ? 'EN' : 'JP';
}

function toggleLang() {
  setLang(currentLang === 'ja' ? 'en' : 'ja');
}
