// Fonction serverless Vercel — Grand 4 (S-13, S-14) : pour l'espace admin
// uniquement. Liste les IP/comptes actuellement bloqués et permet de
// débloquer manuellement ou d'ajouter une IP de confiance à la liste
// blanche. Toutes les tables de blocage sont protégées côté base (aucune
// policy publique) : seul ce point d'entrée, authentifié admin, peut les
// lire ou les modifier.

const { SUPABASE_URL, enTetesService, jetonDe, corpsDe, verifierUtilisateur, estAdmin } = require('./_commun.js');

// Compte connecté ET administrateur, sinon null.
async function verifierAdmin(jeton) {
  const utilisateur = await verifierUtilisateur(jeton);
  return utilisateur && (await estAdmin(utilisateur.id)) ? utilisateur : null;
}

module.exports = async function handler(req, res) {
  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cleSecrete) { res.status(500).json({ error: 'Configuration serveur incomplète.' }); return; }

  const jeton = jetonDe(req);
  if (!jeton) { res.status(401).json({ error: 'Non authentifié.' }); return; }

  const entetes = { ...enTetesService(), 'Content-Type': 'application/json' };

  const utilisateur = await verifierAdmin(jeton);
  if (!utilisateur) { res.status(403).json({ error: "Ce compte n'est pas administrateur." }); return; }

  try {
    if (req.method === 'GET') {
      const maintenant = new Date().toISOString();
      const [repIp, repCompte, repBlanche] = await Promise.all([
        fetch(SUPABASE_URL + '/rest/v1/connexion_tentatives_ip?bloque_jusqua=gt.' + encodeURIComponent(maintenant) + '&select=ip,espace,bloque_jusqua&order=bloque_jusqua.desc', { headers: entetes }),
        fetch(SUPABASE_URL + '/rest/v1/connexion_tentatives_compte?bloque_jusqua=gt.' + encodeURIComponent(maintenant) + '&select=identifiant,espace,bloque_jusqua&order=bloque_jusqua.desc', { headers: entetes }),
        fetch(SUPABASE_URL + '/rest/v1/connexion_liste_blanche?select=ip,note,ajoute_le&order=ajoute_le.desc', { headers: entetes })
      ]);
      res.status(200).json({
        ipBloquees: repIp.ok ? await repIp.json() : [],
        comptesBloques: repCompte.ok ? await repCompte.json() : [],
        listeBlanche: repBlanche.ok ? await repBlanche.json() : []
      });
      return;
    }

    if (req.method === 'POST') {
      const corps = corpsDe(req);
      const action = corps && corps.action;

      if (action === 'debloquer_ip') {
        await fetch(SUPABASE_URL + '/rest/v1/connexion_tentatives_ip?ip=eq.' + encodeURIComponent(corps.ip) + '&espace=eq.' + encodeURIComponent(corps.espace), {
          method: 'PATCH', headers: { ...entetes, Prefer: 'return=minimal' },
          body: JSON.stringify({ bloque_jusqua: null, compteur: 0 })
        });
        res.status(200).json({ ok: true });
        return;
      }
      if (action === 'debloquer_compte') {
        await fetch(SUPABASE_URL + '/rest/v1/connexion_tentatives_compte?identifiant=eq.' + encodeURIComponent(corps.identifiant) + '&espace=eq.' + encodeURIComponent(corps.espace), {
          method: 'PATCH', headers: { ...entetes, Prefer: 'return=minimal' },
          body: JSON.stringify({ bloque_jusqua: null, compteur: 0 })
        });
        res.status(200).json({ ok: true });
        return;
      }
      if (action === 'liste_blanche_ajouter') {
        if (!corps.ip) { res.status(400).json({ error: 'IP manquante.' }); return; }
        await fetch(SUPABASE_URL + '/rest/v1/connexion_liste_blanche', {
          method: 'POST', headers: { ...entetes, Prefer: 'return=minimal,resolution=merge-duplicates' },
          body: JSON.stringify({ ip: corps.ip, note: corps.note || null })
        });
        res.status(200).json({ ok: true });
        return;
      }
      if (action === 'liste_blanche_retirer') {
        await fetch(SUPABASE_URL + '/rest/v1/connexion_liste_blanche?ip=eq.' + encodeURIComponent(corps.ip), {
          method: 'DELETE', headers: entetes
        });
        res.status(200).json({ ok: true });
        return;
      }
      res.status(400).json({ error: 'Action inconnue.' });
      return;
    }

    res.status(405).json({ error: 'Méthode non autorisée.' });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
