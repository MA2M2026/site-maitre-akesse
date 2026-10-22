## Espace 1 admin: inventory of every rubric, for the native rebuild

All paths are relative to `/home/user/site-maitre-akesse`. "tdb.html" means `tableau-de-bord.html` and "tdb.js" means `js/tableau-de-bord.js`.

---

## 0. How it is wired today

**The frame (`js/portail/espace-site.js`)**
- `MENU` is at lines 13-51.
- The iframe URL is `'/tableau-de-bord.html?cadre=1#<key>'`. The three page rubrics use `/actualites.html?cadre=1`, `/evenements.html?cadre=1` and `/partenaires.html?cadre=1`.
- Switching between two tdb rubrics does not reload the iframe. It calls `cadre.contentWindow.ma2mOuvrirPage(cle)` (lines 55-63; the function is defined in `js/tableau-v2.js:215`).
- "Chargement…" stays on screen while `#tdb-verif-msg` exists, up to 9 s (lines 66-77).
- A refusal is passed through `sessionStorage.ma2m_espace1_refuse`, with the value `'ouverture'` or `'droits'` (lines 80-90).

**Navigation inside tdb.html, three layers**
1. **Inline menu script** (tdb.html:2208-2310): `tdbAfficherSection(cle)` toggles the `.tdb-actif` class on every `[data-section]`. It also handles the URL hash and `window.tdbRestaurerOuAccueil`.
2. **`js/tableau-v2.js`** (`construire`, line 470) builds the white "v2" layout:
   - its own `MENU` (lines 61-120);
   - composite pages `COMPOSEES` (line 129): `v2-ensemble → []` (shows only `#v2-vue`) and `v2-top3 → ['b1-top3','b1-classement']`;
   - `ouvrir()` (line 160) and `rendrePage()` (line 172). `rendrePage` auto-opens the collapsed `<details>` for `b3b-acces-bloques`, `b2-tri-photos`, `b2-fiches-evenement` and `b2-rapport-profils`;
   - `allerVers(id)` (line 199, exposed as `window.ma2mAllerVers`);
   - notification deep link `ouvrirDepuisNotification()` (line 218), for `?notif=candidature|recruteur|contact|blocage&id=…`;
   - global search `rechercher()` (line 424): `ilike` on `model_profiles.full_name`, `casting_applications.full_name`, `inscriptions_mannequins.full_name` and `casting_projets.nom` (limit 4 or 3). Clicking a result opens the record with `ouvrirFicheDossier`.
3. **`css/mode-administration.css:50-59`**: under `.cadre-admin`, it hides the old menu, `#v2-cote`, `#v2-blocs`, `.adm-barre` and the header.

**Data loading at login**
- `js/connexion-tableau.js:92 reveleTableauDeBord()` calls:
  - `chargerStatistiques()` (tdb.js:1026), which itself fires nearly every loader at lines 1074-1102;
  - `chargerStatutCodeValidation()`;
  - `tdbRestaurerOuAccueil()`;
  - `ma2mNotificationsApresConnexion()`;
  - `rattraperPhotosEnArrierePlan()` after 8 s (tdb.js:583).
- Admin check: `verifierAdminTableau()` (connexion-tableau.js:16) reads `admins.user_id = auth.uid()`.

**Global background behaviours to keep**
- **Photo backfill** (tdb.js:577-628): reads every `model_photos`, rebuilds a missing 800 px thumbnail (`-n800`), a missing 1400 px medium version, or a missing WebP copy. It uses `envoyerVersionPhoto`, then `update ... .eq('id').eq('url')`. Limits: 40 photos per opening, stop after 5 failures, skipped on mobile data, runs once per session (`sessionStorage ma2m_rattrapage_photos`). Downloads go through the relay `/book-photos/` (`RELAIS_PHOTOS`).
- **Push notifications** (inline tdb.html:3330-3440):
  - service worker `/service-worker.js`, VAPID public key;
  - writes `push_abonnements.upsert({user_id, endpoint, p256dh, auth, appareil, actif:true}, onConflict 'endpoint')`;
  - a `#notif-banniere` banner offers activation ("Oui, activer" / "Plus tard"); "Plus tard" is remembered in `sessionStorage ma2m_notif_banniere_vue`.

---

## 1. Rubric by rubric

### Pilotage

#### v2-ensemble — "Vue d'ensemble"
1. **Where:** `#v2-vue`, created in `tableau-v2.js:562`. It is shown by the CSS rule `body.v2-page-v2-ensemble .v2-vue` (`css/tableau-v2.css:314`). Functions: `chargerVue` (line 310), `rendreVue` (line 360). Data is cached 60 s.
2. **Data:** head counts (`count:'exact', head:true`):
   - `model_profiles`: `published=true`, and the same since the start of the month;
   - `casting_applications`: all, and `status='nouvelle'`;
   - `inscriptions_mannequins`: `statut='en attente de paiement'`;
   - `casting_projets`: `actif=true`; plus the next casting (`nom, date_casting, lieu`, `actif`, `date_casting >= today`, ordered ascending, limit 1);
   - RPC `stats_visites_reelles_site({depuis})` for today and for the last 7 days;
   - `recruiter_requests`: all, and `status='nouvelle'`;
   - `messages_contact`: `created_at >=` Monday of this week;
   - `model_profiles`: `en_attente_validation=true`.
3. **Writes:** none. The 8 cards and the alert lines are buttons that open their rubric (`data-page`).
4. **Helpers:** local `pluriel` and `dateCasting` ("aujourd'hui / demain / weekday").
5. **Behaviours to keep:**
   - When framed (`ADM`), the "Inscriptions à vérifier" card and its alert are removed.
   - Alerts list: profiles to validate, next casting ("penser à envoyer le rappel" → Messages groupés), new applications, unread recruiter requests. If none: "✅ Rien à traiter".
   - The top bar has two shortcuts: "📣 Messages groupés" and "＋ Nouveau casting" (focuses `#nouveau-projet-nom`).
6. **Tests:** `test-administration.js` (`.v2-carte`; checks there is no money wording).

#### b1-a-traiter — "À traiter"
1. **Where:** tdb.html:2353 `.ref-core-pending` (`#a-traiter-liste`, `#a-traiter-total`). Function `chargerATraiter()` at tdb.js:635.
2. **Data:** head counts on `model_profiles` (`en_attente_validation=true`), `casting_applications` (`status='nouvelle'`), `inscriptions_mannequins` (`statut='en attente de paiement'`), `recruiter_requests` (`status='nouvelle'`).
3. **Writes:** none. Each line opens its rubric.
4. **Helpers:** `echapperHtml` (`app.js:78`), `MA2M_ADMINISTRATION.masquee`.
5. **Behaviours to keep:**
   - Only items with a count above 0 are listed; the inscriptions item is dropped when framed.
   - The total text ("N action(s) en attente") is mirrored on `#db-cloche-badge` and `#nav-badge-a-traiter`, and also on the v2 badge `aTraiter`. That badge is parsed from the `#a-traiter-total` text by a MutationObserver (`tableau-v2.js:273, 581`).
   - The bell button opens this rubric (tdb.js:941).
   - It is re-run after validations, status changes and record deletions.
6. **Tests:** none.

#### v2-top3 — "Top 3 et classement"
1. **Where:**
   - `b1-top3`: tdb.html:2325 (`#ma2m-top3-podium`);
   - `b1-classement`: tdb.html:2339 (`#classement-mannequins`).
   - The base function `chargerClassementMannequins` (tdb.js:504) is overridden twice by inline scripts: `#ma2m-final-reference-v2-js` (tdb.html:3059) and `#ma2m-final-reference-v3-js` with `renderTop10V3` (tdb.html:3118-3233). V3 is the one that also fills the podium.
2. **Data:**
   - RPC `stats_classement_mannequins({depuis: now-7d})`, returning `[{model_id, nb_visites}]`;
   - `model_profiles` (`id, full_name`) `.in(ids)`;
   - `model_photos` (`model_id, url_miniature, url, created_at`) `.in(ids)`, ordered ascending; the first photo is used.
3. **Writes:** none.
4. **Helpers:** `echapperHtml`; the `#ma2m-v4-photo-recovery` script (tdb.html:3236): on `img[data-fallback]` error, switch to the original URL.
5. **Behaviours to keep:**
   - Top 10 with bar width as a percentage of the maximum (minimum 4 %).
   - Labels "✦ 1er/2e/3e PRIX".
   - "+N autres mannequins" line.
   - Bar widths are set through `dataset.pct` then `style.width`, to stay CSP-safe; no `innerHTML +=` (tdb.html:3215).
   - Fallback badge "MA2M" when there is no photo.
6. **Tests:** none.

#### b1-repartition — "Répartition des profils"
1. **Where:** the `.ref-distribution[data-section=b1-repartition]` element is injected by the inline `addDistribution()` (tdb.html:3036-3049) and filled by `chargerRepartitionCategories()` (tdb.js:1713).
2. **Data:** `casting_applications` and `inscriptions_mannequins` (`id, full_name, genre, date_naissance, phone`), each limited to 5000.
3. **Writes:** none.
4. **Helpers:** `calculerAge` (tdb.js:1693).
5. **Behaviours to keep:**
   - Under 18 → "Enfants"; otherwise split by `genre` homme/femme.
   - Percentages, with Enfants = 100 − F − H.
   - Donut drawn with `conic-gradient`; total shown in `#rf-total-profils`.
   - Note: it counts applications plus inscriptions, not the published models.
6. **Tests:** none.

#### b1-evolution — "Évolution des candidatures"
1. **Where:** tdb.html:2361 (`#evolution-candidatures`), function `chargerEvolutionCandidatures()` at tdb.js:782.
2. **Data:** `casting_applications.created_at` over the last 42 days, limit 20000.
3. **Writes:** none.
4. **Behaviours to keep:** 6 weekly buckets, hand-drawn SVG polyline ("Sem. 1…6"), empty-state message.
5. **Tests:** none.

### Mannequins

#### b2-mannequins-publies — "Mannequins"
1. **Where:**
   - tdb.html:2427, a `<details id="mannequins-publies-details">` that loads when opened;
   - photo modal `#modal-photos-mannequin` (tdb.html:2901);
   - CV modal `#modal-cv-mannequin` (tdb.html:2915).
   - Functions in tdb.js: `chargerListeMannequinsPublies` (1293), `changerSourdine` (1359), `afficherCvAdmin` (1376), `supprimerMannequin` (1436), `ouvrirPhotosMannequin` and `rafraichirPhotosMannequin` (1463/1476), `supprimerPhotoMannequin` (1528), upload handlers (1546, 1572).
2. **Data:**
   - `model_profiles` (`id, full_name, city, desactive`) `.or('published.eq.true,desactive.eq.true')`, ordered by `full_name`. If the column is missing it falls back to `published=true`.
   - `model_photos` (`model_id, url_miniature, url, principale`).
   - The photo modal reads `model_photos` (`id, url, url_miniature, chemin, chemin_miniature, chemin_moyenne, principale, compcard_ordre, categorie`).
   - The CV reads `model_profiles` (many columns, through `sansChampsPrives`), `model_projects` (`*`), `model_photos` (`*`), `ma2mExperiencesAgence(id)` (from `agenda_projets`) and RPC `profils_prives` (through `completerProfilsPrives`).
   - Storage: Cloudflare R2 through `/api/r2-presigner`.
3. **Writes:**
   - "🔇 Mettre en sourdine" / "🔊 Réactiver": `confirm()`, then RPC `definir_sourdine({p_model, p_desactive})`. The profile disappears from the site and the model's Espace is blocked.
   - "📸 Gérer les photos":
     - "＋ Ajouter une ou plusieurs photos": `envoyerPhotoBook` per file, then `model_photos.insert({model_id, url, chemin, url_miniature, chemin_miniature, url_moyenne, chemin_moyenne, originale_optimisee:true, categorie})`.
     - "⇄" (replace): upload first, then update the row, then `supprimerDeR2` on the three old files. If the database update fails, the new files are deleted again.
     - "✕" (delete): `confirm`, delete the row, then `supprimerDeR2` on `chemin`, `chemin_miniature` and `chemin_moyenne` (the WebP copy goes with them).
     - Compcard select 1-5: `affecterCaseCompcard()`, which frees the box previously holding that number.
     - Book/Lifestyle select: `enregistrerCategoriePhoto()`.
     - Clicking a thumbnail opens `ouvrirGalerieLightbox`.
   - "📄 Voir le CV": downloads through `genererCvFichier('pdf'|'jpeg')`.
   - "🗑 Supprimer": `prompt` that requires typing "SUPPRIMER", then `POST /api/supprimer-mannequin {modelId}` with a Bearer token. The server deletes the `auth.users` account (cascading to profiles, photos, projects and page_views) and the R2 files including WebP copies.
4. **Helpers (`js/app.js`):** `envoyerPhotoBook` (2149: `categoriePhoto` → `convertirSiHeic` → `compresserPhotoOrigine` → `uploaderVersR2`, plus thumbnail and medium versions), `supprimerDeR2` (1741), `affecterCaseCompcard` (1126), `enregistrerCategoriePhoto` (2138), `construireHtmlCv` (224), `genererCvFichier` (1638), `fusionnerExperiences`, `experiencePourCv`, `niveauNormalise`, `ma2mTailleVetements` (`js/tailles.js`), `completerProfilsPrives` and `sansChampsPrives` (1091/1096), `ouvrirGalerieLightbox` (3287), `verrouillerDefilement`.
5. **Behaviours to keep:**
   - Muted profiles stay in the list so they can be reactivated.
   - Order of operations: database first, then files.
   - The `modelId` is captured at upload time, because the modal can be closed during the upload.
   - Count shown as "N publié(s)".
   - The CV uses `photo_cv`, `compcard_ordre` 1-5, and puts the main photo first.
6. **Tests:** `test-admin.js` (mute), `test-photos-webp.js` (backfill and R2 deletion).

#### b2-validations — "Validations en attente"
1. **Where:** tdb.html:2416, `<details id="validation-details">` loaded on open. Functions: `chargerCompteurValidations` (tdb.js:1191) and `chargerListeValidations` (1202); actions at 1245.
2. **Data:**
   - `model_profiles` (`id, full_name, city, category`) with `en_attente_validation=true`, ordered by `created_at` ascending;
   - `profils_prives` RPC (for `date_naissance`);
   - `model_photos` (`model_id, url_miniature, url, created_at`): first 4 photos per model.
3. **Writes:**
   - "Valider et publier": `model_profiles.update({published:true})`.
   - "Refuser": `prompt` for a reason (visible to the model), then `update({en_attente_validation:false, raison_refus})`.
   - Both refresh the list, the counter and À traiter.
4. **Helpers:** `completerProfilsPrives`, `calculerAge`.
5. **Behaviours to keep:**
   - "Mineur — N ans" badge.
   - Count badge "N en attente" or "Aucune", with the `a-traiter` class.
   - Validation does not explicitly set `en_attente_validation=false`; a database trigger presumably does it (not verified).
6. **Tests:** none.

#### b3c-vedette-admin — "Mannequin à la une"
1. **Where:** tdb.html:2741 (`#tb-select-vedette`, `#tb-vedette-actuelle`). Functions: `chargerVedette` (tdb.js:2614), handlers at 2635 and 2650. The dashboard hero `chargerHeroVedette` (951, in `b1-vedette`, which is not in the Espace 1 menu) is refreshed too.
2. **Data:** `model_profiles` (`id, full_name, featured`) with `published=true`, ordered by name. The hero reads `featured=true` plus its first photo.
3. **Writes:**
   - "Définir comme mannequin à la une": `update({featured:false}).eq('featured',true)`, then `update({featured:true}).eq('id')`. These are two separate calls, so the change is not atomic.
   - "Retirer la mise en avant": `update({featured:false}).eq('featured',true)`.
4. **Behaviours to keep:** without a featured model, the homepage shows a random photo; the current choice is shown as text.
5. **Tests:** none.

#### b2-tri-photos — "Photos triées par l'IA" (really "Photos mises de côté")
1. **Where:** tdb.html:2455 `<details id="tri-photos-details">` (`#tri-ecartees`, `#tri-a-verifier`, `#tri-photos-compteur`). Script: `js/photos-mises-de-cote.js` (`charger` at 32, click handler at 60).
2. **Data:** `model_photos` (`id, model_id, numero, url, url_miniature, url_moyenne, chemin, chemin_miniature, chemin_moyenne, tri_statut, created_at`) with `tri_statut in ('ecartee','a_verifier')`, newest first, limit 300; plus `model_profiles` (`id, full_name`) for names.
3. **Writes:**
   - "Remettre" / "Garder": `update({tri_statut:'book', tri_manuel:true, tri_date:now})`.
   - "Supprimer": `confirm`, delete the row, then `supprimerDeR2` on all three paths.
4. **Behaviours to keep:** two groups (hidden photos, photos to check); a thumbnail links to the medium version; counter "N cachée(s) · M à vérifier".
5. **Tests:** none. (`test-tri-photos.js` covers `categoriePhoto`, not this rubric.)

#### b2-rapport-profils — "Rapport des profils"
1. **Where:** tdb.html:2437 `<details id="rapport-profils-details">`. Script: `js/rapport-profils-admin.js` (`chargerInterne` 179, `afficher` 121, `message` 70, `ligneHtml` 94, `marquerEnvoye` 258).
2. **Data:**
   - `model_profiles`: many measurement and identity columns plus `shoulder_cm, arm_cm, neck_cm`, with a retry without them if they are missing; `sans_instagram` read separately; all through `lireToutesLignes`;
   - `completerProfilsPrives`;
   - `model_photos` (`id, model_id, principale, photo_couverture, tri_statut, created_at`);
   - RPC `contacts_mannequins_admin()`, returning `{model_id, phone}`;
   - `model_projects` (`id, model_id`);
   - `contacts_parents` (`model_id, parent_nom, parent_telephone`).
3. **Writes:** no database writes. "💬 Envoyer à X" opens `wa.me/<num>?text=` one person per click. Without a number the message is copied to the clipboard instead. Sends are remembered in `localStorage ma2m_rapport_profils_envois_v2`.
4. **Helpers:** `ma2mAnalyserProfil`, `ma2mPointsParBloc`, `MA2M_PHOTOS_MINIMUM=10` (`js/analyse-profil.js`), `numeroWhatsApp` (`app.js:1115`), `salutationParent` and `estMineurDossier` (`js/messages-candidats.js`), `lireToutesLignes` (`app.js:843`), `MA2M_SITE`.
5. **Behaviours to keep:**
   - Completeness score with ▰ bar; items grouped by block; editable textarea message.
   - Buttons: "Cocher toutes", "Actualiser", "↺ Réinitialiser l'historique" (with confirm).
   - Queue: after a send the profile moves to the "Messages envoyés aujourd'hui" group, plus a "Profils à jour" group.
   - Minor: the WhatsApp goes to the parent with a prefixed text.
   - Photos with `tri_statut='ecartee'` are excluded.
6. **Tests:** none.

#### b2-fiches-evenement — "Fiches événement"
1. **Where:** tdb.html:2446 `<details id="fiches-evenement-details">`. Script: `js/fiches-evenement-admin.js` (`charger` 148, `telecharger` 134, `genererPdf` 27).
2. **Data:**
   - `model_profiles` (`id, full_name, published`) with a non-null name;
   - `fiche_evenement` (`model_id, mis_a_jour, regime_allergies, tiktok, facebook, droit_image`), to flag which ones are filled;
   - on download, RPC `fiche_evenement_admin({id_mannequin})`.
3. **Writes:** none. "⬇ Télécharger la fiche" generates a client-side PDF with jsPDF.
4. **Helpers:** `chargerJsPdf`, `chargerImageLocale`, `MA2M_TELEPHONES`, `MA2M_EMAIL`, `MA2M_SITE`, `MA2M_CONTACT_PDF` (`app.js:819-838`), `ma2mTailles`, `ma2mTailleCourte`, `ma2mTailleVetements` (`js/tailles.js`), `horodatageFichier`.
5. **Behaviours to keep:**
   - Only agency contacts are printed, never the model's own.
   - Measurements are hidden when inconsistent (`aReprendre`).
   - Social links are normalised.
   - Page breaks are handled.
   - Book link is `MA2M_SITE/book/<slug>`.
   - "(non publiée)" tag.
6. **Tests:** none.

### Castings

#### b2-candidatures — "Candidatures casting"
1. **Where:** tdb.html:2528 (`#liste-candidatures`, `#filtres-candidatures`, `#resume-candidatures`, `#candidatures-plus-btn`), plus the shared record modal `#modal-dossier` (tdb.html:2854-2900). The modal is shared by casting, inscription and recruteur.
   - Generic engine in tdb.js: `DOSSIERS` (1612), `ETAT_DOSSIERS`, `PAR_PAGE=12`, `chargerCompteurs` (1658), `afficherDossiers` (1757), click delegation (1808), `ouvrirFicheDossier` (1854, exposed globally), `rafraichirPhotosDossier` (1925), `supprimerPhotoDossier` (1981), `envoyerPhotoVersDrive` (2019), `preparerMessageWhatsApp` and `majMessageWhatsApp` (2157/2146), `afficherPanneauNotification` (2208), status change (2247), delete (2274), `afficherCodeFiche` (2352), `chargerResumeCandidatures` (2604).
2. **Data:**
   - `casting_applications`: `select('*', count)` ordered by `created_at` desc, `.range()` for pages of 12, `status` filter. "Toutes" excludes the side statuses with `.not(status,'in','("en étude","en attente")')`.
   - Counts per status.
   - RPC `resume_candidatures_par_projet`, returning `{type_candidature, projet_nom, total}`.
   - Record photos: `casting_photos` (`id, chemin, url`) `.eq(application_id)`, with signed URLs on bucket `casting-applications` (300 s). Newer photos are Google Drive links in `url`.
   - `codes_inscription` (`code, utilise, utilise_le`) by `candidature_id`.
3. **Writes:**
   - **Status select** `#mf-statut-select`: `update({status})`.
     - For statuses that have a template (en étude, en attente, retenue, refusée) it shows an editable message panel and sends the email automatically (EmailJS) when an address exists (the parent's for a minor).
     - Buttons in the panel: "✉️ Envoyer l'e-mail" (resend), "💬 Envoyer par WhatsApp" (wa.me link).
   - **"💬 Écrire sur WhatsApp"** block:
     - template select: the `MESSAGES_CANDIDATS` catalogue without first messages, plus "✏️ Message libre";
     - date, hour and place fields for appointment templates;
     - "Ouvrir WhatsApp avec ce message";
     - "✉️ Envoyer aussi par e-mail" (blocked if `[date à préciser]` remains).
   - **Photos:** "＋ Ajouter une photo" posts base64 to Google Apps Script `URL_SCRIPT_PHOTOS_CASTING`, then `casting_photos.insert({application_id, url: lienDrive, chemin:null})`. "⇄" goes to Drive, removes the old file from storage, then updates. "✕": `confirm`, delete the row, then `storage.remove`.
   - **"🗑 Supprimer ce dossier":** `confirm`, remove storage files, then `casting_applications.delete()`. The Drive files stay.
   - **Code zone** (status `retenue` only): "La personne veut s'inscrire : créer son code" calls RPC `code_individuel_creer({p_candidature})`; then "Copier" and "💬 Envoyer par WhatsApp".
4. **Helpers:**
   - `js/messages-candidats.js`: `contactsEnvoi` (47), `estMineurDossier` (39), `nomAvecCivilite` (32), `salutationParent` (23), `MESSAGES_CANDIDATS` (188), `messageCandidatParCle`, `texteMessageCandidat`, `typeCandidature`, `personnaliserMessage` (247), `remplirRdv`, `dimancheSuivantISO`, `infosRdvMemorisees` and `memoriserInfosRdv` (`localStorage ma2m_mg_heure/lieu`), `messagePourEmail` (289), `messageCandidat`, `messageParent`.
   - `sansMarquesWhatsApp` (`js/messages-convocations.js:123`).
   - `envoyerEmailCandidat` (`js/emailjs-config.js:24`; service `service_771y6u7`, template `template_q3qpg4p`).
   - `lienWhatsApp` (tdb.js:1704; adds 225 to Ivorian numbers), `fichierEnBase64`, `URL_SCRIPT_PHOTOS_CASTING` (`app.js:2913/2934`), `ouvrirGalerieLightbox`, `calculerAge`.
5. **Behaviours to keep:**
   - Status pills with counts. "Toutes" shows `total − side statuses`; "À part :" holds "À revoir" (stored value `en étude`) and "En attente". Default filter is "nouvelle".
   - "Voir plus" appends the next page.
   - Card meta: type ("Intégrer l'agence", project name, "Casting direct (agence)"), "Débutant·e", city, date.
   - Mineur badge; the WhatsApp button reads "WhatsApp parent ↗".
   - Record field lists `CHAMPS_CASTING` (1831), including parent fields. A Drive video link is shown as "▶ Voir la vidéo".
   - Notification deep link `?notif=candidature&id=`.
   - Opening from v2 search and from "Derniers dossiers".
6. **Tests:** `test-admin.js` (minor → parent, status → retenue with automatic email, WhatsApp convocation, `mf-wa-email`), `test-administration.js` (pills order, side statuses, code creation, minor → parent WhatsApp, record opening), `test-espace1-cadre.js` (opens in the frame without reload).

#### b2-projets — "Projets et castings"
1. **Where:** tdb.html:2395 (`#form-nouveau-projet`, `#liste-projets`). Functions in tdb.js: submit handler 2494, `chargerProjets` 2524, `echangerOrdreProjets` 2555, delegation 2565.
2. **Data:** `casting_projets` (`id, nom, description, actif, created_at, date_casting, lieu, ordre_affichage`), ordered by `ordre_affichage` ascending then `created_at` descending.
3. **Writes:**
   - "+ Ajouter": `insert({nom, description, date_casting, lieu})`.
   - "Désactiver" / "Réactiver": `update({actif})`.
   - "✏️ Description": `prompt`, then update.
   - "📅 Date / lieu": two prompts (AAAA-MM-JJ, then place).
   - "▲ Monter" / "▼ Descendre": swap by list position, then renumber every row's `ordre_affichage` 0..n.
   - "Supprimer": `confirm`, delete. Existing applications keep `projet_nom`.
4. **Behaviours to keep:** active projects feed the public "Postuler à un casting" form, the Vue d'ensemble "Castings actifs" count and the Messages groupés casting list. The order is shared through `window.MA2M_PROJETS_ORDRE`.
5. **Tests:** none directly (`test-visiteur.js` covers the public form's `casting_projets`).

#### b2-messages-groupes — "Messages groupés"
1. **Where:** tdb.html:2626 (all `mg-*` ids). Script: `js/messages-groupes.js` (`remplirStatuts` 117, `chargerCastings` 131, `charger` 152, `afficherListe` 168, `majBoutons` 196, `envoyerEmails` 228, `whatsappSuivant` 257, `copierNumeros` 270). It depends on the global `DOSSIERS` from tdb.js, so `demarrer()` polls every 300 ms until it exists (line 290).
2. **Data:**
   - `casting_projets.nom` plus distinct `casting_applications.projet_nom` (`type_candidature='projet'`, limit 5000) to fill the casting list.
   - Recipients through `lireToutesLignes`:
     - `casting_applications` (`id, full_name, email, phone, status, type_candidature, projet_nom, created_at, date_naissance, genre, civilite, parent_nom, parent_telephone, parent_email`) filtered by status and by `type_candidature='agence'`, or by `'projet'` plus `projet_nom`;
     - or `inscriptions_mannequins` (similar columns, `statut`).
3. **Writes:** no database writes.
   - "📧 Envoyer par e-mail à N": `confirm`, then sequential EmailJS sends with a 1.1 s pause. Failed sends are listed and can be retried.
   - "💬 Ouvrir WhatsApp pour X": `window.open(wa.me)`, one person per click.
   - "📋 Copier tous les numéros".
   - "Tout cocher / tout décocher".
   - Sends are remembered in `localStorage ma2m_mg_email_<hash>` / `ma2m_mg_wa_<hash>`; the hash covers the message, the parent version and the date/hour/place.
4. **Helpers:** `MESSAGES_CANDIDATS`, `contactsEnvoi`, `personnaliserMessage`, `remplirRdv`, `salutationParent`, `nomAvecCivilite`, `messagePourEmail`, `infosRdvMemorisees`, `memoriserInfosRdv`, `envoyerEmailCandidat`, `numeroWhatsApp`, `lireToutesLignes`.
5. **Behaviours to keep:**
   - "Qui ?" offers agence / casting / inscription. Note: the inscriptions source is still offered even though `b2-inscriptions` is hidden in Espace 1.
   - Only statuses with a follow-up message are offered; refusée and annulée are excluded.
   - "Quel message ?" auto-fills the template, and asks before overwriting edits.
   - Separate "Version pour les parents (mineurs)" textarea.
   - Date/hour/place fields appear only when the text contains `{date|heure|lieu}`. Sending is blocked while "[à compléter]" remains.
   - Live preview for the first recipient; summary of how many have email or WhatsApp.
6. **Tests:** `test-admin.js` (`mg-charger`, `mg-wa-suivant`).

#### b2-convocations — "Convocations"
1. **Where:** tdb.html:2538-2625. The form `#cv-form` (beware: `cv-*` ids also exist for the old validation code, e.g. `cv-msg`, `cv-email-recuperation`) and the panel `#convoc-panneau`.
   - Scripts:
     - `js/convocations-page.js`: `charger` 73, submit 94, `projetsConvoques` 158, `afficherReponses` 175, `window.convoquerProjet` 206;
     - `js/convocations-admin.js`: `personnesMannequin` 44, `dessinerParticipants` 68, `retirer` 110, `dessinerApercu` 140, `window.dessinerReponsesConvocation` 158, relaunch 220-265, `dessinerSuivi` 267, `changerStatut` 322, `envoyerEmails` 333, `programmer` 369, `window.ouvrirConvocations` 442;
     - `js/agenda-outils.js` (`ajouterEtapeDeroule`, `lireDeroule`, `afficherMessageFormulaire`);
     - `js/messages-convocations.js` (`messageConvocation`, `heureRappel`, `dateLongue`, `sansMarquesWhatsApp`, `LIEN_CONFIRMER`; also used by the server).
2. **Data:**
   - Activation probe: `convocation_envois.select('id').limit(1)`. If missing, `#cv-inactif` is shown and the form disabled.
   - `agenda_projets` (`*`); `model_profiles` (`id, full_name, published`).
   - `convocation_participants` (`*`) and `convocation_envois` (`*`) by `projet_id`.
   - `contacts_externes` (`*`), the address book.
   - RPC `convocation_contacts_mannequins({p_ids})`, returning phone, `contact_email`, `date_naissance` and parent contacts (admins only).
   - Responses view: `convocation_envois` (`projet_id`, `sorte='convocation'`, `statut != 'annule'`).
3. **Writes:**
   - **"Enregistrer et passer à l'envoi":** `agenda_projets.insert` or `update` with `type, titre, date_debut, date_fin, lieu, ville, adresse, heure_evenement, heure_convocation, deroule[], a_prevoir, rappel_veille, rappel_heure, message_modele, visible, mannequin_ids`. Past dates are refused.
   - **"＋ Ajouter une personne non inscrite":** `contacts_externes.insert({civilite, nom, telephone, email})`.
   - **"Retirer":** `confirm`, then `convocation_participants.delete` (which cancels the scheduled sends).
   - **"Programmer l'envoi":**
     1. `convocation_participants` insert or update; the returned `jeton` is the personal confirmation link.
     2. `convocation_envois.upsert(onConflict 'participant_id,sorte,canal')`, one row per channel × (convocation, plus the evening-before reminder if enabled).
     3. If "Maintenant": emails are sent immediately via EmailJS, and each result is written back with 3 retries. Otherwise the server cron sends them (`api/portail.js?tache=convocations`, woken by `pg_cron`).
   - **Tracking:** "Ouvrir WhatsApp" / "💬 Envoyer le WhatsApp suivant" sets the send to `envoye`; "Annuler" sets `annule`; "Réessayer" resends a failed email.
   - **Relaunch:** "💬 Relancer la suivante" (wa.me with the confirmation link), remembered in `sessionStorage ma2m_relances_<projet>`.
   - "Partir du message type" (confirm before overwriting); "📋 Voir les réponses" (read-only).
4. **Helpers:** `contactsEnvoi`, `nomAvecCivilite`, `numeroWhatsApp`, `envoyerEmailCandidat`, `lireToutesLignes`, `dateDuJour`, `MA2M_TYPES_AGENDA`, `libelleTypeAgenda`.
5. **Behaviours to keep:**
   - Only upcoming projects are offered.
   - A minor appears twice: once for the model (if they have their own contact) and once for the parent.
   - Already-convoked people are pre-unchecked.
   - Per-recipient preview selector.
   - Channels: email (automatic), WhatsApp (prepared), SMS (disabled).
   - When: now, 30/40/60/120/180 min, or a precise date, in Abidjan time = UTC.
   - The reminder is skipped if it falls before the send time.
   - Responses grouped ✅ confirmé / ❌ absent / ⏳ sans réponse.
   - The Agenda's "📨 Convoquer" button calls `convoquerProjet(id)`, which clicks the old menu item `b2-convocations`.
6. **Tests:** `test-convocations.js` (full flow), `test-convocations-serveur.js` (server side).

### Relations

#### b2-recruteurs — "Demandes recruteurs"
1. **Where:** tdb.html:2660 plus the shared `#modal-dossier`, using `DOSSIERS.recruteur` (tdb.js:1638).
2. **Data:**
   - `recruiter_requests` (`*`, statuses `nouvelle` / `vue` / `traitée`, default filter `nouvelle`, 12 per page);
   - fields `CHAMPS_RECRUTEUR` (1845);
   - selected models `recruiter_request_models` (`id, model_id, model_name_snapshot, model_height_snapshot`) by `request_id` (tdb.js:1957).
3. **Writes:**
   - Status select: `update({status})`. There is no notification template for recruiters.
   - "✕" on a selected model: `confirm`, then `recruiter_request_models.delete`.
   - "🗑 Supprimer ce dossier": `confirm`, delete.
   - WhatsApp block with "🤝 Remerciement de la demande" and "Message libre", sent to `whatsapp || phone`. The email button is hidden for recruiters.
4. **Behaviours to keep:** card name `contact_name || company`; meta `project_type · date`; deep link `?notif=recruteur&id=`.
5. **Tests:** none in the dashboard (`test-contact-recruteur.js` covers the public form).

#### b2-contacts — "Messages de contact"
1. **Where:** tdb.html:2409 `#table-contacts`, filled at the end of `chargerStatistiques` (tdb.js:1091-1097).
2. **Data:** `messages_contact` (`nom, type_contact, telephone, created_at`), last 10.
3. **Writes:** none. "WhatsApp ↗" is a `lienWhatsApp` link.
4. **Behaviours to keep:** read-only. There is no message body, no pagination, and no delete.
5. **Tests:** none (public side: `test-contact-recruteur.js`).

### Contenu du site

#### actualites — "Actualités" (`actualites.html?cadre=1`)
1. **Where:** a whole page. `#admin-bloc` and `#news-modal-admin-actions` are revealed by `verifierAdmin()` (`app.js:306`), which checks the `admins` table and sets `window.estAdminConnecte`.
   - Scripts:
     - `js/publications.js`: `brancherRedaction` 67, `ouvrirRedactionPublication` 90, `enregistrerPublication` 114, `brancherFicheLecture` 144, `envoyerPhotosPublication` 166, `enregistrerPhotosPublication` 183, `supprimerPublication` 196;
     - `js/actualites.js`: `PUBLICATION` constant, `chargerActualites` 59, `ouvrirActuModal` 133, `ouvrirRedaction` 169, save 196;
     - `js/mode-administration.js`.
2. **Data:**
   - `actualites` (`*`), newest first;
   - `actualite_photos` (`actualite_id`) for photo counts, and (`url`) per item;
   - images on R2 through `/api/r2-site-images`, category `actualites`;
   - legacy Supabase bucket `actualites-images`.
3. **Writes:**
   - "Rédiger" / "Publier":
     - photos (HEIC converted) go to `site/actualites/<id>/<ts>-<name>` via `envoyerImageSite`;
     - then `actualites.insert({id, titre, categorie, commentaire (Quill rich text), video_url, image_url: first photo})`;
     - then `actualite_photos.insert` per photo.
   - "Enregistrer" (edit): update, photos are added, and the first one becomes the cover if there was none.
   - "Supprimer" (from the editor or the reader modal): `confirm`, delete the row, then `supprimerCheminsImagesSite` (R2 or legacy bucket).
   - "Déconnexion": `signOut`.
4. **Helpers:** `creerEditeurRiche`, `chargerContenuDansEditeur`, `lireContenuEditeur`, `rendreContenuRiche` (DOMPurify), `texteBrutDepuis`, `urlLegere`, `urlHttpSure`, `convertirSiHeic` (`js/conversion-heic.js:42`), `nomFichierSur`, `envoyerImageSite` (`app.js:2185`), `supprimerCheminsImagesSite` (2239), `ouvrirGalerieLightbox`, `T` / `EN`. Uses the `sbAdmin` client (`supabase-config.js:53`).
5. **Behaviours to keep:**
   - Categories: Casting, Mannequinat, Conseils, Événements, with filter pills.
   - The newest item gets the "À la une" block.
   - YouTube and Vimeo embeds.
   - A new item needs at least one image or a video.
   - Live preview in the editor.
   - Deep link `?actu=ID`.
   - Bilingual (FR and EN pages).
6. **Tests:** `test-publications.js`, plus public tests (`test-pages-publiques.js`, `test-texte-articles.js`, `test-photos-*`, `test-middleware-apercus.mjs`, …).

#### evenements — "Événements" (`evenements.html?cadre=1`)
1. **Where:** same mechanism; `js/evenements.js` with `PUBLICATION` for `evenements` / `evenement_photos` / `evenement_id`, bucket `evenements-images`.
2. **Data:** `evenements` (`*`) ordered by `date_evenement` desc (nulls last) then `created_at`; `evenement_photos`.
3. **Writes:** same as Actualités, with fields `{titre, date_evenement, lieu, description}`. The title is required, and a new event needs at least one photo.
4. **Behaviours to keep:** midday parsing of the date to avoid off-by-one days; deep link `?evenement=ID`.
5. **Tests:** `test-publications.js` plus public tests.

#### partenaires — "Partenaires" (`partenaires.html?cadre=1`)
1. **Where:** `js/partenaires.js`. Add form `#admin-publier` (`p-*` ids); edit and delete inside the modal `#part-modal-edition` (`edit-p-*` ids).
2. **Data:** `partenaires` (`*`), newest first. Logos on R2 under `site/partenaires/<id>/…`; legacy bucket `partenaires-logos`.
3. **Writes:**
   - "Ajouter ce partenaire": `insert({id, nom, structure, evenement, role, description, logo_url, logo_chemin})`.
   - "Enregistrer" in the modal: update, with an optional new logo. The old logo is not deleted.
   - "Supprimer": `confirm`, delete, then `supprimerCheminsImagesSite`.
   - Partners can also be created from the Agenda (`partenaires.insert({nom})`).
4. **Behaviours to keep:** roles DA, Styliste, Directeur de casting, Promoteur, Organisateur, Régisseur, Autre; letter placeholder when there is no logo; deep link `?partenaire=ID`. When framed, the v2 menu adds the "Gérer les partenaires" link (`tableau-v2.js:126`).
5. **Tests:** `test-espace1-cadre.js` (opens framed without a double bar), `test-administration.js`, plus public tests.

#### b3c-mot-fondateur — "Mot du fondateur"
1. **Where:** tdb.html:2752 (`mr-*` ids). Functions: `chargerMotResponsableTableau` (tdb.js:2660), photo handler 2690, text handler 2730.
2. **Data:** `mot_responsable` (`*`) with `id='principal'`. Photo on R2, category `responsable`.
3. **Writes:**
   - "Enregistrer la photo": HEIC goes through `heic2any`; JPEG/PNG/WebP over 1.5 MB is resized with `reduireEnJpeg` (2400 px, quality 0.88); 10 MB maximum; path `site/responsable/<ts>-<rand>-<name>`; then `update({photo_url, updated_at})`. The old photo is not deleted.
   - "Enregistrer le mot du fondateur": `update({nom, titre, message, updated_at})`.
4. **Helpers:** `envoyerImageSite`, `suffixeAleatoire`, `nomFichierSur`, `reduireEnJpeg` (`app.js:2926`), `heic2any` (`conversion-heic.js`).
5. **Behaviours to keep:** the photo is also used as the admin avatar in the top bar.
6. **Tests:** none for the admin side (public tests read `mot_responsable`).

#### b3c-agenda — "Agenda du site"
1. **Where:** tdb.html:2769-2830 (`agenda-*` ids). Script: `js/agenda-admin.js` (`chargerChoix` 96, `chargerProjets` 177, `ligneProjet` 139, `remplirFormulaire` 230, submit 282, add-partner 365, list actions 407; loads lazily through a MutationObserver on `.tdb-actif`, line 429), plus `js/agenda-outils.js`.
2. **Data:**
   - `agenda_projets` (`*`) ordered by `date_debut`;
   - `model_profiles` (`id, full_name, published`) through `lireToutesLignes`;
   - `partenaires` (`id, nom`);
   - `convocation_envois` probe (enables the "Convoquer" button).
3. **Writes:**
   - "Ajouter à l'agenda" / "Enregistrer": insert or update with `type, titre, date_debut, date_fin, ville, lieu, pays, annule, description, intervenants[{role,nom}], seances[{jour,debut,fin}], horaires_publics, heure, adresse, notes_internes, visible, mannequin_ids, partenaire_ids`, and optionally `mannequins_libres[]` and `partenaires_libres[]`. It uses `.select('id')` to detect a silent no-op (expired session).
   - "＋ Enregistrer ce partenaire": `partenaires.insert`, with a duplicate check.
   - "Modifier" fills the form, shows a "currently editing" banner and highlights the row.
   - "Supprimer": `confirm`, delete.
   - "📨 Convoquer": `convoquerProjet`.
4. **Helpers (`app.js`):** `MA2M_TYPES_AGENDA` (856), `MA2M_ROLES_INTERVENANTS` (869), `libelleTypeAgenda` (871), `dateAgenda` (989), `dateDuJour` (1019), `separerAgenda` (1022), `lireToutesLignes`; plus `caseACocher`, `ligneDeuxChamps` and `afficherMessageFormulaire` from `agenda-outils.js`.
5. **Behaviours to keep:**
   - One time row per day, up to 60 days; typed times are kept when the dates change.
   - Model search filter and count.
   - Saving is blocked if the model or partner lists failed to load.
   - IDs of unknown models or partners are preserved on save (`idsGardes`).
   - A typed "other partner" that is already a partner gets ticked instead.
   - Two lists: "À venir" and "Réalisés".
   - Private fields (address, notes, non-public times) shown with 🔒.
   - Clear error messages when a database extension (124/136/137/138) is missing.
6. **Tests:** `test-admin.js` (country, cancelled, other models and partners, Modifier banner), `test-convocations.js`.

#### b3d-video-accueil — "Vidéo de l'accueil"
1. **Where:** tdb.html:2831 (`va-*` ids). Script: `js/couverture-admin.js`, zone `{prefixe:'va', cle:'video_accueil', categorie:'video-accueil', son:true, dureeMax:600, tousFormats:true}` (`brancherZone` at 27). The "couv" zone in the same file is dead code.
2. **Data:**
   - `reglages_site.valeur` where `cle='video_accueil'`, shaped `{type:'video'|'aucune', chemin, taille, maj, largeur, hauteur}`;
   - the file goes to R2 at `site/video-accueil/<ts>.mp4|webm` via `envoyerImageSite`, with an upload progress bar;
   - preview from `/book-photos/<chemin>`.
3. **Writes:**
   - "2. Mettre cette vidéo sur l'accueil": compress, upload, `reglages_site.upsert({cle, valeur, maj})`, then `supprimerImageSite` on the old file, and remove `sessionStorage ma2m_video_accueil`.
   - "Retirer la vidéo": `confirm`, upsert `{type:'aucune'}`, then delete the file.
4. **Helpers:** Mediabunny loaded lazily (`js/vendor/mediabunny-1.61.0.min.js`), `envoyerImageSite` with a progress callback, `supprimerImageSite`, `window.signalerErreur` (`js/surveillance.js:134`) for diagnostics.
5. **Behaviours to keep:**
   - Compression with WebCodecs: longest side ≤ 1280, 2.5 Mbit/s (1.5 Mbit/s above 90 s), 30 fps, AAC or Opus audio. Fallback: copy without re-encoding, then a canvas MediaRecorder.
   - Original sent as-is if it is MP4/H.264, ≤ 1920 px, ≤ 4 Mbit/s.
   - Maximum 10 minutes and 250 MB.
   - Warning below 854 px; vertical videos allowed; note when the sound was lost.
   - "Keep page open" progress messages.
6. **Tests:** `test-video-accueil.js` (public rendering of `reglages_site.video_accueil`).

#### b3c-instagram — "Flux Instagram"
1. **Where:** tdb.html:2722 (`instagram-*` ids). Functions: `chargerConfigInstagram` (tdb.js:1106), handlers 1132 and 1149.
2. **Data:**
   - `instagram_config` (`access_token, ig_user_id, token_expire_le`) with `id='principal'`;
   - external call `https://graph.facebook.com/v21.0/{ig_user_id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=8`. The token is used client-side.
3. **Writes:**
   - "Enregistrer": `instagram_config.upsert({id:'principal', access_token, ig_user_id, token_expire_le: now+60 days, updated_at})`.
   - "Rafraîchir les publications": fetch from Graph, then `instagram_posts_cache.upsert({id:'principal', posts:[{id, image, lien, legende≤140}], updated_at})`. Videos use `thumbnail_url`.
4. **Behaviours to keep:** expiry status: expired, ≤ 10 days (warning), otherwise "expire dans N jours".
5. **Tests:** none.

### Accès et outils

#### b3b-codes-inscription — "Codes d'accès"
1. **Where:** tdb.html:2669-2697. Functions in tdb.js: `#form-casting-direct` submit (2323), `lienWhatsAppCode` (2313), `chargerCodes` and `carteCode` (2484/2475), `brancherCopieCode` (2391), the `noteIntegration` IIFE (2749-2799).
2. **Data:**
   - `codes_inscription` (`code, utilise, utilise_le, created_at, candidature:casting_applications(full_name)`), limit 200;
   - note d'intégration: `POST /api/r2-site-images {action:'lire', categorie:'note-integration'}`, returning `{chemin, date}`; viewed at `PHOTOS_DIRECTES + chemin` (`https://photos.maitreakessemodelmanagement.com/`).
3. **Writes:**
   - "Créer la fiche et son code" (Casting direct: name, WhatsApp phone, gender, birth date): RPC `casting_direct_creer({p_nom, p_telephone, p_genre, p_naissance})`, which returns `{code}` and creates a `casting_applications` row with status Retenue, type `direct`. Then shows the code with "Copier" and "💬 Envoyer par WhatsApp" (parent for a minor).
   - "Déposer ce document" (PDF only, ≤ 15 MB): `envoyerImageSite('note-integration', 'prive/note-integration/<32hex>.pdf')`, then `actionImageSite({action:'nettoyer', categorie, chemin})` to remove older versions.
4. **Helpers:** `contactsEnvoi`, `messageParent`, `messageCandidat`, `personnaliserMessage`, `lienWhatsApp`, `envoyerImageSite`, `actionImageSite` (`app.js:2217`), `PHOTOS_DIRECTES`; `LIEN_INSCRIPTION` = `https://www.maitreakessemodelmanagement.com/inscription-mannequin.html`.
5. **Behaviours to keep:**
   - "Disponible" and "Utilisé" lists, with a collapsed "Anciens codes déjà utilisés (N)".
   - Codes without a name show "Ancien code sans nom".
   - The note state is re-read each time the rubric opens.
   - Per-record codes are created in `b2-candidatures`.
6. **Tests:** `test-administration.js` (casting direct, code per person), `test-note-integration.js`.

#### b3b-acces-bloques — "Accès bloqués"
1. **Where:** tdb.html:2500 (`<details>`, `#blocages-liste`, `#blocages-ip-blanche`, `#blocages-liste-blanche`). Inline IIFE `accesBloques` (tdb.html:3443-3509); it loads on `details` toggle, and tableau-v2 auto-opens it.
2. **Data:** `GET /api/connexion-admin` (Bearer token), returning `{ipBloquees[{ip, espace, bloque_jusqua}], comptesBloques[{identifiant, espace, bloque_jusqua}], listeBlanche[{ip, note, ajoute_le}]}`. Server-side tables: `connexion_tentatives_ip`, `connexion_tentatives_compte`, `connexion_liste_blanche`; no RLS policy, service key only.
3. **Writes:** `POST /api/connexion-admin` with:
   - "Débloquer": `{action:'debloquer_ip', ip, espace}` or `{action:'debloquer_compte', identifiant, espace}`;
   - "Ajouter à la liste blanche": `{action:'liste_blanche_ajouter', ip}`;
   - "Retirer": `{action:'liste_blanche_retirer', ip}`.
   - No confirmations.
4. **Behaviours to keep:** `ESPACE_LABELS` mapping (admin, admin-code, mannequin, inscription-code, portail-code, `*`); end time shown as HH:MM; deep link `?notif=blocage`.
5. **Tests:** none.

#### b3a-drive — "Drive et transferts"
1. **Where:** tdb.html:2469 `#drive-grille`, `chargerDriveBloc()` at tdb.js:761.
2. **Data:** head counts of `model_photos` and `model_profiles` (`published=true`).
3. **Writes:** none. The Drive pending and error lines are hard-coded as "—", with an honesty warning text.
4. **Tests:** none.

#### b3a-nettoyage — "Nettoyage des photos" (two blocks share the key)
1. **Where:** tdb.html:2477 (`#nettoyer-photos-btn`, handler at tdb.js:544) and tdb.html:2483 (`#nettoyage-supabase-btn`, `js/nettoyage-supabase.js`: `nettoyer` 115, `deplacerVersR2` 66, `listerTout` 96).
2. **Data:**
   - Block 1: RPC `nettoyer_photos_traitees_anciennes()` (`supabase-extension.sql:2736`, also run nightly by `pg_cron`). It deletes `casting_photos` and `inscriptions_photos` references for records processed more than 5 days ago and returns a count.
   - Block 2: `sb.storage.list` on buckets `actualites-images`, `evenements-images`, `partenaires-logos`, `casting-applications`, `inscriptions-photos`; reads `actualites`, `actualite_photos`, `contenu_a_la_une`, `evenements`, `evenement_photos`, `partenaires`, `mot_responsable`, `casting_applications`, `casting_photos`, `inscriptions_mannequins`, `inscriptions_photos` (`*`, all rows).
3. **Writes:**
   - "Lancer le nettoyage maintenant": the RPC; reports "N photo(s) retirée(s)…".
   - "Vérifier et nettoyer": `confirm` showing the total. Site images still referenced are downloaded, copied to R2 via `envoyerImageSite`, and the referencing rows are updated with the new URL. Unreferenced files are removed with `storage.remove` in batches of 100. Referenced application or inscription photos are never deleted. Model photos are never touched.
4. **Tests:** none.

#### b3a-erreurs — "Erreurs du site"
1. **Where:** tdb.html:2512 (`erreurs-*`, `#liste-erreurs`). Functions in tdb.js: `REGLES_ERREURS` (68), `analyserErreur` (99), `nettoyerErreursCorrigees` (205), `chargerErreurs` (326), `afficherErreurs` (271), `journalPourClaude` (469); handlers 423-502. Also `js/erreurs-corrigees.js` (`window.MA2M_ERREURS_CORRIGEES`).
2. **Data:**
   - `journal_erreurs` (`id, message, page, pile, user_agent, created_at`), last 7 days, limit 500;
   - `model_profiles` (`id, full_name`) for model pages (`?id=` in the URL).
3. **Writes:**
   - Automatic deletion of errors that were already fixed (`effacerSignalements`, batches of 100).
   - "✓ Réglé — effacer": `confirm`, delete the group's ids.
   - "Effacer" on the connection line: `confirm`, delete those ids.
   - "Tout marquer comme vu (effacer le journal)": `confirm`, delete everything from the last 7 days.
   - "📋 Copier pour Claude" (per error and all), and "⬇️ Télécharger le fichier pour Claude" (`.md` via `telechargerFichier` and `horodatageFichier`, `app.js:1138/1145`).
4. **Behaviours to keep:**
   - Grouped by message plus path.
   - Severity 🔴 corriger / 🟠 surveiller; 🟢 info errors are collapsed into one "connexion faible" line, unless 5 or more distinct visitors are hit (then promoted to 🟠).
   - "Revenue après correction" flag.
   - Family filters and severity filter boxes.
   - Device and last-click parsing (`lirePileErreur`, `appareilAffiche`).
   - Markdown fences adapt to backticks inside the error text.
5. **Tests:** `test-journal-fichier.js`, `test-journal.js` (rules), `test-surveillance-zoom.js`.

---

## 2. How the badges and counters are computed

- **À traiter:** described under `b1-a-traiter` above (tdb.js:635-689). It sums four head counts, drops the inscriptions item when framed, and mirrors the total on the bell (`#db-cloche-badge`), the old `#nav-badge-a-traiter`, and the header bell clone (tdb.html:3007-3015).
- **v2 menu badges** (`tableau-v2.js:273-290`):
  - `aTraiter` is parsed from the `#a-traiter-total` text;
  - `inscriptions`, `validations`, `candidatures` and `recruteurs` come from `chargerVue` data;
  - shown as "99+" above 99, hidden when 0.
  - These badges are in the inner v2 menu, which is hidden inside the frame. The shell menu in `espace-site.js` has no counters today.
- **Vue d'ensemble:** 8 cards plus alerts, from 13 parallel queries (`tableau-v2.js:322-336`).
- **Per-list counters:** "N au total" plus per-status counts in the pills (`chargerCompteurs`).

---

## 3. Role restrictions

**`js/mode-administration.js`**
- Active on an `admin.*` host or when `localStorage ma2m_mode_administration='1'`. It sets `<html data-portail>` and `.mode-administration`, and `.cadre-admin` when `?cadre=1` inside an iframe.
- `HORS_ESPACE_1 = ['b2-inscriptions','b3b-code-validation','b3b-creer-admin','b3b-code-permanent']` (line 25). It is applied through `MA2M_ADMINISTRATION.masquee()` in:
  - the v2 menu (`tableau-v2.js:124`);
  - the Vue d'ensemble cards and alerts;
  - the À traiter items.
- The markup and JS for those rubrics still exist and still run (e.g. `chargerInscriptions()` and `chargerStatutCodeValidation` still execute in the background).
- Access check `accesValide()`: RPC `portail_moi` must return a role and `espaces.site`; the session's MFA code must be less than 8 h old.
- Device PIN: `portail_code_appareil_etat` / `portail_code_appareil_verrouiller`. Lock after 15 min (`js/portail/inactivite.js`). Access is re-checked every 5 min and when the page becomes visible again.
- Logout: `signOut`, then `DELETE /api/acces-tableau`.

**Roles (`supabase-administration.sql`)**
- `staff_profiles.role ∈ {principal, site, caisse, compta}` (line 29).
- `portail_peut('site')` is true for principal or site, or through a delegation in `staff_module_grants`.
- `contacts_prives` (`portail_moi`, line 371) = principal, or `paiements`, or a `contacts_prives` grant. The site role does **not** get it. The JS portal does not use this flag in Espace 1 today; only the security module labels mention it.
- In practice every dashboard query is protected by RLS on the `admins` table, not by role. The trigger `staff_suivre_admins` is deliberately not attached (lines 534-539): a "site" account does not get an `admins` row, so **today only the principal can really open Espace 1**. Inscriptions and payments are also behind `admins`.
- Sensitive data RPCs (`profils_prives`, `contacts_mannequins_admin`, `convocation_contacts_mannequins`, `fiche_evenement_admin`) all check `admins`.

---

## 4. `middleware.js` `SCRIPTS_ADMIN` (line 50)

- **Purpose** (comments at lines 36-49, since 13/10/2026): before, anyone could download the dashboard page and its admin scripts (code exposure only; data stayed protected by RLS).
- **Now:**
  - Without a valid signed cookie `ma2m_admin=v1.<uid>.<exp>.<hmac>`, HMAC-SHA256 with `SUPABASE_SERVICE_ROLE_KEY` (`cleAccesValide`, line 66):
    - the page is served with every `<!-- ZONE-ADMIN -->…<!-- /ZONE-ADMIN -->` block removed (login screen only);
    - each script in `SCRIPTS_ADMIN` returns 404 "Introuvable".
  - If the server key is missing or something fails, the request is let through, so the owner is never locked out.
  - The cookie is set by `api/acces-tableau.js` (POST, 12 h; valid with an `aal2` MFA token less than 8 h old, or when no validation code is set) and by `api/code-validation-protege.js`.
- **Protected scripts:** `tableau-de-bord`, `tableau-v2`, `couverture-admin`, `photos-mises-de-cote`, `fiches-evenement-admin`, `rapport-profils-admin`, `agenda-admin`, `agenda-outils`, `convocations-page`, `convocations-admin`, `messages-convocations`, `messages-candidats`, `messages-groupes`, `nettoyage-supabase`, `erreurs-corrigees`. The list must match `config.matcher` (lines 30-34); `test-tableau-protege.js` checks this.
- **Gap:** `tailles.js` and `analyse-profil.js` sit inside ZONE-ADMIN but are not in `SCRIPTS_ADMIN`.

---

## 5. Scripts loaded by `tableau-de-bord.html`, in order

**In `<head>`**
1. Sentry CDN (async)
2. `js/surveillance.js`
3. `js/analytics-config.js`
4. `js/bouton-appui.js` (defer)
5. `js/mode-administration.js`
6. `js/portail/inactivite.js`

**In `<body>`**
7. `js/filet-reveal.js` (async, line 1985)
8. inline session check, `#tdb-verif-msg` (line 2023)
9. `js/connexion-tableau.js` (around line 2047)

**Inside ZONE-ADMIN #1 (from line 2094)**
10. inline menu script (line 2208)

**After ZONE-ADMIN #1**
11. `js/copyright-annee.js`
12. inline `MA2M_SESSION_REQUISE=true`
13. `js/vendor/supabase-js-2.110.6.js`
14. `js/supabase-config.js`
15. `js/vendor/emailjs-browser-3.12.1.min.js`
16. `js/emailjs-config.js`
17. `js/verrou-defilement.js`
18. `js/conversion-heic.js`
19. `js/app.js`
20. `js/confort.js`
21. `js/menu.js`
22. `js/connexion-tableau.js`

**Inside ZONE-ADMIN #2 (from line 2945)**
23. `js/tailles.js`
24. `js/analyse-profil.js`
25. `js/erreurs-corrigees.js`
26. `js/nettoyage-supabase.js`
27. `js/messages-convocations.js`
28. `js/messages-candidats.js`
29. `js/messages-groupes.js`
30. `js/couverture-admin.js`
31. `js/photos-mises-de-cote.js`
32. `js/fiches-evenement-admin.js`
33. `js/rapport-profils-admin.js`
34. `js/agenda-outils.js`
35. `js/agenda-admin.js`
36. `js/convocations-page.js`
37. `js/convocations-admin.js`
38. `js/tableau-de-bord.js`
39. inline `#ma2m-final-visual-guard`
40. inline `#ma2m-reference-final-js` (header nav, moves the activity panel, injects `b1-repartition`)
41. inline `#ma2m-final-reference-v2-js` (Top 10 override)
42. inline `#ma2m-final-reference-v3-js` (Top 10 and podium)
43. inline `#ma2m-v4-photo-recovery`
44. inline `#ma2m-master-ui-handoff` (comment-only spec)
45. inline push notifications plus accès bloqués (line 3330)
46. `js/tableau-v2.js`

**Lazy-loaded:** `mediabunny-1.61.0.min.js` (video), jsPDF (`chargerJsPdf`).

---

## 6. Visitor tests, per rubric

| Rubric | Test files in `scripts/tests-visiteur/` |
|---|---|
| Frame / Espace 1 shell | `test-espace1-cadre.js` |
| Access rules, menu filtering, b2-candidatures, b3b-codes-inscription, v2 cards | `test-administration.js` |
| Middleware / SCRIPTS_ADMIN | `test-tableau-protege.js` |
| b2-candidatures (minor and parent, status change, WhatsApp), b2-messages-groupes, b2-mannequins-publies (mute), b3c-agenda | `test-admin.js` |
| b2-convocations | `test-convocations.js`, `test-convocations-serveur.js` |
| actualites / evenements (admin side) | `test-publications.js` |
| partenaires | `test-espace1-cadre.js`, `test-administration.js` |
| b3a-erreurs | `test-journal-fichier.js`, `test-journal.js` |
| b3b-codes-inscription, note d'intégration | `test-note-integration.js` |
| b3d-video-accueil (public side) | `test-video-accueil.js` |
| Photo backfill / R2 WebP | `test-photos-webp.js` |
| Hidden rubrics (not in Espace 1) | `test-tableau-largeur.js` (b2-inscriptions), `test-code-permanent.js` (b3b-code-permanent) |
| **No test** | v2-ensemble (beyond the cards), b1-a-traiter, v2-top3, b1-repartition, b1-evolution, b2-validations, b3c-vedette-admin, b2-tri-photos, b2-rapport-profils, b2-fiches-evenement, b2-projets, b2-recruteurs, b2-contacts, b3c-mot-fondateur, b3c-instagram, b3b-acces-bloques, b3a-drive, b3a-nettoyage |

---

## 7. Pitfalls for the rebuild

- **Rubrics not in the Espace 1 menu:** these old-dashboard sections still run but have no entry in the Espace 1 menu: `b1-stats` (stat grid, 7-day activity chart, recent activity), `b1-vedette` (hero), `b1-derniers-dossiers` (`chargerApercuDossiers`, tdb.js:848, last 4 of each type with signed photo URLs), `b1-actions-rapides`. The rubrics hidden on purpose are `b2-inscriptions`, `b3b-code-validation`, `b3b-creer-admin` (`/api/portail action:'creer_admin'`) and `b3b-code-permanent` (RPC `definir_code_portail`).
- **Duplicate `cv-` ids:** `cv-*` ids clash between the old validation-code block (`cv-msg`, `cv-nouveau-code`, `cv-definir-btn`) and the Convocations form (`cv-form`, `cv-projet`…). Give them unique names in the rebuild.
- **Hidden global dependencies:** `messages-groupes.js` needs the global `DOSSIERS`. `convoquerProjet` navigates by clicking the old hidden menu item. Lazy loading uses MutationObservers on `.tdb-actif` (agenda, convocations) or `details` toggle events (validations, published models, tri, rapport, fiches, accès bloqués).
- **Writes that need care:**
  - Agenda and convocations use `.select('id')` after writes to detect silent RLS no-ops; keep that check.
  - Photo deletion order is database first, then files.
  - EmailJS runs client-side (public key): one template for the agency, `template_q3qpg4p` for candidates.
  - WhatsApp is always a manual wa.me link, one person per click.
  - Minors are always routed to the parent through `contactsEnvoi`.