// Configuration Supabase — Maître Akesse Model Management
// Clé "anon public" : publique par nature, sans risque à exposer côté client.
const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGdoZ213bXhpZ3VodHh0c2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzI1ODQsImV4cCI6MjEwNDI0ODU4NH0.S-JftGJNtPMLZdK6Jy9AUwwOl56JzyllkEJ0GN0eZ-M';

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

// `sbAdmin` : client dédié à la détection d'une session admin déjà ouverte (depuis
// tableau-de-bord.html) et aux actions d'administration (ajout/modification/suppression)
// sur les pages publiques qui n'exigent pas MA2M_SESSION_REQUISE (actualités, événements,
// partenaires...). Ces pages utilisent `sb` sans persistance pour ne jamais faire échouer
// une lecture publique à cause d'une session périmée (voir plus haut) — mais il leur faut
// malgré tout un moyen de savoir si l'admin est connecté et d'écrire en tant que tel. Ce
// second client, lui, lit/rafraîchit la session dans le même localStorage (même origine),
// donc retrouve la connexion faite depuis le tableau de bord, sans jamais s'en servir pour
// les requêtes publiques ordinaires. Sur les pages qui exigent déjà une vraie session
// (MA2M_SESSION_REQUISE), `sb` la persiste déjà : `sbAdmin` s'y confond alors avec `sb`
// plutôt que de dupliquer le client (évite l'avertissement Supabase "Multiple GoTrueClient
// instances" et toute désynchronisation entre deux clients sur la même page).
const sbAdmin = window.MA2M_SESSION_REQUISE
  ? sb
  : (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
