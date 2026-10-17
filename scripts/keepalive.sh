#!/usr/bin/env bash
# Keepalive (spec 9.6): call get_trip with a token no trip has. The expected
# answer is TRIP_NOT_FOUND; the request still counts as database activity, which
# keeps the free-plan project from being paused. Anything else is a failure.
#
# Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
set -euo pipefail

: "${SUPABASE_URL:?}" "${SUPABASE_PUBLISHABLE_KEY:?}"

# Fixed, and too short to be a real share token (those are 22 characters).
token="keepalive"

body=$(curl --silent --show-error --max-time 30 \
  -X POST "${SUPABASE_URL}/rest/v1/rpc/get_trip" \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"${token}\"}" \
  -w '\n%{http_code}')
status=${body##*$'\n'}
body=${body%$'\n'*}

code=$(jq -r '.code? // empty' <<<"$body" 2>/dev/null || true)
message=$(jq -r '.message? // empty' <<<"$body" 2>/dev/null || true)

if [ "$status" = 400 ] && [ "$code" = P0001 ] && [ "$message" = TRIP_NOT_FOUND ]; then
  echo "keepalive ok: get_trip answered TRIP_NOT_FOUND"
  exit 0
fi

# The response cannot contain trip data (the token matches no trip), so it is safe to print.
echo "::error::keepalive: expected TRIP_NOT_FOUND, got HTTP ${status}: ${body}" >&2
exit 1
