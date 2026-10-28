// Main réaliste de la vidéo v4 (28/10/2026, demande de la propriétaire : « plus humaine, moins dessin
// animé ») : index tendu (bout du doigt en 48, 4 dans un cadre de 150 × 345), ongle brillant, plis des
// articulations, doigts repliés, pouce, dos de la main, poignet, manche ; volumes par dégradés, ombres
// douces entre les doigts, grain de peau. MAIN_REALISTE(n) : n = suffixe unique des dégradés.
window.MAIN_REALISTE = (n) => {
  const g = (id) => id + '-' + n;
  return '<svg class="main" viewBox="0 0 200 460" overflow="visible"><defs>' +
    // peau : volume cylindrique (bords plus sombres, milieu éclairé)
    '<linearGradient id="' + g('cyl') + '" x1="0" x2="1"><stop offset="0" stop-color="#5a3520"/><stop offset=".22" stop-color="#7d4c30"/><stop offset=".52" stop-color="#a26c48"/><stop offset=".78" stop-color="#875337"/><stop offset="1" stop-color="#5c3621"/></linearGradient>' +
    '<linearGradient id="' + g('dos') + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a6442"/><stop offset=".45" stop-color="#8a5638"/><stop offset="1" stop-color="#5e3824"/></linearGradient>' +
    '<linearGradient id="' + g('pli') + '" x1="0" x2="1"><stop offset="0" stop-color="#6e4129"/><stop offset=".5" stop-color="#94603f"/><stop offset="1" stop-color="#6a3e27"/></linearGradient>' +
    '<linearGradient id="' + g('ombreBas') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a160b" stop-opacity=".55"/></linearGradient>' +
    '<radialGradient id="' + g('lumiere') + '" cx=".35" cy=".3" r=".6"><stop offset="0" stop-color="#c58e68" stop-opacity=".55"/><stop offset="1" stop-color="#c58e68" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="' + g('ongle') + '" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#f0cdb4"/><stop offset=".55" stop-color="#d4a184"/><stop offset="1" stop-color="#a87459"/></radialGradient>' +
    '<linearGradient id="' + g('manche') + '" x1="0" x2="1"><stop offset="0" stop-color="#d9d9dc"/><stop offset=".45" stop-color="#ffffff"/><stop offset="1" stop-color="#c9c9cd"/></linearGradient>' +
    '<filter id="' + g('flou') + '" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>' +
    '<filter id="' + g('grain') + '"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .14  0 0 0 0 .08  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
    '<clipPath id="' + g('forme') + '"><path d="M47 30 C47 12 54 4 64 4 C74 4 81 12 81 30 L82 70 C83 78 84 98 84 120 L86 160 L118 152 C130 150 140 156 146 164 C156 166 166 176 168 190 C176 232 174 286 162 322 L160 372 L60 372 L58 330 C44 300 34 262 22 232 C16 214 22 196 36 186 L44 176 L45 120 C45 98 46 80 46 70 Z"/></clipPath>' +
    '</defs>' +
    // manche de chemise et poignet
    '<path d="M58 316 C70 312 150 312 162 318 L166 460 L54 460 Z" fill="url(#' + g('cyl') + ')"/>' +
    '<path d="M48 378 C80 368 140 368 172 378 L178 470 L42 470 Z" fill="url(#' + g('manche') + ')"/>' +
    '<path d="M48 378 C80 368 140 368 172 378 L172 392 C140 383 80 383 48 392 Z" fill="#b9b9be" opacity=".55"/>' +
    // dos de la main
    '<path d="M44 176 L86 168 L168 194 C176 236 172 288 160 324 C130 334 90 334 60 326 C46 296 38 252 40 210 Z" fill="url(#' + g('dos') + ')"/>' +
    '<path d="M44 176 L86 168 L168 194 C176 236 172 288 160 324 C130 334 90 334 60 326 C46 296 38 252 40 210 Z" fill="url(#' + g('lumiere') + ')"/>' +
    '<path d="M92 230 C96 262 100 290 104 318 M120 226 C122 258 124 288 126 316 M144 222 C144 254 142 284 140 312" fill="none" stroke="#6b4029" stroke-width="2.4" opacity=".35" stroke-linecap="round"/>' +
    // doigts repliés : majeur, annulaire, auriculaire (dos des phalanges)
    '<path d="M84 162 C84 152 92 148 102 148 C114 148 120 154 120 166 L120 222 C120 236 110 242 100 242 C90 242 84 234 84 222 Z" fill="url(#' + g('pli') + ')"/>' +
    '<path d="M84 162 C84 152 92 148 102 148 C114 148 120 154 120 166 L120 222 C120 236 110 242 100 242 C90 242 84 234 84 222 Z" fill="url(#' + g('ombreBas') + ')"/>' +
    '<path d="M116 168 C116 158 124 154 132 154 C142 154 147 160 147 172 L147 224 C147 236 139 242 131 242 C122 242 116 236 116 226 Z" fill="url(#' + g('pli') + ')"/>' +
    '<path d="M116 168 C116 158 124 154 132 154 C142 154 147 160 147 172 L147 224 C147 236 139 242 131 242 C122 242 116 236 116 226 Z" fill="url(#' + g('ombreBas') + ')"/>' +
    '<path d="M143 180 C143 172 149 168 156 168 C164 168 168 174 168 184 L168 228 C168 238 162 244 155 244 C148 244 143 238 143 230 Z" fill="url(#' + g('pli') + ')"/>' +
    '<path d="M143 180 C143 172 149 168 156 168 C164 168 168 174 168 184 L168 228 C168 238 162 244 155 244 C148 244 143 238 143 230 Z" fill="url(#' + g('ombreBas') + ')"/>' +
    '<path d="M90 168 C96 164 108 164 114 168 M122 172 C128 168 138 168 142 172 M148 184 C152 180 160 180 164 184" fill="none" stroke="#c48b65" stroke-width="2" opacity=".55" stroke-linecap="round"/>' +
    '<path d="M120 170 L120 232 M147 176 L147 234" stroke="#3e2314" stroke-width="5" opacity=".35" filter="url(#' + g('flou') + ')"/>' +
    // pouce replié sur le côté
    '<path d="M42 182 C28 186 18 204 22 230 C26 252 42 264 58 258 C68 254 72 240 66 226 C60 210 54 194 42 182 Z" fill="url(#' + g('cyl') + ')"/>' +
    '<ellipse cx="27" cy="205" rx="4.5" ry="8" transform="rotate(-18 27 205)" fill="url(#' + g('ongle') + ')" opacity=".75"/>' +
    '<path d="M50 236 C56 244 62 248 66 250" fill="none" stroke="#4e2d1a" stroke-width="2" opacity=".4" stroke-linecap="round"/>' +
    // index tendu (avec léger renflement aux articulations)
    '<path d="M86 172 L44 176 C44 140 45 120 45 102 C45 92 46 82 46 70 L47 30 C47 12 54 4 64 4 C74 4 81 12 81 30 L82 70 C83 82 84 94 84 104 C84 122 85 144 86 172 Z" fill="url(#' + g('cyl') + ')"/>' +
    '<path d="M86 172 L70 174 C72 140 72 110 71 70" fill="none" stroke="#3e2314" stroke-width="6" opacity=".22" filter="url(#' + g('flou') + ')"/>' +
    // plis des articulations
    '<path d="M50 74 C56 78 72 78 78 74 M51 80 C58 83 70 83 77 80 M48 128 C56 133 74 133 82 128 M49 135 C58 139 72 139 81 135" fill="none" stroke="#4a2a18" stroke-width="1.6" opacity=".55" stroke-linecap="round"/>' +
    // ongle : lit de l'ongle, reflet, cuticule
    '<path d="M53 15 C53 9 58 7 64 7 C70 7 75 9 75 15 L75 36 C75 42 70 45 64 45 C58 45 53 42 53 36 Z" fill="url(#' + g('ongle') + ')"/>' +
    '<path d="M53 36 C53 42 58 45 64 45 C70 45 75 42 75 36" fill="none" stroke="#6e4129" stroke-width="1.6" opacity=".6"/>' +
    '<ellipse cx="60" cy="18" rx="3.5" ry="8" fill="#fff" opacity=".45"/>' +
    // reflet de lumière le long du doigt
    '<path d="M58 52 C58 90 59 130 60 166" fill="none" stroke="#c99472" stroke-width="5" opacity=".35" stroke-linecap="round" filter="url(#' + g('flou') + ')"/>' +
    // grain de peau sur toute la main
    '<rect x="0" y="0" width="200" height="460" clip-path="url(#' + g('forme') + ')" filter="url(#' + g('grain') + ')" opacity=".35"/>' +
    '</svg>';
};
