# Instructions pour toute IA (agent de code) qui travaille sur ce dépôt

**STOP — avant toute action, lire en entier et respecter :**

1. [`CLAUDE.md`](CLAUDE.md) : règles obligatoires de la propriétaire. Elles valent pour
   **toute** IA, quel que soit son nom (Claude, ChatGPT/Codex, Copilot, Gemini, Cursor…).
2. [`SECURITY.md`](SECURITY.md) : ce qu'il ne faut jamais faire pour la sécurité.
3. [`README-TECHNIQUE.md`](README-TECHNIQUE.md) : fonctionnement complet du site.

Rappels essentiels :

- Écrire à la propriétaire **en français**, simplement, une chose à la fois.
- La branche `main` est mise en ligne automatiquement : **aucune fusion dans `main` sans son
  accord écrit**. Travailler sur une branche à part.
- Tester comme un visiteur (`bash scripts/tests-visiteur/lancer.sh`), sans aucune écriture
  réelle dans la base. Relire avant de publier. Vérifier le site en ligne après.
- Ne jamais demander ni écrire de mot de passe, de code ou de clé secrète dans une
  conversation.
- Après toute modification d'un fichier `js/` ou `css/` : `python3 scripts/versionner.py`
  (numéros de version des fichiers, sinon les visiteurs gardent l'ancienne version) et
  `python3 scripts/verifier-csp.py`.
