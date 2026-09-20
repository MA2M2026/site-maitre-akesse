// Menu plein écran — ouverture/fermeture
document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('menuBtn');
  const closeBtn = document.getElementById('closeMenuBtn');
  const overlay = document.getElementById('menuOverlay');
  if (!menuBtn || !overlay) return;

  menuBtn.addEventListener('click', () => overlay.classList.add('active'));
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => overlay.classList.remove('active')));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.classList.remove('active');
  });

  // Filet de sécurité "retour arrière" : si le navigateur restaure la page
  // depuis son cache (bfcache) — courant sur mobile/tablette en appuyant sur
  // retour — il peut la restaurer figée dans un état intermédiaire (menu
  // resté ouvert ou mal positionné). On le referme systématiquement à chaque
  // retour sur la page pour repartir d'un état propre.
  window.addEventListener('pageshow', (evenement) => {
    if (evenement.persisted) overlay.classList.remove('active');
  });
});

// Injecte, dans le menu plein écran de chaque page, le bloc coordonnées + réseaux
// sociaux tout en bas de la liste — évite de dupliquer ce bloc dans chaque fichier HTML.
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelector('.menu-overlay .nav-links');
  if (!navLinks || navLinks.parentNode.querySelector('.menu-contact')) return;

  const bloc = document.createElement('div');
  bloc.className = 'menu-contact';
  bloc.innerHTML = `
    <a class="menu-tel" href="tel:+2250545656887">+225 05 45 65 68 87</a><br>
    <a class="menu-tel" href="tel:+2252722231176">+225 27 22 23 11 76</a>
    <div class="menu-reseaux">
      <a href="https://www.instagram.com/maitreakessemodelmanagement" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.333 0 8.741 0 12s.014 3.667.072 4.948c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.667-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>
      <a href="https://www.tiktok.com/@agencemaitreakessemodel" target="_blank" rel="noopener" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="M16.6 5.82c-1.36-1.57-3.24-1.48-3.24-1.48h-3.09v12.4a2.592 2.592 0 01-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 004.3 1.38V7.3s-1.88.09-3.24-1.48z"/></svg></a>
      <a href="https://www.facebook.com/share/1BzPN69rhE/" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.022 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.459h-1.26c-1.243 0-1.63.771-1.63 1.562v1.875h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.918 8.437-9.94z"/></svg></a>
      <a href="https://youtube.com/@maitreakessemodelmanagement" target="_blank" rel="noopener" aria-label="YouTube"><svg viewBox="0 0 24 24"><path d="M23.498 6.186a2.994 2.994 0 00-2.107-2.12C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.391.521A2.994 2.994 0 00.502 6.186 31.25 31.25 0 000 12a31.25 31.25 0 00.502 5.814 2.994 2.994 0 002.107 2.12c1.886.521 9.391.521 9.391.521s7.505 0 9.391-.521a2.994 2.994 0 002.107-2.12A31.25 31.25 0 0024 12a31.25 31.25 0 00-.502-5.814zM9.6 15.6V8.4l6.4 3.6-6.4 3.6z"/></svg></a>
      <a href="https://wa.me/message/HJAMXGXHCL46I1" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0a12 12 0 00-10.288 18.06L0 24l6.084-1.688A12 12 0 1012 0zm0 21.938a9.917 9.917 0 01-5.052-1.383l-.362-.215-3.752 1.041 1.004-3.665-.235-.375A9.938 9.938 0 1112 21.938z"/></svg></a>
    </div>
  `;
  navLinks.parentNode.insertBefore(bloc, navLinks.nextSibling);
});

// Lien "Tableau de bord" : ajouté dans le menu UNIQUEMENT si une session admin
// déjà connectée est détectée — invisible pour tout visiteur normal, mais
// accessible en un clic depuis n'importe quelle page une fois connecté.
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof sb === 'undefined' || !sb) return;
  const navLinks = document.querySelector('.menu-overlay .nav-links');
  if (!navLinks || navLinks.querySelector('.item-admin')) return;

  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from('admins').select('user_id').eq('user_id', user.id).single();
    if (!data) return;

    const li = document.createElement('li');
    li.className = 'item-admin';
    li.innerHTML = '<a href="/tableau-de-bord.html">Tableau de bord</a>';
    navLinks.appendChild(li);
  } catch (e) {}
});
