#!/bin/bash
# Regenerate QA reports. Reads credentials from .env.local
cd /home/apex/.openclaw/workspace/jackpot-qa-dashboard
source .env.local 2>/dev/null || true
node scripts/regen-reports.js
