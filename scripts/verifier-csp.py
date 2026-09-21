#!/usr/bin/env python3
"""
Vérifie que chaque <script> ET chaque <style> inline (JSON-LD compris) d'une page
dont le CSP a été durci (retrait de 'unsafe-inline') a bien son empreinte SHA-256
exacte dans le meta http-equiv="Content-Security-Policy" de cette même page —
script-src pour les <script>, style-src pour les <style>.

Pourquoi ce script existe (à lire avant de le supprimer ou de l'ignorer) :
fin septembre 2026, un script inline critique (le verrou de défilement de la
porte d'entrée, posé tout en haut de <body> sur index.html/en/index.html) a été
ajouté puis modifié plusieurs fois SANS jamais mettre à jour son empreinte CSP.
Le navigateur bloquait ce script en silence, sans erreur visible pour un visiteur
ni pour un développeur ne regardant pas la console — plusieurs jours de correctifs
qui semblaient corrects en relecture de code n'ont donc jamais réellement pris
effet en production. Voir README-TECHNIQUE.md, section "Porte d'entrée / verrou
de scroll", pour le récit complet.

Le même piège existe pour les <style> : sur tableau-de-bord.html (page à
plusieurs blocs <style>), seul le dernier bloc ajouté avait été haché — les 10
autres, déjà présents dans le fichier, ont été bloqués en silence dès le retrait
de 'unsafe-inline' de style-src, repéré uniquement grâce à un test navigateur.
D'où la vérification des <style> ci-dessous, qui aurait détecté ce cas avant
tout déploiement.

Utilisation :
    python3 scripts/verifier-csp.py                  # vérifie tout le site
    python3 scripts/verifier-csp.py index.html ...    # vérifie des fichiers précis

À exécuter après TOUTE modification d'un <script> ou d'un <style> inline sur une
page qui a son propre meta CSP (grep 'Content-Security-Policy' sur le fichier
pour le savoir). Code de sortie non nul si au moins une empreinte manque ou ne
correspond plus.
"""

import base64
import hashlib
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

MOTIF_CSP = re.compile(
    r'<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"',
    re.IGNORECASE,
)
MOTIF_SCRIPT_INLINE = re.compile(
    r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
MOTIF_STYLE_INLINE = re.compile(
    r'<style[^>]*>(.*?)</style>',
    re.IGNORECASE | re.DOTALL,
)
MOTIF_HASH_CSP = re.compile(r"'sha256-([A-Za-z0-9+/=]+)'")


def empreinte_sha256(texte: str) -> str:
    return "sha256-" + base64.b64encode(
        hashlib.sha256(texte.encode("utf-8")).digest()
    ).decode()


def verifier_fichier(chemin: Path) -> list[str]:
    html = chemin.read_text(encoding="utf-8")
    m_csp = MOTIF_CSP.search(html)
    if not m_csp:
        return []  # Page sans meta CSP dédié : dépend uniquement du header global, hors périmètre.

    contenu_csp = m_csp.group(1)
    hashs_autorises = {"sha256-" + h for h in MOTIF_HASH_CSP.findall(contenu_csp)}

    problemes = []
    for i, m in enumerate(MOTIF_SCRIPT_INLINE.finditer(html)):
        contenu_script = m.group(1)
        if not contenu_script.strip():
            continue
        empreinte = empreinte_sha256(contenu_script)
        if empreinte not in hashs_autorises:
            extrait = contenu_script.strip().splitlines()[0][:70]
            problemes.append(
                f"  script inline #{i} (commence par : {extrait!r}) "
                f"— empreinte absente du CSP : {empreinte}"
            )
    for i, m in enumerate(MOTIF_STYLE_INLINE.finditer(html)):
        contenu_style = m.group(1)
        if not contenu_style.strip():
            continue
        empreinte = empreinte_sha256(contenu_style)
        if empreinte not in hashs_autorises:
            extrait = contenu_style.strip().splitlines()[0][:70]
            problemes.append(
                f"  style inline #{i} (commence par : {extrait!r}) "
                f"— empreinte absente du CSP : {empreinte}"
            )
    return problemes


def main() -> int:
    if len(sys.argv) > 1:
        fichiers = [RACINE / arg for arg in sys.argv[1:]]
    else:
        fichiers = sorted(RACINE.glob("*.html")) + sorted(RACINE.glob("en/*.html"))

    total_problemes = 0
    for chemin in fichiers:
        if not chemin.exists():
            print(f"⚠️  {chemin} introuvable, ignoré.")
            continue
        problemes = verifier_fichier(chemin)
        if problemes:
            total_problemes += len(problemes)
            print(f"❌ {chemin.relative_to(RACINE)}")
            for p in problemes:
                print(p)

    if total_problemes:
        print(
            f"\n{total_problemes} empreinte(s) manquante(s) — ces scripts/styles "
            "sont bloqués en silence par le navigateur sur les pages concernées."
        )
        return 1

    print("✅ Toutes les pages avec un CSP dédié ont des empreintes à jour.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
