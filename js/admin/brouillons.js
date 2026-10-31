// Brouillons de l'Administration (31/10/2026, demande de la propriétaire : en quittant la page
// d'une actualité ou d'un événement pour aller lire un message, elle perdait le texte et les photos
// choisies). Le brouillon (champs, texte, photos choisies mais pas encore envoyées) est gardé dans
// CE navigateur (IndexedDB, qui sait garder des fichiers), jamais envoyé ailleurs ; il est effacé
// à la publication, à la suppression, ou au bout de 30 jours. Partagé : P.brouillon.lire / ecrire / effacer.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;
  const BASE = 'ma2m-brouillons', MAGASIN = 'brouillons', DUREE = 30 * 86400000;
  let ouverture = null;
  function base() {
    if (!ouverture) ouverture = new Promise((ok, ko) => {
      if (!window.indexedDB) { ko(new Error('pas de stockage')); return; }
      const r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(MAGASIN); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    return ouverture;
  }
  // une opération sur le magasin ; en cas d'échec (navigation privée, stockage plein) : rien
  async function operer(mode, faire) {
    try {
      const db = await base();
      return await new Promise((ok, ko) => {
        const tx = db.transaction(MAGASIN, mode);
        const r = faire(tx.objectStore(MAGASIN));
        tx.oncomplete = () => ok(r && r.result);
        tx.onerror = () => ko(tx.error);
      });
    } catch (e) { return null; }
  }
  P.brouillon = {
    async lire(cle) {
      const b = await operer('readonly', (m) => m.get(cle));
      if (!b) return null;
      if (Date.now() - (b.quand || 0) > DUREE) { await this.effacer(cle); return null; }
      return b;
    },
    ecrire(cle, valeur) { return operer('readwrite', (m) => m.put(Object.assign({}, valeur, { quand: Date.now() }), cle)); },
    effacer(cle) { return operer('readwrite', (m) => m.delete(cle)); }
  };
})();
