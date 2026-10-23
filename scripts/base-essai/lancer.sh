#!/bin/bash
# Essaie les fichiers SQL du site sur une base Postgres LOCALE et jetable (jamais la vraie
# base) : socle imitant Supabase, puis supabase-setup.sql, supabase-extension.sql et
# supabase-administration.sql, puis les essais de droits (essais-portail.sql).
#   bash scripts/base-essai/lancer.sh
set -e
cd "$(dirname "$0")/../.."
D=/var/tmp/pgessai; B=$(ls -d /usr/lib/postgresql/*/bin | tail -1); P=5499
if ! psql -h $D -p $P -U postgres -c 'select 1' >/dev/null 2>&1; then
  mkdir -p $D && chown postgres:postgres $D
  [ -f $D/data/PG_VERSION ] || su postgres -c "$B/initdb -D $D/data -A trust -U postgres >/dev/null"
  su postgres -c "$B/pg_ctl -D $D/data -o '-p $P -k $D' -l $D/log start >/dev/null"
  sleep 2
fi
Q="psql -h $D -p $P -U postgres -v ON_ERROR_STOP=1 -q"
$Q -c 'drop database if exists essai' -c 'create database essai'
for f in scripts/base-essai/socle-supabase.sql supabase-setup.sql supabase-extension.sql supabase-administration.sql supabase-administration.sql scripts/base-essai/essais-administration.sql supabase-convocations.sql supabase-selection.sql supabase-places.sql supabase-places.sql scripts/base-essai/essais-places.sql supabase-rappel-avant.sql supabase-rappel-avant.sql scripts/base-essai/essais-rappel-avant.sql; do
  echo "########## $f"
  # pg_cron et pg_net n'existent pas en local : imités par le socle
  sed -E 's/^create extension if not exists (pg_cron|pg_net)[^;]*;/-- (essai local) &/' "$f" > /tmp/essai-sql.sql
  if ! $Q -d essai -f /tmp/essai-sql.sql > /tmp/essai-sql.log 2>&1; then
    grep -v NOTICE /tmp/essai-sql.log | tail -20; echo "❌ échec dans $f"; exit 1
  fi
  grep -v "NOTICE" /tmp/essai-sql.log | grep "✅\|❌" || true
done
echo "✅ base d'essai : tous les fichiers SQL passent"
