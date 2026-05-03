#!/usr/bin/env python3
"""
Fetch Statcast data for Japanese MLB players using pybaseball.
Outputs JSON files to data/ directory for the PWA to consume.
"""

import json
import os
import warnings
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

warnings.filterwarnings('ignore')

# pybaseball uses cached data
from pybaseball import statcast_batter, statcast_pitcher, playerid_lookup, cache

cache.enable()

# ── Japanese players config ─────────────────────────────────────────────────
PLAYERS = [
    {"mlbam": 660271, "name_en": "Shohei Ohtani",      "name_ja": "大谷翔平",       "is_pitcher": True,  "is_batter": True},
    {"mlbam": 673548, "name_en": "Seiya Suzuki",        "name_ja": "鈴木誠也",       "is_pitcher": False, "is_batter": True},
    {"mlbam": 646240, "name_en": "Masataka Yoshida",    "name_ja": "吉田正尚",       "is_pitcher": False, "is_batter": True},
    {"mlbam": 808967, "name_en": "Munetaka Murakami",   "name_ja": "村上宗隆",       "is_pitcher": False, "is_batter": True},
    {"mlbam": 808968, "name_en": "Kazuma Okamoto",      "name_ja": "岡本和真",       "is_pitcher": False, "is_batter": True},
    {"mlbam": 673237, "name_en": "Yoshinobu Yamamoto",  "name_ja": "山本由伸",       "is_pitcher": True,  "is_batter": False},
    {"mlbam": 808969, "name_en": "Roki Sasaki",         "name_ja": "佐々木朗希",     "is_pitcher": True,  "is_batter": False},
    {"mlbam": 506433, "name_en": "Yu Darvish",          "name_ja": "ダルビッシュ有", "is_pitcher": True,  "is_batter": False},
    {"mlbam": 665750, "name_en": "Yusei Kikuchi",       "name_ja": "菊池雄星",       "is_pitcher": True,  "is_batter": False},
    {"mlbam": 660644, "name_en": "Kodai Senga",         "name_ja": "千賀滉大",       "is_pitcher": True,  "is_batter": False},
    {"mlbam": 669203, "name_en": "Shota Imanaga",       "name_ja": "今永昇太",       "is_pitcher": True,  "is_batter": False},
    {"mlbam": 669022, "name_en": "Yuki Matsui",         "name_ja": "松井裕樹",       "is_pitcher": True,  "is_batter": False},
]

SEASON = datetime.now().year
SEASON_START = f"{SEASON}-03-01"
SEASON_END   = datetime.now().strftime("%Y-%m-%d")

os.makedirs("data", exist_ok=True)

def safe_val(v):
    """Convert numpy/NaN values to JSON-safe types."""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(round(v, 3))
    return v

def df_to_records(df):
    """Convert DataFrame to list of dicts with safe values."""
    records = []
    for _, row in df.iterrows():
        record = {k: safe_val(v) for k, v in row.items()}
        records.append(record)
    return records

# ── Batter Statcast ──────────────────────────────────────────────────────────
def fetch_batter_statcast(player):
    pid = player["mlbam"]
    print(f"  Fetching batter Statcast: {player['name_en']} ({pid})")
    try:
        df = statcast_batter(SEASON_START, SEASON_END, player_id=pid)
        if df is None or df.empty:
            print(f"    No data for {player['name_en']}")
            return

        # Summary stats
        summary = {
            "player_id": pid,
            "name_en": player["name_en"],
            "name_ja": player["name_ja"],
            "updated": datetime.now().isoformat(),
            "total_pitches": len(df),
        }

        # Exit velocity & launch angle (batted balls only)
        batted = df[df['launch_speed'].notna()]
        if not batted.empty:
            summary["exit_velocity"]  = round(float(batted['launch_speed'].mean()), 1)
            summary["launch_angle"]   = round(float(batted['launch_angle'].mean()), 1)
            hard_hit = batted[batted['launch_speed'] >= 95]
            summary["hard_hit_pct"]   = round(len(hard_hit) / len(batted) * 100, 1)

        # xStats
        for col, key in [('estimated_ba_using_speedangle','xba'),
                         ('estimated_slg_using_speedangle','xslg'),
                         ('estimated_woba_using_speedangle','xwoba')]:
            if col in df.columns:
                val = df[col].dropna()
                if not val.empty:
                    summary[key] = round(float(val.mean()), 3)

        # Barrel %
        if 'barrel' in df.columns:
            barreled = df[df['barrel'] == 1]
            summary["barrel_pct"] = round(len(barreled) / max(len(batted), 1) * 100, 1)

        # Sprint speed
        if 'sprint_speed' in df.columns:
            ss = df['sprint_speed'].dropna()
            if not ss.empty:
                summary["sprint_speed"] = round(float(ss.mean()), 1)

        # Pitch type breakdown (as batter)
        pitch_types = df.groupby('pitch_name').size().reset_index(name='count')
        summary["pitch_type_breakdown"] = {
            row['pitch_name']: int(row['count'])
            for _, row in pitch_types.iterrows()
            if row['pitch_name']
        }

        # Per-game detail: pitch-by-pitch log
        keep_cols = [
            'game_date', 'game_pk', 'inning', 'inning_topbot',
            'pitch_name', 'release_speed', 'release_spin_rate',
            'plate_x', 'plate_z', 'launch_speed', 'launch_angle',
            'description', 'events', 'zone',
            'pitcher', 'pitcher_name' if 'pitcher_name' in df.columns else 'pitcher',
            'home_team', 'away_team', 'at_bat_number', 'pitch_number',
            'balls', 'strikes', 'outs_when_up', 'on_1b', 'on_2b', 'on_3b',
            'hit_distance_sc', 'hit_location', 'bb_type',
            'estimated_ba_using_speedangle', 'estimated_slg_using_speedangle',
        ]
        keep_cols = [c for c in keep_cols if c in df.columns]
        detail_df = df[keep_cols].copy()
        detail_df['game_date'] = detail_df['game_date'].astype(str)

        summary["pitch_log"] = df_to_records(detail_df.sort_values(['game_date','at_bat_number','pitch_number'], ascending=[False, True, True]))

        out_path = f"data/statcast_batter_{pid}.json"
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, default=str)
        print(f"    ✓ Saved {out_path} ({len(df)} pitches)")

    except Exception as e:
        print(f"    ✗ Error: {e}")

# ── Pitcher Statcast ─────────────────────────────────────────────────────────
def fetch_pitcher_statcast(player):
    pid = player["mlbam"]
    print(f"  Fetching pitcher Statcast: {player['name_en']} ({pid})")
    try:
        df = statcast_pitcher(SEASON_START, SEASON_END, player_id=pid)
        if df is None or df.empty:
            print(f"    No data for {player['name_en']}")
            return

        summary = {
            "player_id": pid,
            "name_en": player["name_en"],
            "name_ja": player["name_ja"],
            "updated": datetime.now().isoformat(),
            "total_pitches": len(df),
        }

        # Pitch velocity by type
        if 'pitch_name' in df.columns and 'release_speed' in df.columns:
            velo = df.groupby('pitch_name')['release_speed'].agg(['mean','max','count']).reset_index()
            summary["pitch_velocity"] = {
                row['pitch_name']: {
                    "avg_mph": round(float(row['mean']), 1),
                    "max_mph": round(float(row['max']), 1),
                    "count": int(row['count'])
                }
                for _, row in velo.iterrows()
                if row['pitch_name']
            }

        # Spin rate by pitch
        if 'release_spin_rate' in df.columns:
            spin = df.groupby('pitch_name')['release_spin_rate'].mean().reset_index()
            summary["spin_rate"] = {
                row['pitch_name']: round(float(row['release_spin_rate']), 0)
                for _, row in spin.iterrows()
                if row['pitch_name']
            }

        # Whiff rate
        if 'description' in df.columns:
            swings = df[df['description'].isin(['swinging_strike','swinging_strike_blocked','foul','hit_into_play'])]
            whiffs = df[df['description'].isin(['swinging_strike','swinging_strike_blocked'])]
            if len(swings) > 0:
                summary["whiff_rate"] = round(len(whiffs) / len(swings) * 100, 1)

        # Zone %
        if 'zone' in df.columns:
            in_zone = df[df['zone'].between(1, 9)]
            summary["zone_pct"] = round(len(in_zone) / len(df) * 100, 1)

        # Pitch type usage %
        if 'pitch_name' in df.columns:
            usage = df['pitch_name'].value_counts(normalize=True) * 100
            summary["pitch_usage_pct"] = {k: round(float(v), 1) for k, v in usage.items() if k}

        # Per-game pitch log
        keep_cols = [
            'game_date', 'game_pk', 'inning', 'inning_topbot',
            'pitch_name', 'release_speed', 'release_spin_rate',
            'plate_x', 'plate_z',
            'description', 'events', 'zone',
            'batter', 'stand',
            'home_team', 'away_team', 'at_bat_number', 'pitch_number',
            'balls', 'strikes', 'outs_when_up',
            'pfx_x', 'pfx_z',
        ]
        keep_cols = [c for c in keep_cols if c in df.columns]
        detail_df = df[keep_cols].copy()
        detail_df['game_date'] = detail_df['game_date'].astype(str)

        summary["pitch_log"] = df_to_records(detail_df.sort_values(['game_date','at_bat_number','pitch_number'], ascending=[False,True,True]))

        out_path = f"data/statcast_pitcher_{pid}.json"
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, default=str)
        print(f"    ✓ Saved {out_path} ({len(df)} pitches)")

    except Exception as e:
        print(f"    ✗ Error: {e}")

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    print(f"🏟  Fetching MLB Statcast data — {SEASON} season")
    print(f"   Period: {SEASON_START} → {SEASON_END}")
    print()

    for player in PLAYERS:
        print(f"── {player['name_ja']} ({player['name_en']}) ──")
        if player["is_batter"]:
            fetch_batter_statcast(player)
        if player["is_pitcher"]:
            fetch_pitcher_statcast(player)
        print()

    # Write metadata
    meta = {
        "updated": datetime.now().isoformat(),
        "season": SEASON,
        "players": [{"id": p["mlbam"], "name_en": p["name_en"], "name_ja": p["name_ja"]} for p in PLAYERS]
    }
    with open("data/meta.json", 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("✅ Done! All data saved to data/")

if __name__ == "__main__":
    main()
