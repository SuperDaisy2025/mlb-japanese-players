const I18N = {
  en: {
    appTitle:'MLB Japanese Players', tabBatting:'Batting', tabPitching:'Pitching', tabPlayers:'Players',
    btnRefresh:'Refresh', btnRefreshing:'Updating...', lastUpdated:'Updated',
    period1W:'1 Week', period1M:'1 Month', periodSeason:'Season',
    homeRuns:'Home Runs', avg:'Batting Avg', ops:'OPS', wins:'Wins', era:'ERA', whip:'WHIP', strikeouts:'Strikeouts',
    playerSummary:'Summary', atBats:'As Batter', pitchLog:'As Pitcher',
    game:'Game', date:'Date', opponent:'Opponent', result:'Result', pitcher:'Pitcher',
    pitchNum:'#', pitchType:'Type', speed:'Speed', outcome:'Outcome',
    loading:'Loading...', error:'Failed to load data', noData:'No data', selectPlayer:'Select player',
    asBatter:'As Batter', asPitcher:'As Pitcher', losses:'L', innings:'IP',
    gbTrigger:'Trigger GitHub Actions', gbNote:'Statcast update (~2 min)',
    statcastNote:'Statcast data (via GitHub Actions)', cumulative:'Cumulative',
    filterPlayers:'Filter Players', selectAll:'All', clearAll:'Clear',
    home:'Home', away:'Away', stadium:'Venue', score:'Score',
    atBatResult:'Result', count:'Count', abDetail:'At-Bat Detail',
  },
  ja: {
    appTitle:'MLB日本人選手', tabBatting:'打者', tabPitching:'投手', tabPlayers:'選手',
    btnRefresh:'更新', btnRefreshing:'更新中...', lastUpdated:'更新',
    period1W:'直近1週間', period1M:'直近1か月', periodSeason:'今季全体',
    homeRuns:'ホームラン', avg:'打率', ops:'OPS', wins:'勝利', era:'防御率', whip:'WHIP', strikeouts:'奪三振',
    playerSummary:'サマリ', atBats:'打者', pitchLog:'投手',
    game:'試合', date:'日付', opponent:'対戦相手', result:'結果', pitcher:'投手',
    pitchNum:'#', pitchType:'球種', speed:'球速', outcome:'結果',
    loading:'読み込み中...', error:'データ取得失敗', noData:'データなし', selectPlayer:'選手を選択',
    asBatter:'打者として', asPitcher:'投手として', losses:'敗', innings:'投球回',
    gbTrigger:'GitHub Actions更新', gbNote:'Statcast更新（約2分）',
    statcastNote:'Statcast（GitHub Actions経由）', cumulative:'累積',
    filterPlayers:'選手を絞り込む', selectAll:'全選択', clearAll:'クリア',
    home:'ホーム', away:'アウェイ', stadium:'球場', score:'スコア',
    atBatResult:'打席結果', count:'カウント', abDetail:'打席詳細',
  }
};

let currentLang = localStorage.getItem('lang') || 'ja';

function t(key) { return I18N[currentLang][key] || I18N.en[key] || key; }

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.getElementById('langBtn').textContent = lang === 'ja' ? 'EN' : 'JP';
}

function toggleLang() { setLang(currentLang === 'ja' ? 'en' : 'ja'); }
