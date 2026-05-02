# ⚾ MLB日本人選手トラッカー / MLB Japanese Players Tracker

MLB in Japan-born players statistics tracker — PWA with real-time MLB Stats API + Statcast data via GitHub Actions.

## 🚀 GitHub Pages Setup

### 1. Create Repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/mlb-japanese-players.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Repository → **Settings** → **Pages**
2. Source: **GitHub Actions**
3. Save

### 3. Enable GitHub Actions

1. Repository → **Actions** → Enable workflows

That's it! The app will be live at:
`https://YOUR_USERNAME.github.io/mlb-japanese-players/`

---

## 📊 Data Architecture

```
[GitHub Pages PWA]
    │
    ├── MLB Stats API (statsapi.mlb.com)
    │   ├── Season batting/pitching stats
    │   ├── Game-by-game logs
    │   └── At-bat play-by-play (pitch descriptions)
    │
    └── data/*.json (GitHub Actions → pybaseball)
        ├── statcast_batter_{id}.json  ← Statcast metrics (exit velo, xBA, etc.)
        └── statcast_pitcher_{id}.json ← Pitch velocity, spin rate, whiff%
```

### Data Update Frequency

| Data | Source | Update Trigger |
|------|--------|----------------|
| Stats (HR, ERA, etc.) | MLB Stats API | Real-time (on page load / refresh button) |
| Game logs | MLB Stats API | Real-time |
| Play-by-play | MLB Stats API | Real-time (on game row expand) |
| Statcast metrics | pybaseball via GitHub Actions | Daily at 8am JST + Manual trigger |

---

## 🔄 Manual Statcast Update

### Option A: From the app
1. Go to **選手 (Players)** tab → select a player → **Summary**
2. Click **"🔄 GitHub Actions更新トリガー"**
3. You'll be asked for a GitHub Personal Access Token the first time
   - Generate at: https://github.com/settings/tokens
   - Scopes needed: `repo` (or `workflow`)
4. Data updates in ~2 minutes

### Option B: GitHub UI
Repository → **Actions** → **Fetch Statcast Data** → **Run workflow**

### Option C: GitHub CLI
```bash
gh workflow run fetch_statcast.yml
```

---

## 🛠 Local Development

```bash
# Serve locally (Python)
python -m http.server 8080

# Or with Node
npx serve .
```

Open http://localhost:8080

---

## 📦 Updating Player Roster

Edit `src/mlb-api.js` — the `JAPANESE_PLAYERS` array:

```js
{ id: 660271, nameEn: 'Shohei Ohtani', nameJa: '大谷翔平', team: 'LAD', pos: ['DH','SP'], number: 17 },
```

Also update `scripts/fetch_statcast.py` — the `PLAYERS` list with the same MLBAM IDs.

---

## 📱 PWA Installation

- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome → Menu → Add to Home Screen
- **Desktop Chrome**: Address bar install icon

---

## 🏗 Tech Stack

- **Frontend**: Vanilla JS + Chart.js 4 + CSS3
- **Data**: MLB Stats API (no auth required) + pybaseball (Statcast)
- **Hosting**: GitHub Pages (free)
- **Automation**: GitHub Actions (free tier: 2000 min/month)
- **PWA**: Service Worker with network-first caching
