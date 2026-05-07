#!/bin/bash
# Cron wrapper — refresh Google Calendar snapshot du CRM Vanguard
# Run via crontab toutes les 4h (cf. README setup en bas)
LOG="/tmp/vanguard-cron-calendar.log"
TS=$(date '+%Y-%m-%d %H:%M:%S')

# Hit le endpoint local (le CRM tourne via launchd sur :7777)
RESP=$(curl -s -m 10 -X POST http://localhost:7777/api/calendar/refresh 2>&1)
EXIT=$?

echo "[$TS] exit=$EXIT resp=$RESP" >> "$LOG"

# Garde le log à <500 lignes (rotate light)
if [ -f "$LOG" ]; then
  LINES=$(wc -l < "$LOG")
  if [ "$LINES" -gt 500 ]; then
    tail -250 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  fi
fi
