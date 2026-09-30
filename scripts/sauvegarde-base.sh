#!/usr/bin/env bash
# Sauvegarde chiffrée de la base Supabase (offre gratuite = aucune sauvegarde
# fournie par Supabase ; choix de la propriétaire le 30/09/2026 : rester en gratuit).
#
# Utilisé chaque semaine par .github/workflows/sauvegarde-base.yml, et utilisable à
# la main. Variables attendues :
#   SUPABASE_DB_URL     adresse de connexion « Session pooler » de Supabase, mot de
#                       passe compris (secret GitHub, jamais écrit dans le code)
#   BACKUP_PASSPHRASE   phrase secrète de chiffrement (gardée par la propriétaire)
#   SORTIE              dossier où écrire le fichier (défaut : ./sauvegarde)
#
# Contenu : tout le schéma « public » (structure + données : fiches, candidatures,
# inscriptions, boutique, journal…) et les comptes (auth.users, données seules).
# Les photos ne sont pas dans la base : elles sont chez Cloudflare R2.
#
# Restauration (voir README-TECHNIQUE.md, « Sauvegardes ») :
#   gpg --decrypt ma2m-base-AAAA-MM-JJ.sql.gz.gpg | gunzip > base.sql
#   psql "<adresse d'une base vide>" -f base.sql
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquant}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquant}"
SORTIE="${SORTIE:-sauvegarde}"
mkdir -p "$SORTIE"
DATE="$(date -u +%Y-%m-%d)"
FICHIER="$SORTIE/ma2m-base-$DATE.sql.gz.gpg"

{
  echo "-- Sauvegarde MA2M du $DATE (UTC)"
  # « IF NOT EXISTS » : une base neuve (Supabase compris) a déjà un schéma public ;
  # sans ça, la restauration s'arrêterait dès la première ligne.
  pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges --quote-all-identifiers \
    | sed 's/^CREATE SCHEMA "public";/CREATE SCHEMA IF NOT EXISTS "public";/'
  echo "-- Comptes (auth.users), données seules"
  pg_dump "$SUPABASE_DB_URL" --table=auth.users --data-only --no-owner --no-privileges --quote-all-identifiers
} | gzip -9 | gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 \
      --passphrase-fd 3 --output "$FICHIER" 3<<<"$BACKUP_PASSPHRASE"

TAILLE=$(stat -c %s "$FICHIER")
# Garde-fou : une sauvegarde presque vide veut dire qu'il y a un problème.
if [ "$TAILLE" -lt 2000 ]; then
  echo "Sauvegarde anormalement petite ($TAILLE octets)" >&2
  exit 1
fi
echo "Sauvegarde écrite : $FICHIER ($TAILLE octets)"
