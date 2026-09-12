// Configuration Supabase — Maître Akesse Model Management
// Clé "anon public" : publique par nature, sans risque à exposer côté client.
const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-k2vIvxdu1Ya-WzZWgj2Fg_8eyTmOmu';

// `sb` reste toujours défini (jamais en zone morte temporelle), même si le script
// Supabase (CDN) n'a pas pu charger — un simple `typeof sb` ailleurs sur le site
// reste alors fiable au lieu de lever une erreur qui bloquerait la page.
const sb = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
