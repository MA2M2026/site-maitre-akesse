// Outils partagés par le serveur ET les pages (phase 2, 02/11/2026). Listes des formulaires : villes de Côte d'Ivoire, communes d'Abidjan, indicatifs
// téléphoniques. UNE seule copie, partagée par le serveur (middleware.js écrit les listes déroulantes dans la page :
// visibles sans programme, et « Côte d'Ivoire (+225) » choisi d'avance, même après la remise à zéro d'un formulaire)
// et par les pages (js/app.js). Avant, ces listes étaient dans js/app.js (20/10/2026).
// Script classique ET importable par middleware.js : il pose window.ListesFormulaires / globalThis.ListesFormulaires.
(function (racine) {
  'use strict';
  const VILLES_CI = [
    'Abidjan', 'Abengourou', 'Aboisso', 'Adiaké', 'Adzopé', 'Affery', 'Agboville', 'Agnibilékrou',
    'Akoupé', 'Alépé', 'Anyama', 'Arrah', 'Attiégouakro', 'Bangolo', 'Bettié', 'Biankouma',
    'Bingerville', 'Bloléquin', 'Bocanda', 'Bondoukou', 'Bongouanou', 'Bouaflé', 'Bouaké', 'Bouna',
    'Boundiali', 'Dabakala', 'Dabou', 'Daloa', 'Danané', 'Daoukro', 'Dimbokro', 'Divo', 'Duékoué',
    'Facobly', 'Ferkessédougou', 'Fresco', 'Gagnoa', 'Grand-Bassam', 'Grand-Lahou', 'Guiglo',
    'Guitry', 'Issia', 'Jacqueville', 'Kani', 'Katiola', 'Kong', 'Korhogo', 'Kouibly', 'Lakota',
    'Man', 'Mankono', "M'Bahiakro", 'Minignan', 'Nassian', 'Odienné', 'Oumé', 'Ouangolodougou',
    'Ouragahio', 'Prikro', 'Sakassou', 'San-Pédro', 'Sassandra', 'Séguéla', 'Sikensi', 'Sinfra',
    'Soubré', 'Tabou', 'Tanda', 'Tengréla', 'Tiassalé', 'Tiébissou', 'Toulepleu', 'Toumodi',
    'Touba', 'Vavoua', 'Yamoussoukro', 'Zouan-Hounien', 'Zuénoula'
  ];
  const COMMUNES_ABIDJAN = [
    'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi', 'Marcory',
    'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon'
  ];
  const INDICATIFS_PAYS = [
    ['+93', '🇦🇫 Afghanistan (+93)'],
    ['+27', '🇿🇦 Afrique du Sud (+27)'],
    ['+355', '🇦🇱 Albanie (+355)'],
    ['+213', '🇩🇿 Algérie (+213)'],
    ['+49', '🇩🇪 Allemagne (+49)'],
    ['+376', '🇦🇩 Andorre (+376)'],
    ['+244', '🇦🇴 Angola (+244)'],
    ['+1268', '🇦🇬 Antigua-et-Barbuda (+1268)'],
    ['+966', '🇸🇦 Arabie saoudite (+966)'],
    ['+54', '🇦🇷 Argentine (+54)'],
    ['+374', '🇦🇲 Arménie (+374)'],
    ['+61', '🇦🇺 Australie (+61)'],
    ['+43', '🇦🇹 Autriche (+43)'],
    ['+994', '🇦🇿 Azerbaïdjan (+994)'],
    ['+1242', '🇧🇸 Bahamas (+1242)'],
    ['+973', '🇧🇭 Bahreïn (+973)'],
    ['+880', '🇧🇩 Bangladesh (+880)'],
    ['+1246', '🇧🇧 Barbade (+1246)'],
    ['+32', '🇧🇪 Belgique (+32)'],
    ['+501', '🇧🇿 Belize (+501)'],
    ['+229', '🇧🇯 Bénin (+229)'],
    ['+975', '🇧🇹 Bhoutan (+975)'],
    ['+375', '🇧🇾 Biélorussie (+375)'],
    ['+95', '🇲🇲 Birmanie / Myanmar (+95)'],
    ['+591', '🇧🇴 Bolivie (+591)'],
    ['+387', '🇧🇦 Bosnie-Herzégovine (+387)'],
    ['+267', '🇧🇼 Botswana (+267)'],
    ['+55', '🇧🇷 Brésil (+55)'],
    ['+673', '🇧🇳 Brunei (+673)'],
    ['+359', '🇧🇬 Bulgarie (+359)'],
    ['+226', '🇧🇫 Burkina Faso (+226)'],
    ['+257', '🇧🇮 Burundi (+257)'],
    ['+855', '🇰🇭 Cambodge (+855)'],
    ['+237', '🇨🇲 Cameroun (+237)'],
    ['+1', '🇨🇦 Canada (+1)'],
    ['+238', '🇨🇻 Cap-Vert (+238)'],
    ['+56', '🇨🇱 Chili (+56)'],
    ['+86', '🇨🇳 Chine (+86)'],
    ['+357', '🇨🇾 Chypre (+357)'],
    ['+57', '🇨🇴 Colombie (+57)'],
    ['+269', '🇰🇲 Comores (+269)'],
    ['+242', '🇨🇬 Congo-Brazzaville (+242)'],
    ['+243', '🇨🇩 Congo-Kinshasa / RDC (+243)'],
    ['+850', '🇰🇵 Corée du Nord (+850)'],
    ['+82', '🇰🇷 Corée du Sud (+82)'],
    ['+506', '🇨🇷 Costa Rica (+506)'],
    ['+225', "🇨🇮 Côte d'Ivoire (+225)"],
    ['+385', '🇭🇷 Croatie (+385)'],
    ['+53', '🇨🇺 Cuba (+53)'],
    ['+45', '🇩🇰 Danemark (+45)'],
    ['+253', '🇩🇯 Djibouti (+253)'],
    ['+1767', '🇩🇲 Dominique (+1767)'],
    ['+20', '🇪🇬 Égypte (+20)'],
    ['+971', '🇦🇪 Émirats arabes unis (+971)'],
    ['+593', '🇪🇨 Équateur (+593)'],
    ['+291', '🇪🇷 Érythrée (+291)'],
    ['+34', '🇪🇸 Espagne (+34)'],
    ['+372', '🇪🇪 Estonie (+372)'],
    ['+268', '🇸🇿 Eswatini (+268)'],
    ['+1', '🇺🇸 États-Unis (+1)'],
    ['+251', '🇪🇹 Éthiopie (+251)'],
    ['+679', '🇫🇯 Fidji (+679)'],
    ['+358', '🇫🇮 Finlande (+358)'],
    ['+33', '🇫🇷 France (+33)'],
    ['+241', '🇬🇦 Gabon (+241)'],
    ['+220', '🇬🇲 Gambie (+220)'],
    ['+995', '🇬🇪 Géorgie (+995)'],
    ['+233', '🇬🇭 Ghana (+233)'],
    ['+30', '🇬🇷 Grèce (+30)'],
    ['+1473', '🇬🇩 Grenade (+1473)'],
    ['+502', '🇬🇹 Guatemala (+502)'],
    ['+224', '🇬🇳 Guinée (+224)'],
    ['+245', '🇬🇼 Guinée-Bissau (+245)'],
    ['+240', '🇬🇶 Guinée équatoriale (+240)'],
    ['+592', '🇬🇾 Guyana (+592)'],
    ['+509', '🇭🇹 Haïti (+509)'],
    ['+504', '🇭🇳 Honduras (+504)'],
    ['+36', '🇭🇺 Hongrie (+36)'],
    ['+91', '🇮🇳 Inde (+91)'],
    ['+62', '🇮🇩 Indonésie (+62)'],
    ['+964', '🇮🇶 Irak (+964)'],
    ['+98', '🇮🇷 Iran (+98)'],
    ['+353', '🇮🇪 Irlande (+353)'],
    ['+354', '🇮🇸 Islande (+354)'],
    ['+972', '🇮🇱 Israël (+972)'],
    ['+39', '🇮🇹 Italie (+39)'],
    ['+1876', '🇯🇲 Jamaïque (+1876)'],
    ['+81', '🇯🇵 Japon (+81)'],
    ['+962', '🇯🇴 Jordanie (+962)'],
    ['+7', '🇰🇿 Kazakhstan (+7)'],
    ['+254', '🇰🇪 Kenya (+254)'],
    ['+996', '🇰🇬 Kirghizistan (+996)'],
    ['+686', '🇰🇮 Kiribati (+686)'],
    ['+965', '🇰🇼 Koweït (+965)'],
    ['+856', '🇱🇦 Laos (+856)'],
    ['+266', '🇱🇸 Lesotho (+266)'],
    ['+371', '🇱🇻 Lettonie (+371)'],
    ['+961', '🇱🇧 Liban (+961)'],
    ['+231', '🇱🇷 Liberia (+231)'],
    ['+218', '🇱🇾 Libye (+218)'],
    ['+423', '🇱🇮 Liechtenstein (+423)'],
    ['+370', '🇱🇹 Lituanie (+370)'],
    ['+352', '🇱🇺 Luxembourg (+352)'],
    ['+389', '🇲🇰 Macédoine du Nord (+389)'],
    ['+261', '🇲🇬 Madagascar (+261)'],
    ['+60', '🇲🇾 Malaisie (+60)'],
    ['+265', '🇲🇼 Malawi (+265)'],
    ['+960', '🇲🇻 Maldives (+960)'],
    ['+223', '🇲🇱 Mali (+223)'],
    ['+356', '🇲🇹 Malte (+356)'],
    ['+212', '🇲🇦 Maroc (+212)'],
    ['+230', '🇲🇺 Maurice (+230)'],
    ['+222', '🇲🇷 Mauritanie (+222)'],
    ['+52', '🇲🇽 Mexique (+52)'],
    ['+691', '🇫🇲 Micronésie (+691)'],
    ['+373', '🇲🇩 Moldavie (+373)'],
    ['+377', '🇲🇨 Monaco (+377)'],
    ['+976', '🇲🇳 Mongolie (+976)'],
    ['+382', '🇲🇪 Monténégro (+382)'],
    ['+258', '🇲🇿 Mozambique (+258)'],
    ['+264', '🇳🇦 Namibie (+264)'],
    ['+674', '🇳🇷 Nauru (+674)'],
    ['+977', '🇳🇵 Népal (+977)'],
    ['+505', '🇳🇮 Nicaragua (+505)'],
    ['+227', '🇳🇪 Niger (+227)'],
    ['+234', '🇳🇬 Nigeria (+234)'],
    ['+47', '🇳🇴 Norvège (+47)'],
    ['+64', '🇳🇿 Nouvelle-Zélande (+64)'],
    ['+968', '🇴🇲 Oman (+968)'],
    ['+256', '🇺🇬 Ouganda (+256)'],
    ['+998', '🇺🇿 Ouzbékistan (+998)'],
    ['+92', '🇵🇰 Pakistan (+92)'],
    ['+680', '🇵🇼 Palaos (+680)'],
    ['+507', '🇵🇦 Panama (+507)'],
    ['+675', '🇵🇬 Papouasie-Nouvelle-Guinée (+675)'],
    ['+595', '🇵🇾 Paraguay (+595)'],
    ['+31', '🇳🇱 Pays-Bas (+31)'],
    ['+51', '🇵🇪 Pérou (+51)'],
    ['+63', '🇵🇭 Philippines (+63)'],
    ['+48', '🇵🇱 Pologne (+48)'],
    ['+351', '🇵🇹 Portugal (+351)'],
    ['+974', '🇶🇦 Qatar (+974)'],
    ['+236', '🇨🇫 République centrafricaine (+236)'],
    ['+1809', '🇩🇴 République dominicaine (+1809)'],
    ['+420', '🇨🇿 République tchèque (+420)'],
    ['+40', '🇷🇴 Roumanie (+40)'],
    ['+44', '🇬🇧 Royaume-Uni (+44)'],
    ['+7', '🇷🇺 Russie (+7)'],
    ['+250', '🇷🇼 Rwanda (+250)'],
    ['+1869', '🇰🇳 Saint-Kitts-et-Nevis (+1869)'],
    ['+378', '🇸🇲 Saint-Marin (+378)'],
    ['+1784', '🇻🇨 Saint-Vincent-et-les-Grenadines (+1784)'],
    ['+1758', '🇱🇨 Sainte-Lucie (+1758)'],
    ['+677', '🇸🇧 Salomon (+677)'],
    ['+503', '🇸🇻 Salvador (+503)'],
    ['+685', '🇼🇸 Samoa (+685)'],
    ['+239', '🇸🇹 São Tomé-et-Príncipe (+239)'],
    ['+221', '🇸🇳 Sénégal (+221)'],
    ['+381', '🇷🇸 Serbie (+381)'],
    ['+248', '🇸🇨 Seychelles (+248)'],
    ['+232', '🇸🇱 Sierra Leone (+232)'],
    ['+65', '🇸🇬 Singapour (+65)'],
    ['+421', '🇸🇰 Slovaquie (+421)'],
    ['+386', '🇸🇮 Slovénie (+386)'],
    ['+252', '🇸🇴 Somalie (+252)'],
    ['+249', '🇸🇩 Soudan (+249)'],
    ['+211', '🇸🇸 Soudan du Sud (+211)'],
    ['+94', '🇱🇰 Sri Lanka (+94)'],
    ['+46', '🇸🇪 Suède (+46)'],
    ['+41', '🇨🇭 Suisse (+41)'],
    ['+597', '🇸🇷 Suriname (+597)'],
    ['+963', '🇸🇾 Syrie (+963)'],
    ['+992', '🇹🇯 Tadjikistan (+992)'],
    ['+255', '🇹🇿 Tanzanie (+255)'],
    ['+235', '🇹🇩 Tchad (+235)'],
    ['+66', '🇹🇭 Thaïlande (+66)'],
    ['+670', '🇹🇱 Timor oriental (+670)'],
    ['+228', '🇹🇬 Togo (+228)'],
    ['+676', '🇹🇴 Tonga (+676)'],
    ['+1868', '🇹🇹 Trinité-et-Tobago (+1868)'],
    ['+216', '🇹🇳 Tunisie (+216)'],
    ['+993', '🇹🇲 Turkménistan (+993)'],
    ['+90', '🇹🇷 Turquie (+90)'],
    ['+688', '🇹🇻 Tuvalu (+688)'],
    ['+380', '🇺🇦 Ukraine (+380)'],
    ['+598', '🇺🇾 Uruguay (+598)'],
    ['+678', '🇻🇺 Vanuatu (+678)'],
    ['+379', '🇻🇦 Vatican (+379)'],
    ['+58', '🇻🇪 Venezuela (+58)'],
    ['+84', '🇻🇳 Vietnam (+84)'],
    ['+967', '🇾🇪 Yémen (+967)'],
    ['+260', '🇿🇲 Zambie (+260)'],
    ['+263', '🇿🇼 Zimbabwe (+263)']
  ];

  // Pages anglaises : noms des pays en anglais (traduits à partir du drapeau, qui contient le code du pays),
  // classés dans l'ordre alphabétique anglais. Traduction indisponible : la liste française reste.
  function indicatifsAffiches(en) {
    if (!en || typeof Intl === 'undefined' || !Intl.DisplayNames) return INDICATIFS_PAYS;
    try {
      const noms = new Intl.DisplayNames(['en'], { type: 'region' });
      return INDICATIFS_PAYS.map(([valeur, libelle]) => {
        const lettres = Array.from(libelle).slice(0, 2).map(c => c.codePointAt(0) - 0x1F1E6);
        if (lettres.length !== 2 || lettres.some(n => n < 0 || n > 25)) return [valeur, libelle, libelle];
        const code = String.fromCharCode(65 + lettres[0], 65 + lettres[1]);
        const nom = noms.of(code);
        if (!nom || nom === code) return [valeur, libelle, libelle];
        const drapeau = Array.from(libelle).slice(0, 2).join('');
        return [valeur, `${drapeau} ${nom} (${valeur})`, nom];
      }).sort((a, b) => a[2].localeCompare(b[2], 'en'));
    } catch (e) { return INDICATIFS_PAYS; }
  }
  const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // options d'un indicatif (le pays par défaut, +225, choisi d'avance : attribut « selected »)
  function optionsIndicatifs(en, defaut) {
    const choisi = defaut || '+225';
    return indicatifsAffiches(en).map(([valeur, libelle]) => '<option value="' + echapper(valeur) + '"' + (valeur === choisi ? ' selected' : '') + '>' + echapper(libelle) + '</option>').join('');
  }
  // options d'une liste avec « — » au début et « Autre » à la fin (comme remplirSelectListe, js/app.js)
  function optionsListe(liste, en) {
    return '<option value="">—</option>' + liste.map((v) => '<option value="' + echapper(v) + '">' + echapper(v) + '</option>').join('') +
      '<option value="Autre">' + (en ? 'Other' : 'Autre') + '</option>';
  }
  // options de nombres (comme remplirSelectNombres, js/app.js) : « — » puis min…max
  function optionsNombres(min, max, pas, suffixe) {
    let h = '<option value="">—</option>';
    for (let v = min; v <= max; v += pas) h += '<option value="' + v + '">' + v + (suffixe || '') + '</option>';
    return h;
  }
  // listes de nombres du formulaire de candidature (js/formulaire-candidature.js) ; « ca-taille » : liste complète
  // au départ (genre pas encore choisi), comme remplirTailleMinimale (js/app.js)
  const SELECTS_NOMBRES = { 'ca-poids': [35, 130, 1, ' kg'], 'ca-poitrine': [70, 130, 1, ' cm'], 'ca-tourtaille': [55, 110, 1, ' cm'],
    'ca-hanches': [70, 130, 1, ' cm'], 'ca-pointure': [34, 46, 1, ''], 'ca-taille': [140, 210, 1, ' cm'] };
  // Pour le serveur : remplit les listes déroulantes encore vides des formulaires publics (marquées « data-rempli » :
  // la page ne les reremplit pas)
  const SELECTS_INDICATIFS = ['indicatif', 'ca-indicatif', 'ca-parent-indicatif', 're-indicatif', 're-indicatif-whatsapp'];
  const SELECTS_VILLES = ['ville', 'ca-ville', 're-ville'];
  function remplirSelectsHtml(html, en) {
    return html.replace(/<select id="([a-z-]+)"([^>]*)><\/select>/g, (tout, id, reste) => {
      if (/data-rempli/.test(reste)) return tout;
      if (SELECTS_INDICATIFS.includes(id)) return '<select id="' + id + '"' + reste + ' data-rempli>' + optionsIndicatifs(en) + '</select>';
      if (SELECTS_NOMBRES[id]) return '<select id="' + id + '"' + reste + ' data-rempli>' + optionsNombres.apply(null, SELECTS_NOMBRES[id]) + '</select>';
      if (SELECTS_VILLES.includes(id)) return '<select id="' + id + '"' + reste + ' data-rempli>' + optionsListe(VILLES_CI, en) + '</select>';
      return tout;
    });
  }
  // Titres écrits tout en majuscules dans la base (« ABIDJAN BORDER FORUM ») : en minuscules avec une capitale
  // (js/app.js jusqu'au 02/11/2026)
  const MOTS_COURTS = ['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'au', 'aux', 'en', 'in', 'of', 'the', 'and', 'on'];
  function titreLisible(t) {
    const s = String(t || '').trim();
    if (s !== s.toUpperCase()) return s;
    return s.split(/(\s+)/).map((mot, i) => {
      const bas = mot.toLowerCase();
      const motCourt = MOTS_COURTS.includes(bas);
      if (i > 0 && motCourt) return bas;
      if (/\d/.test(mot) || (!motCourt && /^[A-Z]{1,2}$/.test(mot))) return mot; // MA2M, 2026, sigles (CI, MA)
      const capitale = bas.replace(/(^|['’(-])(\S)/g, (m, x, y) => x + y.toUpperCase());
      return i > 0 && /^[dl]['’]/.test(bas) ? capitale.charAt(0).toLowerCase() + capitale.slice(1) : capitale; // « d'Abidjan »
    }).join('');
  }
  // Agenda (Extension 124) : libellés des types de projet [français, anglais], date lisible, date du jour (AAAA-MM-JJ)
  // et projets séparés en « à venir » / « réalisés » (js/app.js jusqu'au 02/11/2026)
  const MA2M_TYPES_AGENDA = {
    defile: ['Défilé', 'Fashion show'],
    show: ['Show', 'Show'],
    shooting: ['Shooting', 'Photo shoot'],
    casting: ['Casting', 'Casting'],
    essayage: ['Essayages', 'Fittings'],
    masterclass: ['Masterclass', 'Masterclass'],
    formation: ['Formation', 'Training'],
    rencontre: ['Rencontre', 'Meeting'],
    evenement: ['Événement', 'Event'],
    autre: ['Projet', 'Project']
  };
  function libelleTypeAgenda(type, enAnglais) {
    const l = MA2M_TYPES_AGENDA[type] || MA2M_TYPES_AGENDA.autre;
    return l[enAnglais ? 1 : 0];
  }
  function dateAgenda(debut, fin, enAnglais) {
    const langue = enAnglais ? 'en-GB' : 'fr-FR';
    const d = new Date(debut + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '';
    const complet = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    if (!fin || fin === debut) return d.toLocaleDateString(langue, complet);
    const f = new Date(fin + 'T12:00:00');
    return d.toLocaleDateString(langue, { day: 'numeric', month: 'short' }) + ' – ' + f.toLocaleDateString(langue, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function dateDuJour(d = new Date()) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function separerAgenda(projets) {
    const jour = dateDuJour();
    const cle = p => String(p.date_debut || '');
    const tries = (projets || []).slice().sort((x, y) => {
      if (cle(x) === cle(y)) return 0;
      return cle(x) < cle(y) ? -1 : 1;
    });
    return {
      avenir: tries.filter(p => (p.date_fin || p.date_debut) >= jour),
      passes: tries.filter(p => (p.date_fin || p.date_debut) < jour).reverse()
    };
  }
  racine.Partage = { titreLisible, MA2M_TYPES_AGENDA, libelleTypeAgenda, dateAgenda, dateDuJour, separerAgenda };
  racine.ListesFormulaires = { VILLES_CI, COMMUNES_ABIDJAN, INDICATIFS_PAYS, indicatifsAffiches, optionsIndicatifs, optionsListe, optionsNombres, remplirSelectsHtml };
})(typeof window !== 'undefined' ? window : globalThis);
