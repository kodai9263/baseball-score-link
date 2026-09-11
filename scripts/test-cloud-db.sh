#!/usr/bin/env bash
set -euo pipefail
# 検証専用の空DBだけを受け付ける。URLや接続秘密はログへ出さない。
: "${DATABASE_TEST_URL:?DATABASE_TEST_URL is required}"
case "$DATABASE_TEST_URL" in */score_cloud_test) ;; *) echo 'Use a disposable database named score_cloud_test' >&2; exit 1;; esac
psql "$DATABASE_TEST_URL" -X -v ON_ERROR_STOP=1 -q -f supabase/tests/bootstrap.sql
psql "$DATABASE_TEST_URL" -X -v ON_ERROR_STOP=1 -q -f supabase/migrations/202609120001_team_cloud.sql
psql "$DATABASE_TEST_URL" -X -v ON_ERROR_STOP=1 -q -f supabase/tests/team_cloud.sql
