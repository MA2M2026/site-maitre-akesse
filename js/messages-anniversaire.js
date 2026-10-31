// Messages d'anniversaire des mannequins de l'agence (chantier 14, partie 3, 01/11/2026 ; idée gardée par la
// propriétaire le 31/10/2026 : « envoyé automatiquement »). Partagés par le serveur du site (api/portail.js,
// envoi automatique chaque matin) et le navigateur. Le matin de son anniversaire, la mannequin reçoit :
//  - un message dans son application (et la notification sur son téléphone) ;
//  - un e-mail : à elle, ou à son parent si elle est mineure (même règle que les autres messages) ;
// et l'agence reçoit un e-mail récapitulatif avec, pour chacune, le lien WhatsApp déjà écrit.
// m : { nom, email, telephone, date_naissance, parent_nom, parent_email, parent_telephone }
(function (racine) {
  'use strict';
  const outils = typeof module !== 'undefined' && module.exports ? require('./messages-mensualites.js') : racine;
  const { ageMannequin, numeroWhatsAppMa2m } = outils;
  // « KONÉ AWA » → « Koné Awa » (les noms du registre sont souvent écrits en capitales)
  const nomLisible = (n) => String(n || '').trim().toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (t, a, l) => a + l.toUpperCase());
  function messageAnniversaire(m, aujourdhui) {
    const nom = nomLisible(m.nom || m.full_name);
    // l'âge atteint aujourd'hui (la date de naissance seule ; jamais affichée)
    const age = ageMannequin(m.date_naissance) ?? null;
    const mineur = age !== null && age < 18 && !!(m.parent_email || m.parent_telephone);
    const souhaits = 'Toute l’équipe de Maître Akesse Model Management vous souhaite une très belle journée. ' +
      'Que cette nouvelle année vous apporte de la joie, de belles rencontres et de nombreux succès, sur les podiums comme dans la vie.';
    const signature = '\n\nAvec toute notre affection,\nMaître Akesse et toute l’équipe';
    const pourElle = 'Joyeux anniversaire, ' + nom + ' ! 🎂\n\n' + souhaits + '\n\nProfitez bien de votre journée !' + signature;
    const parent = String(m.parent_nom || '').trim() || 'Madame, Monsieur';
    const pourParent = 'Bonjour ' + parent + ',\n\nAujourd’hui, ' + nom + ' fête son anniversaire' + (age ? ' : ' + age + ' ans' : '') + ' ! 🎂\n\n' +
      'Toute l’équipe de Maître Akesse Model Management lui souhaite une très belle journée, et une nouvelle année pleine de joie et de réussites. ' +
      'Merci de lui transmettre nos meilleurs vœux.' + signature;
    return {
      nom, age, mineur,
      titre: '🎂 Joyeux anniversaire, ' + nom + ' !',
      application: pourElle,
      email: { adresse: mineur ? m.parent_email : m.email, nom: mineur ? parent : nom, texte: mineur ? pourParent : pourElle },
      whatsapp: { numero: numeroWhatsAppMa2m(mineur ? m.parent_telephone : m.telephone), texte: mineur ? pourParent : pourElle },
      jour: aujourdhui || null
    };
  }
  const exportes = { messageAnniversaire, nomLisible };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportes;
  else Object.assign(racine, exportes);
})(typeof window !== 'undefined' ? window : globalThis);
