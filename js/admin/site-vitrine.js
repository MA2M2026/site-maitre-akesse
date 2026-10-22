// Nouvelle Administration — groupe « Contenu du site », 2e partie : Mot du fondateur et Flux
// Instagram, reconstruits à neuf (PLAN-NOUVELLE-ADMINISTRATION.md). Mêmes données que l'ancien
// tableau de bord (INVENTAIRE-BLOC1.md) :
//  - mot_responsable (id 'principal') : nom, titre, message, photo (R2, catégorie 'responsable') ;
//    la photo est convertie (HEIC) et allégée (allegerPhotoSite, js/app.js) ; l'ancienne photo
//    reste en place (elle peut servir ailleurs) ;
//  - instagram_config (jeton, identifiant du compte, date d'expiration à 60 jours) et
//    instagram_posts_cache (8 dernières publications, lues par l'accueil du site).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const msg = (id, classe, texte) => { const m = document.getElementById(id); if (m) { m.className = 'form-msg large ' + classe; m.textContent = texte; } };

  // ---------- Mot du fondateur ----------
  async function pageMot() {
    const m = (await P.bd(sb.from('mot_responsable').select('*').eq('id', 'principal').maybeSingle())) || {};
    const v = (k) => P.esc(m[k] || '');
    return P.entete('Mot du fondateur', '<a class="btn" href="/qui-sommes-nous" target="_blank" rel="noopener">Voir sur le site ↗</a>') +
      '<div class="fondateur">' +
      '<section class="carte fondateur-photo"><div class="vis" id="mr-apercu">' + (m.photo_url ? '<img class="charge" src="' + P.esc(urlLegere(m.photo_url)) + '" alt="Photo du fondateur">' : '<span class="ini">' + P.esc(P.initiales ? P.initiales(m.nom || 'M A') : 'MA') + '</span>') + '</div>' +
      '<form class="f" data-form="mot-photo"><label class="btn"><input type="file" name="photo" accept="image/*,.heic,.heif" data-change="mot-photo-choisie" hidden>📷 Choisir une photo</label>' +
      '<button class="btn rouge" type="submit" id="mr-photo-btn" disabled>Enregistrer la photo</button><p class="form-msg large" id="mr-photo-msg" role="status"></p></form></section>' +
      '<form class="carte f" data-form="mot-texte"><label class="fl" for="mr-nom">Nom<input id="mr-nom" name="nom" maxlength="120" value="' + v('nom') + '"></label>' +
      '<label class="fl" for="mr-titre">Titre<input id="mr-titre" name="titre" maxlength="160" value="' + v('titre') + '"></label>' +
      '<label class="fl large" for="mr-message">Message<textarea id="mr-message" name="message" rows="10" maxlength="6000">' + v('message') + '</textarea></label>' +
      '<p class="form-msg large" id="mr-msg" role="status"></p><div class="large"><button class="btn rouge" type="submit">Enregistrer le mot du fondateur</button></div></form></div>';
  }
  P.changements['mot-photo-choisie'] = (el) => {
    const f = el.files && el.files[0];
    document.getElementById('mr-photo-btn').disabled = !f;
    if (f && !/\.(heic|heif)$/i.test(f.name)) document.getElementById('mr-apercu').innerHTML = '<img class="charge" src="' + URL.createObjectURL(f) + '" alt="Nouvelle photo">';
  };
  P.formulaires['mot-photo'] = async (f) => {
    let fichier = f.get('photo');
    if (!fichier || !fichier.size) { msg('mr-photo-msg', 'err', 'Choisissez une photo d’abord.'); return; }
    msg('mr-photo-msg', 'ok', 'Envoi de la photo…');
    try { fichier = await allegerPhotoSite(await convertirSiHeic(fichier, 0.9)); } catch (e) { msg('mr-photo-msg', 'err', 'Cette photo (format HEIC) n’a pas pu être convertie : essayez une autre photo.'); return; }
    if (fichier.size > 10 * 1024 * 1024) { msg('mr-photo-msg', 'err', 'Cette photo est trop lourde (plus de 10 Mo) même après compression : essayez une autre photo.'); return; }
    let url;
    try { url = await envoyerImageSite('responsable', 'site/responsable/' + Date.now() + '-' + suffixeAleatoire() + '-' + nomFichierSur(fichier.name), fichier); } catch (e) { msg('mr-photo-msg', 'err', 'L’envoi a échoué : ' + e.message); return; }
    const r = await P.bd(sb.from('mot_responsable').update({ photo_url: url, updated_at: new Date().toISOString() }).eq('id', 'principal').select('id'));
    if (!r || !r.length) { msg('mr-photo-msg', 'err', 'Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.message('Photo du fondateur mise à jour.');
    return P.afficher();
  };
  P.formulaires['mot-texte'] = async (f) => {
    const ligne = { nom: String(f.get('nom') || '').trim(), titre: String(f.get('titre') || '').trim(), message: String(f.get('message') || '').trim(), updated_at: new Date().toISOString() };
    msg('mr-msg', 'ok', 'Enregistrement…');
    const r = await P.bd(sb.from('mot_responsable').update(ligne).eq('id', 'principal').select('id'));
    if (!r || !r.length) { msg('mr-msg', 'err', 'Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    msg('mr-msg', 'ok', 'Mot du fondateur enregistré : il est en ligne.');
  };

  // ---------- Flux Instagram ----------
  async function pageInstagram() {
    const [config, cache] = await Promise.all([
      P.bd(sb.from('instagram_config').select('ig_user_id, token_expire_le, access_token').eq('id', 'principal').maybeSingle()),
      P.bd(sb.from('instagram_posts_cache').select('posts, updated_at').eq('id', 'principal').maybeSingle()).catch(() => null)
    ]);
    let etat = '<p class="doux">Aucun jeton enregistré : le flux ne s’affiche pas encore sur le site.</p>';
    if (config && config.access_token) {
      const jours = config.token_expire_le ? Math.round((new Date(config.token_expire_le) - Date.now()) / 864e5) : null;
      etat = jours === null ? P.pastille('Jeton enregistré', 'ok')
        : jours < 0 ? P.pastille('Jeton expiré : générez-en un nouveau et enregistrez-le', 'erreur')
          : jours <= 10 ? P.pastille('Le jeton expire dans ' + jours + ' jour(s) : pensez à le renouveler', 'alerte')
            : P.pastille('Jeton valable encore ' + jours + ' jours', 'ok');
    }
    const posts = (cache && cache.posts) || [];
    const grille = posts.length ? '<div class="insta-grille">' + posts.map((x) => '<a href="' + P.esc(urlHttpSure(x.lien) || '#') + '" target="_blank" rel="noopener" class="insta-vignette"><img src="' + P.esc(urlHttpSure(x.image) || '') + '" alt="' + P.esc(x.legende || 'Publication Instagram') + '" loading="lazy"></a>').join('') + '</div>' +
      '<p class="doux petit-texte">Mis à jour le ' + P.esc(cache.updated_at ? P.dateHeure(cache.updated_at) : '—') + ' · ' + posts.length + ' publication(s) sur le site</p>' : '<p class="doux">Aucune publication récupérée pour le moment.</p>';
    return P.entete('Flux Instagram') +
      '<section class="carte"><h2>Publications affichées sur le site</h2>' + grille + '<div class="ligne"><button class="btn rouge" type="button" data-action="instagram-rafraichir">↻ Rafraîchir les publications</button></div><p class="form-msg" id="ig-msg" role="status"></p></section>' +
      '<form class="carte f" data-form="instagram-jeton"><h2 class="large">Connexion au compte</h2><div class="large etat-jeton">' + etat + '</div>' +
      '<label class="fl" for="ig-compte">Identifiant du compte Instagram professionnel<input id="ig-compte" name="compte" inputmode="numeric" autocomplete="off" value="' + P.esc(config && config.ig_user_id ? config.ig_user_id : '') + '"></label>' +
      '<label class="fl" for="ig-jeton">Nouveau jeton d’accès<input id="ig-jeton" name="jeton" type="password" autocomplete="off" placeholder="Collez le jeton ici"></label>' +
      '<p class="form-msg large" id="ig-jeton-msg" role="status"></p><div class="large"><button class="btn" type="submit">Enregistrer le jeton</button></div></form>';
  }
  P.formulaires['instagram-jeton'] = async (f, form) => {
    const jeton = String(f.get('jeton') || '').trim(), compte = String(f.get('compte') || '').trim();
    if (!jeton || !compte) { msg('ig-jeton-msg', 'err', 'L’identifiant du compte et le jeton sont tous les deux nécessaires.'); return; }
    const r = await P.bd(sb.from('instagram_config').upsert({ id: 'principal', access_token: jeton, ig_user_id: compte, token_expire_le: new Date(Date.now() + 60 * 864e5).toISOString(), updated_at: new Date().toISOString() }).select('id'));
    form.querySelector('#ig-jeton').value = '';
    if (!r || !r.length) { msg('ig-jeton-msg', 'err', 'Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.message('Jeton enregistré. Touchez « Rafraîchir les publications » pour les récupérer.');
    return P.afficher();
  };
  P.actions['instagram-rafraichir'] = async (el) => {
    el.disabled = true;
    try {
      msg('ig-msg', '', 'Récupération des publications…');
      const config = await P.bd(sb.from('instagram_config').select('access_token, ig_user_id').eq('id', 'principal').maybeSingle());
      if (!config || !config.access_token || !config.ig_user_id) { msg('ig-msg', 'err', 'Enregistrez d’abord l’identifiant du compte et un jeton (plus bas).'); return; }
      let posts;
      try {
        const rep = await fetch('https://graph.facebook.com/v21.0/' + encodeURIComponent(config.ig_user_id) + '/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=' + encodeURIComponent(config.access_token) + '&limit=8');
        const res = await rep.json();
        if (res.error) throw new Error(res.error.message || 'erreur inconnue d’Instagram');
        posts = (res.data || []).filter((p) => p.media_type !== 'VIDEO' || p.thumbnail_url)
          .map((p) => ({ id: p.id, image: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url, lien: p.permalink, legende: (p.caption || '').slice(0, 140) }));
      } catch (e) {
        msg('ig-msg', 'err', 'Instagram a refusé : ' + e.message + ' — vérifiez que le jeton est valide et que le compte est professionnel, relié à une Page Facebook.');
        return;
      }
      const r = await P.bd(sb.from('instagram_posts_cache').upsert({ id: 'principal', posts, updated_at: new Date().toISOString() }).select('id'));
      if (!r || !r.length) { msg('ig-msg', 'err', 'Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
      P.message(posts.length + ' publication(s) récupérée(s) et mise(s) à jour sur le site.');
      return P.afficher();
    } finally { if (el.isConnected) el.disabled = false; }
  };

  Object.assign(P.espaces.site.pages, { 'b3c-mot-fondateur': pageMot, 'b3c-instagram': pageInstagram });
})();
