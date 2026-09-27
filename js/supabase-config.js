// Configuration Supabase — Maître Akesse Model Management
// Clé "anon public" : publique par nature, sans risque à exposer côté client.
const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-k2vIvxdu1Ya-WzZWgj2Fg_8eyTmOmu';

// Seules les pages avec une vraie connexion (espace-mannequin, tableau de bord)
// définissent `window.MA2M_SESSION_REQUISE = true` avant de charger ce script.
// Partout ailleurs (pages publiques : profils, book, candidature, actualités...),
// le client ne doit JAMAIS lire ni écrire de session dans le localStorage : sinon
// une session expirée laissée par une connexion précédente sur le même navigateur
// (même origine, donc même localStorage) serait réutilisée pour l'authentification
// et ferait échouer TOUTES les requêtes (401), y compris des lectures publiques qui
// ne nécessitent aucune connexion — symptôme observé : profils invisibles sur un
// ordinateur ayant déjà servi à se connecter au tableau de bord, alors qu'ils
// restent visibles sur un appareil n'ayant jamais ouvert de session.
const optionsAuthSupabase = window.MA2M_SESSION_REQUISE
  ? undefined
  : { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

// `sb` reste toujours défini (jamais en zone morte temporelle), même si le script
// Supabase (CDN) n'a pas pu charger — un simple `typeof sb` ailleurs sur le site
// reste alors fiable au lieu de lever une erreur qui bloquerait la page.
const sb = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, optionsAuthSupabase) : null;
