#!/usr/bin/env python3
"""
SilphScope PvP — Multi-Source AI Telemetry & Anomaly Ingestion Script (Python 3.8+ compatible)
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / ".aistudio" / "telemetry_cache"
STATE_FILE = CACHE_DIR / "ingested_batches.json"
SUMMARY_FILE = CACHE_DIR / "latest_anomaly_report.json"
REPO = "sportsfan986/silphscope-pvp"

CACHE_DIR.mkdir(parents=True, exist_ok=True)


def load_cache():
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"ingestedBatchIds": {}, "records": []}


def save_cache(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def fetch_url(url, as_json=True):
    headers = {
        "User-Agent": "SilphScopePvP-AIStudio/1.0",
        "Accept": "application/vnd.github+json" if as_json else "*/*",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            data = res.read().decode("utf-8", errors="replace")
            return json.loads(data) if as_json else data
    except Exception:
        return None


def main():
    state = load_cache()
    new_batches = 0
    new_battles = 0

    # 1. Fetch manifest from ai-telemetry-logs branch
    manifest = fetch_url(
        f"https://raw.githubusercontent.com/{REPO}/ai-telemetry-logs/manifest.json"
    )
    if manifest and isinstance(manifest.get("batches"), list):
        for b in manifest["batches"]:
            batch_id = b.get("batchId")
            if not batch_id or batch_id in state["ingestedBatchIds"]:
                continue
            target_path = b.get("path") or b.get("userPath")
            if not target_path:
                continue
            raw_jsonl = fetch_url(
                f"https://raw.githubusercontent.com/{REPO}/ai-telemetry-logs/{target_path}",
                as_json=False,
            )
            if raw_jsonl:
                lines = [l.strip() for l in raw_jsonl.splitlines() if l.strip()]
                parsed_count = 0
                for l in lines:
                    try:
                        state["records"].append(json.loads(l))
                        parsed_count += 1
                    except Exception:
                        pass
                new_battles += parsed_count
                state["ingestedBatchIds"][batch_id] = {
                    "source": "ai-telemetry-logs",
                    "uploadedBy": b.get("uploader") or b.get("uploadedBy") or "unknown",
                    "ingestedAt": datetime.utcnow().isoformat() + "Z",
                    "battleCount": parsed_count,
                }
                new_batches += 1

    # 2. Check open issues with [AI-TELEMETRY-BATCH]
    open_issues = fetch_url(
        f"https://api.github.com/repos/{REPO}/issues?state=open&per_page=100"
    )
    if isinstance(open_issues, list):
        for issue in open_issues:
            title = str(issue.get("title", ""))
            if not title.startswith("[AI-TELEMETRY-BATCH]"):
                continue
            parts = title.split()
            batch_id = parts[1] if len(parts) > 1 else f"issue_{issue.get('number', 'unknown')}"
            batch_id = re.sub(r"[^a-zA-Z0-9._-]", "_", batch_id)
            if batch_id in state["ingestedBatchIds"]:
                continue
            body = str(issue.get("body", ""))
            match = re.search(r"```jsonl\s*([\s\S]*?)```", body)
            if match:
                lines = [l.strip() for l in match.group(1).splitlines() if l.strip()]
                parsed_count = 0
                for l in lines:
                    try:
                        state["records"].append(json.loads(l))
                        parsed_count += 1
                    except Exception:
                        pass
                new_battles += parsed_count
                state["ingestedBatchIds"][batch_id] = {
                    "source": f"issue:{issue.get('number')}",
                    "uploadedBy": issue.get("user", {}).get("login", "external"),
                    "ingestedAt": datetime.utcnow().isoformat() + "Z",
                    "battleCount": parsed_count,
                }
                new_batches += 1

    save_cache(state)

    all_anomalies = []
    for r in state["records"]:
        for a in r.get("anomalies", []):
            entry = {
                "battleId": r.get("battleId"),
                "league": r.get("league"),
                "teamName": r.get("teamName"),
                "result": r.get("result"),
                "userTeamSpecs": r.get("userTeamSpecs"),
                "oppTeamSpecs": r.get("oppTeamSpecs"),
                **a,
            }
            all_anomalies.append(entry)

    summary = {
        "updatedAt": datetime.utcnow().isoformat() + "Z",
        "newlyIngestedBatches": new_batches,
        "newlyIngestedBattles": new_battles,
        "totalCachedBatches": len(state["ingestedBatchIds"]),
        "totalCachedBattles": len(state["records"]),
        "totalAnomalies": len(all_anomalies),
        "recentAnomalies": all_anomalies[-25:],
    }

    with open(SUMMARY_FILE, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
