# Guide de secours — site Maître Akesse Model Management

*Version du 13/10/2026. Il existe aussi en PDF à imprimer. Ce guide permet de gérer le site
et de réagir à un problème **sans Claude, sans IA et sans connaissances en informatique**.*

> [!TIP]
> **L'essentiel à retenir** : le site t'appartient entièrement, et tout est rangé dans **tes
> propres comptes**. Le contenu se gère depuis le **tableau de bord**. Si une mise à jour
> casse quelque chose, on revient à la version d'avant **en 3 clics** dans Vercel
> (partie 3). Les photos et la base de données sont **sauvegardées automatiquement**.

## 1. Au quotidien : le tableau de bord

Adresse : **www.maitreakessemodelmanagement.com/tableau-de-bord.html**. On se connecte avec
son e-mail et son mot de passe, puis le code de validation.

Tout le contenu du site se gère depuis cette page, sans code et sans IA :

- les mannequins (fiches, photos, publication sur le site) et les candidatures ;
- les actualités, les événements, l'agenda et les partenaires ;
- la vidéo de la page d'accueil, le mot du responsable et la boutique ;
- le journal des erreurs, qui montre si quelque chose ne marche pas chez les visiteurs.

## 2. Les comptes du site (tout est à toi)

| Compte | Ce qu'il contient | Adresse de connexion |
|---|---|---|
| **Vercel** | L'hébergement des pages. Permet de revenir à une ancienne version. | vercel.com |
| **GitHub** | Le code du site et son mode d'emploi technique. La sauvegarde de la base, chaque semaine. | github.com/MA2M2026/site-maitre-akesse |
| **Supabase** | La base de données : mannequins, candidatures, actualités, comptes. | supabase.com |
| **Cloudflare** | Les photos et la vidéo (stockage « R2 ») et l'aiguillage de l'adresse du site. | dash.cloudflare.com |
| **Spaceship** | Le nom de domaine maitreakessemodelmanagement.com. | spaceship.com |
| **Google** | Les sauvegardes des photos (Drive), les photos des candidatures, les e-mails. | drive.google.com |
| **EmailJS / Resend** | L'envoi des e-mails automatiques du site. | emailjs.com / resend.com |

> [!CAUTION]
> **Trois précautions vitales**
> 1. Note l'e-mail de connexion de chaque compte dans un carnet gardé **hors ligne**. Ne mets
>    jamais de mot de passe ni de clé secrète dans une conversation avec une IA, ni par WhatsApp.
> 2. Active la **double vérification** (code par SMS ou par une application) sur chaque compte,
>    et garde ses **codes de récupération** imprimés.
> 3. Active le **renouvellement automatique du nom de domaine chez Spaceship**, et vérifie que
>    la carte bancaire est à jour. **Si le domaine expire, le site disparaît d'internet.**

## 3. Le site est cassé après une mise à jour : revenir en arrière

Vercel garde **toutes les anciennes versions** du site. Revenir en arrière ne touche ni au
code, ni à la base de données, ni aux photos.

1. Va sur **vercel.com** et connecte-toi.
2. Ouvre le projet **site-maitre-akesse-kiw2**.
3. Clique sur l'onglet **Deployments**. Les versions s'affichent, la plus récente en haut.
   Celle qui est en ligne porte l'étiquette « Current » ou « Production ».
4. Repère la dernière version **d'avant le problème** (regarde la date et l'heure).
5. Clique sur les trois points **…** à droite de cette version, puis sur **Promote to
   Production** (ou **Instant Rollback**), et confirme.
6. Attends une minute, puis ouvre le site pour vérifier. Recharge bien la page, ou ouvre-la
   en navigation privée.

Les changements faits depuis le tableau de bord (photos, mannequins, actualités) ne sont pas
annulés : ils sont rangés dans la base de données, pas dans la version du site.

## 4. Quelque chose ne marche pas : que vérifier ?

| Ce que tu constates | Ce qu'il faut faire |
|---|---|
| **Le site ne s'ouvre plus du tout** | 1) Essaie sur un autre appareil et en 4G. 2) Vérifie chez Spaceship que le domaine n'a pas expiré. 3) Regarde si Vercel est en panne : vercel-status.com. 4) Si une mise à jour vient d'être faite : retour en arrière (partie 3). |
| **Les photos ou la vidéo ne s'affichent plus** | Le site repasse tout seul par un chemin de secours. Si le problème dure, regarde si Cloudflare est en panne : cloudflarestatus.com. Les photos restent en sécurité chez Cloudflare et sur ton Google Drive. |
| **Les mannequins, les actualités ou la connexion ne marchent plus** | Regarde status.supabase.com, puis connecte-toi à supabase.com. Si le projet est indiqué « Paused » (en pause), clique sur **Restore** pour le rétablir. |
| **Les e-mails automatiques ne partent plus** | Connecte-toi à EmailJS et à Resend, et vérifie que le quota du mois n'est pas épuisé. |
| **Message « quota dépassé » chez Vercel** | Ouvre Vercel → ton projet → **Usage**. Le compteur repart à zéro chaque mois. Les photos et la vidéo passent déjà par Cloudflare, qui ne limite pas ce trafic. |

## 5. Les sauvegardes : où sont-elles ?

| Quoi | Quand | Où la retrouver |
|---|---|---|
| **Photos des mannequins** | Toutes les heures, automatiquement | Google Drive, dossier « Sauvegarde photos MA2M », avec un sous-dossier par mannequin. Le fichier « _dernier-passage.txt » donne la date du dernier passage. Rien n'y est jamais effacé. |
| **Base de données** | Chaque dimanche à 3 h (GMT) | GitHub → le dépôt → onglet **Actions** → « Sauvegarde de la base (chaque semaine) ». Chaque sauvegarde est gardée 90 jours et **chiffrée avec ta phrase secrète**. Garde cette phrase précieusement : sans elle, la sauvegarde est illisible. |
| **Le code du site** | À chaque changement | GitHub garde toutes les versions du code depuis le début. |

## 6. Confier le site à une autre personne ou à une autre IA

**Une personne (développeur web)**

1. Sur github.com, ouvre le dépôt **site-maitre-akesse**, puis **Settings** → **Collaborators** →
   **Add people**, et saisis son nom d'utilisateur GitHub.
2. Elle doit lire d'abord **README.md**, **CLAUDE.md** (tes règles), **SECURITY.md** et
   **README-TECHNIQUE.md**.
3. Si elle doit aussi gérer l'hébergement, invite-la dans Vercel (**Settings** → **Members**).
   Quand le travail est fini, **retire ses accès**.

**Une autre IA qui « n'arrive pas à écrire sur GitHub »**

Le dépôt n'a aucun blocage de son côté. Si une IA dit qu'elle ne peut pas écrire, c'est qu'elle
n'a reçu que le droit de **lire**. Beaucoup d'assistants se branchent sur GitHub en « lecture
seule » par défaut, et certains ne savent pas écrire du tout. Pour lui permettre d'écrire :

1. Dans l'IA, ouvre ses réglages de connexion à GitHub (souvent « Connecteurs » ou
   « Intégrations ») et reconnecte GitHub.
2. GitHub demande quels dépôts autoriser : choisis **site-maitre-akesse** et accepte les droits
   **« Read and write »** (lecture et écriture).
3. Pour vérifier ou modifier ces droits plus tard, sur github.com : ta photo en haut à droite →
   **Settings** → **Applications** → l'application de l'IA → **Configure**.

Tout ce qui arrive sur la branche principale (« main ») est mis en ligne automatiquement.
Demande toujours à l'IA de travailler sur une branche à part, de tester, puis de te montrer
le résultat avant la mise en ligne.

> [!IMPORTANT]
> **Les clés secrètes** du site (base de données, stockage des photos, e-mails) ne sont pas
> dans le code. Elles sont rangées dans Vercel → ton projet → **Settings** → **Environment
> Variables**. Personne n'a besoin de te les demander par message : quelqu'un à qui tu donnes
> accès à Vercel peut les utiliser sans les voir.
