-- =====================================================================================
-- Textes de l'Administration en anglais sur les pages anglaises (26/10/2026, demande de la propriétaire)
-- =====================================================================================
-- Les textes saisis dans l'Administration (actualités, événements, agenda, partenaires, mot du
-- fondateur, présentations des mannequins…) restaient en français sur les pages anglaises.
-- traductions_en garde, pour chaque texte français, sa version anglaise ; les pages anglaises la
-- cherchent par l'empreinte du texte (js/app.js, versAnglais) et gardent le français s'il n'y en a pas.
-- Lecture publique de l'empreinte et de l'anglais seulement (jamais du texte français : une
-- présentation de mannequin non publiée ne sort pas) ; écriture : l'équipe du site
-- (Administration › Traductions anglaises). À exécuter une fois ; peut être relancé sans risque.

create or replace function traduction_cle(t text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(btrim(coalesce(t, ''), E' \t\r\n'), 'UTF8')), 'hex');
$$;

create table if not exists traductions_en (
  cle text primary key,
  fr text not null check (length(fr) between 1 and 20000),
  en text not null check (length(btrim(en)) between 1 and 20000),
  maj timestamptz not null default now(),
  par uuid references auth.users(id) default auth.uid()
);
-- la clé suit toujours le texte français
create or replace function traductions_en_cle()
returns trigger language plpgsql as $$
begin
  new.cle := traduction_cle(new.fr); new.maj := now();
  return new;
end;
$$;
drop trigger if exists trg_traductions_en_cle on traductions_en;
create trigger trg_traductions_en_cle before insert or update on traductions_en
  for each row execute function traductions_en_cle();

alter table traductions_en enable row level security;
revoke all on traductions_en from anon, authenticated;
grant select (cle, en) on traductions_en to anon, authenticated;
drop policy if exists "Traductions : lecture publique" on traductions_en;
create policy "Traductions : lecture publique" on traductions_en for select using (true);
drop policy if exists "Traductions : équipe du site" on traductions_en;

-- Écriture : par cette seule fonction, pour l'équipe du site ; un anglais vide retire la traduction
create or replace function traduction_enregistrer(p_fr text, p_en text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portail_peut('site') then raise exception 'Accès refusé.'; end if;
  if btrim(coalesce(p_fr, ''), E' \t\r\n') = '' then raise exception 'Texte français vide.'; end if;
  if btrim(coalesce(p_en, ''), E' \t\r\n') = '' then
    delete from traductions_en where cle = traduction_cle(p_fr);
  else
    insert into traductions_en (fr, en) values (p_fr, p_en)
    on conflict (cle) do update set fr = excluded.fr, en = excluded.en, par = auth.uid();
  end if;
end;
$$;
revoke all on function traduction_enregistrer(text, text) from public, anon;
grant execute on function traduction_enregistrer(text, text) to authenticated;

-- Traductions des textes déjà publiés (relues ; les noms propres restent tels quels)
insert into traductions_en (cle, fr, en) select traduction_cle(v.fr), v.fr, v.en from (values
  ('CASTING NEWFACE', 'NEW FACE CASTING'),
  ('Participez à nos castings de chaque dimanche 
Riviera Faya 
De 15 hrs à 18', 'Join our castings every Sunday
Riviera Faya
From 3 pm to 6 pm'),
  ('@jncc_2024
Les 10 ans de la #JNCC viennent de se refermer avec un somptueux défilé à l''occasion du CACAO FASHION SHOW qui s''est tenu sur 2 jours de festivités . 
2 jours de mode , 2 jours de créativité où la créativité des créateurs s''est révélée. 
Les 02 et 03 Septembre au @parcdesexpositions_abidjan s''est tenue le CACAO FASHION SHOW. 

Nos mannequins y étaient . 

Découvrez les images dans les somptueuses créations de l''immense créateur de mode @gilles_toure 

Photos : @authentiquefortographie225ci  et @Grouilleur3.0 

Models: @bolli_emmanuella
@divinetama_
@miss_ci_iffou_2024 
@Emliss
@elvira_zouleikha 
@Melina
@therealncl 

Booking model:
E-mail: infos.ma2m@gmail.com 
Tel: 0545656687/ 2122803580', '@jncc_2024
The 10th anniversary of #JNCC has just closed with a sumptuous runway show at the CACAO FASHION SHOW, held over 2 days of festivities.
2 days of fashion, 2 days of creativity in which the designers'' talent shone through.
The CACAO FASHION SHOW took place on 2 and 3 September at @parcdesexpositions_abidjan.

Our models were there.

Discover the pictures in the sumptuous creations of the great fashion designer @gilles_toure

Photos: @authentiquefortographie225ci and @Grouilleur3.0

Models: @bolli_emmanuella
@divinetama_
@miss_ci_iffou_2024
@Emliss
@elvira_zouleikha
@Melina
@therealncl

Model booking:
Email: infos.ma2m@gmail.com
Phone: 0545656687 / 2122803580'),
  ('✨ LINGERIE AFRICA – 2ᵉ ÉDITION ✨', '✨ LINGERIE AFRICA, 2ND EDITION ✨'),
  ('<h2>✨ <strong>LINGERIE AFRICA – 2ᵉ ÉDITION</strong> ✨</h2><p><br></p><h2>Le rendez-vous incontournable de l’industrie de la lingerie africaine revient pour sa <strong>2ᵉ édition</strong> !</h2><p><br></p><h2>🗓️ <strong>Dates : 27 &amp; 28 novembre 2026</strong></h2><h2> 📍 <strong>Lieu : Sofitel Abidjan Hôtel Ivoire – Abidjan, Côte d’Ivoire</strong></h2><p><br></p><h3>Venez découvrir, rencontrer et échanger avec les acteurs majeurs de l’univers de la lingerie africaine lors de ce salon dédié à une industrie en pleine évolution.</h3><h3>🌍 <em>Lingerie Africa</em>, c’est la plateforme d’opportunités, de découvertes et de réseautage pour les professionnels, marques, créateurs et passionnés du secteur.</h3><p><br></p><h3>🔗 <strong>Site web :</strong> www.salonlingerieafrique.com</h3><h3> 📞 <strong>Contact :</strong> +225 07 18 256 928</h3><h3>👉 <strong>Rendez-vous les 27 &amp; 28 novembre 2026 au Sofitel Abidjan Hôtel Ivoire !</strong></h3><p><br></p><h2>#LingerieAfrica #SalonLingerieAfrique #Lingerie #ModeAfricaine #IndustrieAfricaine #MadeInAfrica #Abidjan #CotedIvoire #Evenement2026 #LingerieAfricaine</h2><p><br></p><p><br></p><p><br></p><p><br></p>', '<h2>✨ <strong>LINGERIE AFRICA, 2ND EDITION</strong> ✨</h2><p><br></p><h2>The must-attend event of the African lingerie industry is back for its <strong>2nd edition</strong>!</h2><p><br></p><h2>🗓️ <strong>Dates: 27 &amp; 28 November 2026</strong></h2><h2> 📍 <strong>Venue: Sofitel Abidjan Hôtel Ivoire, Abidjan, Côte d’Ivoire</strong></h2><p><br></p><h3>Come and discover, meet and talk with the key players of the African lingerie world at this trade show dedicated to a fast-growing industry.</h3><h3>🌍 <em>Lingerie Africa</em> is the platform for opportunities, discoveries and networking for professionals, brands, designers and enthusiasts of the sector.</h3><p><br></p><h3>🔗 <strong>Website:</strong> www.salonlingerieafrique.com</h3><h3> 📞 <strong>Contact:</strong> +225 07 18 256 928</h3><h3>👉 <strong>See you on 27 &amp; 28 November 2026 at the Sofitel Abidjan Hôtel Ivoire!</strong></h3><p><br></p><h2>#LingerieAfrica #SalonLingerieAfrique #Lingerie #ModeAfricaine #IndustrieAfricaine #MadeInAfrica #Abidjan #CotedIvoire #Evenement2026 #LingerieAfricaine</h2>'),
  ('CASTING GTCO FSHN WKND', 'GTCO FSHN WKND CASTING'),
  ('<h2>*CASTING FEMME UNIQUEMENT*</h2><h3>Date : 24 septembre à 14H00 </h3><h3>Lieu : Seen hotel (plateau) </h3><h3>- TENUE : Top blanc + jean bleu + talons noirs</h3><h3>- CHEVEUX NATURELS en chignon simple à l''arrière ou nattes simples </h3><h3>- ❌PAS DE MAQUILLAGE</h3>', '<h2>*WOMEN ONLY CASTING*</h2><h3>Date: 24 September at 2 pm</h3><h3>Venue: Seen Hotel (Plateau)</h3><h3>- OUTFIT: white top + blue jeans + black heels</h3><h3>- NATURAL HAIR in a simple bun at the back or simple braids</h3><h3>- ❌NO MAKE-UP</h3>'),
  ('FOLIE DE MODE 14', 'FOLIES DE MODE 14'),
  ('<p>Les 5 et 6 novembre 2026, Ouagadougou accueillera la 14ᵉ édition des Folies de Mode, à Easy Auto.</p><p>Cette nouvelle édition, placée sous le thème « Mode africaine &amp; diplomatie culturelle », affirme une ambition forte : faire de la mode un langage de dialogue entre les cultures.</p><p>« Au-delà des frontières, la mode tisse des liens… »</p><p>Cette signature résume l''esprit de l''événement, qui célèbre des cultures différentes réunies autour d''une même élégance.</p><p>Quatre axes pour l''édition 2026</p><p>La création : révéler le talent des designers africains.</p><p>Les échanges : rapprocher les professionnels du secteur.</p><p>L''influence : affirmer le poids de la mode africaine à l''international.</p><p>Le rayonnement : porter une image fière et moderne du continent.</p><p>Rendez-vous</p><p>📍 Ouagadougou — Easy Auto</p><p>📅 5 et 6 novembre 2026</p><p>Une édition sous le signe du dialogue, de la mode et de l''avenir.</p><p>L''Afrique, plus grande que jamais.</p>', '<p>On 5 and 6 November 2026, Ouagadougou will host the 14th edition of Folies de Mode, at Easy Auto.</p><p>Under the theme “African fashion &amp; cultural diplomacy”, this new edition sets a strong ambition: making fashion a language of dialogue between cultures.</p><p>“Beyond borders, fashion weaves bonds…”</p><p>This signature sums up the spirit of the event, which celebrates different cultures brought together by the same elegance.</p><p>Four pillars for the 2026 edition</p><p>Creation: revealing the talent of African designers.</p><p>Exchange: bringing the industry''s professionals closer together.</p><p>Influence: asserting the weight of African fashion internationally.</p><p>Reach: carrying a proud and modern image of the continent.</p><p>Save the date</p><p>📍 Ouagadougou, Easy Auto</p><p>📅 5 and 6 November 2026</p><p>An edition placed under the sign of dialogue, fashion and the future.</p><p>Africa, greater than ever.</p>'),
  ('Événements', 'Events'),
  ('<p>Afik Fashion Week 2026 : la mode africaine donne rendez-vous à Abidjan</p><p>La mode africaine sera à l’honneur à Abidjan en novembre 2026 à l’occasion de l’Afik Fashion Week, un rendez-vous placé sous le signe de la mode, de la créativité et de l’Afrique.</p><p>Cette édition se tiendra au Sofitel Abidjan Hôtel Ivoire, avec l’ambition de réunir créateurs, mannequins, professionnels de la mode et passionnés autour d’un événement consacré à la création africaine.</p><p>À travers ses collections, ses rencontres et ses différents temps forts, l’Afik Fashion Week entend mettre en lumière le savoir-faire, l’identité et la créativité de la mode africaine, tout en favorisant les échanges entre les différents acteurs du secteur.</p><p>L’événement est porté par Avant Garde Production.</p><p>Afik Fashion Week 2026 — Rendez-vous en novembre à Abidjan.</p><p>Plus d’informations :</p><p>📞 07 49 13 53 53 / 07 08 31 27 49</p><p>📍 Sofitel Abidjan Hôtel Ivoire</p>', '<p>Afik Fashion Week 2026: African fashion meets in Abidjan</p><p>African fashion will be in the spotlight in Abidjan in November 2026 at the Afik Fashion Week, an event dedicated to fashion, creativity and Africa.</p><p>This edition will take place at the Sofitel Abidjan Hôtel Ivoire, with the ambition of bringing together designers, models, fashion professionals and enthusiasts around an event devoted to African creation.</p><p>Through its collections, meetings and highlights, the Afik Fashion Week aims to showcase the know-how, identity and creativity of African fashion, while encouraging exchanges between the industry''s players.</p><p>The event is organised by Avant Garde Production.</p><p>Afik Fashion Week 2026: see you in November in Abidjan.</p><p>More information:</p><p>📞 07 49 13 53 53 / 07 08 31 27 49</p><p>📍 Sofitel Abidjan Hôtel Ivoire</p>'),
  ('AGENDA DES FASHIONS WEEK D''AFRIQUE', 'AFRICAN FASHION WEEKS CALENDAR'),
  ('La mode africaine continue de rayonner

À travers l''Afrique et au sein de sa diaspora, les Fashion Weeks offrent une plateforme essentielle aux créateurs, mannequins, stylistes, photographes et professionnels de l''industrie qui font évoluer l''image de la mode africaine à l''international.

Un agenda pour suivre la saison

L''Africa Fashion Week Association tient à jour un agenda dédié aux grands rendez-vous de la mode africaine et de sa diaspora : nouvelles dates, événements confirmés, temps forts de la saison.

Plus qu''un simple calendrier, cet agenda sert de trait d''union entre les acteurs du secteur. Il aide à anticiper les événements à venir, à mettre en lumière les initiatives locales et à créer des passerelles entre créateurs et professionnels.

Un continent riche en talents

De l''Afrique de l''Ouest à l''Afrique australe, du Nord à l''Est du continent, sans oublier les rendez-vous organisés dans la diaspora, les Fashion Weeks témoignent de la diversité et de la créativité africaines.

Créateurs émergents, maisons établies, mannequins, agences et médias sont invités à rester connectés pour ne manquer aucun des grands rendez-vous de la saison.

La mode africaine est en mouvement. Les talents sont nombreux. Les rendez-vous se multiplient.

Source : Africa Fashion Week Association', 'African fashion keeps shining

Across Africa and its diaspora, Fashion Weeks offer an essential platform to the designers, models, stylists, photographers and industry professionals who are shaping the image of African fashion internationally.

A calendar to follow the season

The Africa Fashion Week Association keeps an up-to-date calendar of the major events of African fashion and its diaspora: new dates, confirmed events, highlights of the season.

More than a simple calendar, it links the players of the industry together. It helps anticipate upcoming events, highlight local initiatives and build bridges between designers and professionals.

A continent rich in talent

From West Africa to Southern Africa, from the North to the East of the continent, not forgetting the events held in the diaspora, Fashion Weeks show the diversity and creativity of Africa.

Emerging designers, established houses, models, agencies and media are invited to stay connected so as not to miss any of the season''s major events.

African fashion is on the move. Talents abound. Events keep multiplying.

Source: Africa Fashion Week Association'),
  ('<h1>Alpha Blondy en concert exceptionnel au Parc des Expositions d''Abidjan</h1><p>Dans le cadre de l''<strong>Abidjan Border Forum 2026</strong> (sous l''égide de l''Union Africaine), le grand icône du reggae <strong>Alpha Blondy</strong> donnera un concert monumental le <strong>22 octobre 2026 à partir de 19h</strong> au <strong>Parc des Expositions d''Abidjan</strong>.</p><h2>Informations Pratiques</h2><ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Artiste :</strong> Alpha Blondy</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Événement :</strong> Abidjan Border Forum 2026</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Date &amp; Heure :</strong> 22 octobre 2026 à 19h00</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Lieu :</strong> Parc des Expositions d''Abidjan</li></ol><h2>Tarifs &amp; Billetterie</h2><p>La billetterie est officiellement ouverte sur <strong>Tikerama</strong>.</p><p>| Catégorie | Prix |</p><p>| :--- | :--- |</p><p>| <strong>Ticket GP</strong> | 30 000 FCFA |</p><p>| <strong>Ticket VIP</strong> | 50 000 FCFA |</p><p><strong>Points de vente physiques :</strong></p><ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Tikerama</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>FNAC (Cap Nord &amp; Cap Sud)</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>LDF</li></ol><h2>Infoline &amp; Contacts</h2><p>Pour toute information complémentaire ou réservation :</p><ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Téléphones :</strong> +225 0707555854 / +225 0555422515</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Email :</strong> strategiescommunications7@gmail.com</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Site Internet :</strong> www.abf-africa.com</li></ol><p><br></p>', '<h1>Alpha Blondy in an exceptional concert at the Parc des Expositions in Abidjan</h1><p>As part of the <strong>Abidjan Border Forum 2026</strong> (under the aegis of the African Union), reggae icon <strong>Alpha Blondy</strong> will give a monumental concert on <strong>22 October 2026 from 7 pm</strong> at the <strong>Parc des Expositions in Abidjan</strong>.</p><h2>Practical information</h2><ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Artist:</strong> Alpha Blondy</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Event:</strong> Abidjan Border Forum 2026</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Date &amp; time:</strong> 22 October 2026 at 7 pm</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Venue:</strong> Parc des Expositions, Abidjan</li></ol><h2>Prices &amp; tickets</h2><p>Ticket sales are officially open on <strong>Tikerama</strong>.</p><p>| Category | Price |</p><p>| :--- | :--- |</p><p>| <strong>GP ticket</strong> | 30,000 FCFA |</p><p>| <strong>VIP ticket</strong> | 50,000 FCFA |</p><p><strong>Points of sale:</strong></p><ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>Tikerama</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>FNAC (Cap Nord &amp; Cap Sud)</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>LDF</li></ol><h2>Infoline &amp; contacts</h2><p>For any further information or booking:</p><ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Phone:</strong> +225 0707555854 / +225 0555422515</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Email:</strong> strategiescommunications7@gmail.com</li><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span><strong>Website:</strong> www.abf-africa.com</li></ol>'),
  ('CASTING SILA', 'SILA CASTING'),
  ('<p>🔴 PRÉ-CASTING MANNEQUINS</p><p><br></p><p>LINGERIE AFRICA </p><p>SALON DE L’INDUSTRIE DE LA LINGERIE AFRIQUE</p><p><br></p><p>Vous  souhaitez participer à un événement dédié à l’univers de la lingerie, de la mode et de la création africaine ?</p><p><br></p><p>Le SILA lance le PRÉ-CASTING DE MANNEQUINS FÉMININS pour participer aux prochains défilés de Lingerie Africa.</p><p><br></p><p>✨ PROFIL RECHERCHÉ</p><p><br></p><p>• Être âgée de 21 ans ou plus</p><p>• Être naturelle</p><p>• Avoir une bonne présentation et une belle attitude</p><p>• Être à l’aise avec le port et le défilé en lingerie</p><p>• Être disponible, sérieuse et professionnelle</p><p>• Une expérience dans le mannequinat est un atout</p><p><br></p><p>👠 LE CASTING</p><p><br></p><p>Les candidates présélectionnées pourront être retenues pour participer aux défilés et activités de Lingerie Africa, le Salon de l’Industrie de la Lingerie Afrique.</p><p><br></p><p>📞 INFOS &amp; INSCRIPTIONS :</p><p>01 41 98 13 86</p><p><br></p><p>⚠️ PLACES LIMITÉES</p><p><br></p><p>Vous êtes prêtes à relever le défi ?</p><p><br></p><p>🔥 VOTRE PROCHAINE OPPORTUNITÉ PEUT COMMENCER ICI.</p><p><br></p><p>Postulez via WhatsApp 👉🏿👉🏿https://wa.me/qr/PG6X2ZTVAVOME1</p><p>@à la une</p>', '<p>🔴 MODEL PRE-CASTING</p><p><br></p><p>LINGERIE AFRICA</p><p>AFRICAN LINGERIE INDUSTRY TRADE SHOW</p><p><br></p><p>Would you like to take part in an event dedicated to lingerie, fashion and African creation?</p><p><br></p><p>SILA is launching a PRE-CASTING FOR FEMALE MODELS to take part in the upcoming Lingerie Africa runway shows.</p><p><br></p><p>✨ PROFILE WANTED</p><p><br></p><p>• Aged 21 or over</p><p>• Natural</p><p>• Well presented, with a great attitude</p><p>• Comfortable wearing and walking in lingerie</p><p>• Available, serious and professional</p><p>• Modelling experience is a plus</p><p><br></p><p>👠 THE CASTING</p><p><br></p><p>Pre-selected candidates may be chosen to take part in the runway shows and activities of Lingerie Africa, the African Lingerie Industry Trade Show.</p><p><br></p><p>📞 INFO &amp; REGISTRATION:</p><p>01 41 98 13 86</p><p><br></p><p>⚠️ LIMITED PLACES</p><p><br></p><p>Ready to take up the challenge?</p><p><br></p><p>🔥 YOUR NEXT OPPORTUNITY CAN START HERE.</p><p><br></p><p>Apply via WhatsApp 👉🏿👉🏿https://wa.me/qr/PG6X2ZTVAVOME1</p>'),
  ('<p>Abidjan sur son 31 : l''Afrik Fashion Week débarque du 11 au 15 novembre 2026 !</p><p>Avis aux amoureux du style : la capitale ivoirienne s''apprête à enfiler sa plus belle tenue! </p><p>Du 11 au 15 novembre 2026, l''Afrik Fashion Week pose ses valises à Abidjan pour célébrer la mode, la créativité et le savoir-faire africain.</p><p>Organisé par Avant Garde Production, l''événement promet un fil conducteur captivant entre pièces traditionnelles et haute couture contemporaine. </p><p>Pendant cinq jours, créateurs et mannequins vont défiler pour vous en mettre plein la vue et tailler sur mesure le futur des tendances du continent.</p><p>Pas question de rester sur le carreau ! Prenez date et préparez vos plus belles tenues.</p><p>Infos pratiques :</p><p> * Dates : 11 - 15 Novembre 2026</p><p> * Lieu : Abidjan, Côte d''Ivoire</p><p> * Infoline : +225 07 49 13 53 53 / 07 08 31 27 49</p>', '<p>Abidjan dresses up: Afrik Fashion Week arrives from 11 to 15 November 2026!</p><p>Calling all style lovers: the Ivorian capital is about to put on its finest outfit!</p><p>From 11 to 15 November 2026, Afrik Fashion Week comes to Abidjan to celebrate fashion, creativity and African know-how.</p><p>Organised by Avant Garde Production, the event promises a captivating thread between traditional pieces and contemporary haute couture.</p><p>For five days, designers and models will put on a dazzling show and tailor the future trends of the continent.</p><p>Don''t miss out! Save the date and get your finest outfits ready.</p><p>Practical information:</p><p> * Dates: 11 to 15 November 2026</p><p> * Venue: Abidjan, Côte d''Ivoire</p><p> * Infoline: +225 07 49 13 53 53 / 07 08 31 27 49</p>'),
  ('PARC DES EXPOSITIONS D''ABIDJAN', 'PARC DES EXPOSITIONS, ABIDJAN'),
  ('<p>Créations signées , GILLES TOURE  en collaboration avec la chocolatière Sanata Thiero</p><p>Journée Nationale du Cacao et du Chocolat </p><p>Cacao Fashion Show </p><p>Les 02 et 03 Septembre 2026</p><p>Photos : 30 Studios Agence Créative </p>', '<p>Creations by GILLES TOURE in collaboration with chocolatier Sanata Thiero</p><p>National Cocoa and Chocolate Day</p><p>Cacao Fashion Show</p><p>2 and 3 September 2026</p><p>Photos: 30 Studios Agence Créative</p>'),
  ('<p>Les belles création de la maison K-YELE  de Mme Patricia Waotta en collaboration avec le chocolatier AXEL EMMANUEL </p><p>Journée Nationale du Cacao et du Café </p><p>Cacao Fashion Show </p><p>Les 02 et 03 Septembre 2026</p><p>Photos : 30 Studios Agence Créative </p>', '<p>The beautiful creations of the K-YELE house by Mrs Patricia Waotta in collaboration with chocolatier AXEL EMMANUEL</p><p>National Cocoa and Coffee Day</p><p>Cacao Fashion Show</p><p>2 and 3 September 2026</p><p>Photos: 30 Studios Agence Créative</p>'),
  ('<p>AFRICA IN RHYTHM</p><p><br></p><p><br></p><p>La mode à l''honneur au Noum Hôtel</p><p> Pour célébrer ses 5 ans, le Noum Hôtel a frappé fort. La soirée Africa &amp; Rhythm a transformé l''établissement en véritable scène de mode, le temps d''un défilé où créativité et élégance africaines se sont donné rendez-vous.</p><p>Trois maisons ont porté haut les couleurs de cette célébration : </p><p> Tradition, </p><p> La boutique Yaré</p><p> Kignon. </p><p> Trois univers, trois signatures, unis le temps d''une même soirée sous le signe du style et de l''audace.</p><p>Sur le podium</p><p> Portées avec grâce et assurance, les créations ont pris vie grâce aux mannequins de MAÎTRE AKESSE MODEL MANAGEMENT : </p><p> Tossou Emmanuella, </p><p> Bolli Emmanuella </p><p> Roxane Ouattara. </p><p> Trois silhouettes, une même énergie, celle d''une nouvelle génération de mannequins qui porte fièrement les couleurs de la mode africaine.</p><p> Une soirée où la mode, le rythme et la culture africaine se sont rencontrés — le temps d''un défilé, cinq ans se sont célébrés avec panache.</p><p>#AfricaAndRhythm​ #NoomHôtel​ #MaîtreAkesseModelManagement​</p>', '<p>AFRICA IN RHYTHM</p><p><br></p><p><br></p><p>Fashion in the spotlight at the Noom Hotel</p><p> To celebrate its 5th anniversary, the Noom Hotel went all out. The Africa &amp; Rhythm evening turned the hotel into a true fashion stage, for a runway show where African creativity and elegance came together.</p><p>Three houses proudly carried the colours of this celebration:</p><p> Tradition,</p><p> La boutique Yaré</p><p> Kignon.</p><p> Three worlds, three signatures, united for one evening under the sign of style and daring.</p><p>On the runway</p><p> Worn with grace and confidence, the creations came to life thanks to the models of MAÎTRE AKESSE MODEL MANAGEMENT:</p><p> Tossou Emmanuella,</p><p> Bolli Emmanuella</p><p> Roxane Ouattara.</p><p> Three silhouettes, one energy: that of a new generation of models proudly carrying the colours of African fashion.</p><p> An evening where fashion, rhythm and African culture met: for one runway show, five years were celebrated in style.</p><p>#AfricaAndRhythm #NoomHôtel #MaîtreAkesseModelManagement</p>'),
  ('ACMCI (ASSOCIATION DES CRÉATEURS DE MODE DE CÔTE D''IVOIRE)', 'ACMCI (FASHION DESIGNERS ASSOCIATION OF CÔTE D''IVOIRE)'),
  ('Autre', 'Other'),
  ('ACMCI (ASSOCIATION DES CRÉATEURS DE MODE DE CÔTE D''IVOIRE)

 Dirigée par Mme NADIA DRUIDE', 'ACMCI (FASHION DESIGNERS ASSOCIATION OF CÔTE D''IVOIRE)

Led by Mrs NADIA DRUIDE'),
  ('Promoteur', 'Promoter'),
  ('✨ PRÉSENTATION DE LA MARQUE CHA KANE

CHA KANE est une marque ivoirienne portée par la créatrice de mode Aïssata Kane, dite « Cha Kane ». Elle met à l’honneur le savoir-faire africain à travers la création de vêtements, d’accessoires et la valorisation des textiles locaux, notamment le pagne.

À travers son univers, Cha Kane défend une mode africaine moderne, créative et authentique, en faisant du pagne un véritable support d’expression artistique et culturelle.

FESTIVAL ABIDJAN PAGNE

Cha Kane est également l’initiatrice du Festival Abidjan Pagne, un événement majeur dédié à la promotion du pagne, de la mode et du savoir-faire africain.

Créé en 2018, le festival rassemble créateurs, stylistes, mannequins, artisans et passionnés de mode autour de défilés, expositions, panels et animations culturelles. Son objectif est de valoriser le pagne, les cultures et les traditions africaines, tout en encourageant la créativité et le développement de l’industrie textile. 1

Le Festival Abidjan Pagne s’est notamment poursuivi avec une 6e édition consacrée à la réflexion autour de l’industrie du pagne et de son rayonnement à l’international.


✨ CHA KANE, C’EST DONC UNE VISION DE LA MODE QUI ASSOCIE CRÉATIVITÉ, IDENTITÉ AFRICAINE, VALORISATION DU PAGNE ET PROMOTION DU SAVOIR-FAIRE IVOIRIEN.
``', '✨ ABOUT THE CHA KANE BRAND

CHA KANE is an Ivorian brand created by fashion designer Aïssata Kane, known as “Cha Kane”. It celebrates African know-how through clothing and accessories and by showcasing local textiles, especially the pagne (wax print fabric).

Through her world, Cha Kane stands for a modern, creative and authentic African fashion, making the pagne a true medium of artistic and cultural expression.

FESTIVAL ABIDJAN PAGNE

Cha Kane is also the founder of the Festival Abidjan Pagne, a major event dedicated to promoting the pagne, fashion and African know-how.

Created in 2018, the festival brings together designers, stylists, models, artisans and fashion lovers around runway shows, exhibitions, panels and cultural activities. Its aim is to showcase the pagne, African cultures and traditions, while encouraging creativity and the growth of the textile industry.

The Festival Abidjan Pagne continued with a 6th edition focused on the pagne industry and its international reach.

✨ CHA KANE IS A VISION OF FASHION THAT BRINGS TOGETHER CREATIVITY, AFRICAN IDENTITY, THE PAGNE AND IVORIAN KNOW-HOW.'),
  ('DJIGUI-YA AGENCE

Djigui-Ya Agence est une agence ivoirienne spécialisée dans l’accueil, l’hôtessariat et l’accompagnement des événements professionnels à Abidjan.

Créée en 2011 par Kankou Samaké, l’agence accompagne depuis plusieurs années des événements institutionnels, culturels, commerciaux et professionnels en Côte d’Ivoire.

Djigui-Ya Agence a notamment participé à des événements tels que Miss Côte d’Ivoire, Afrik Fashion Show, le gala de Children of Africa, les Jayli Awards et le SIREXE.

En 2026, l’agence célèbre ses 15 années d’existence, témoignant de son expérience et de son implantation dans le secteur événementiel ivoirien.

DJIGUI-YA AGENCE
L’accueil, le professionnalisme et l’excellence au service de vos événements.', 'DJIGUI-YA AGENCE

Djigui-Ya Agence is an Ivorian agency specialising in hospitality, hostess services and support for professional events in Abidjan.

Founded in 2011 by Kankou Samaké, the agency has supported institutional, cultural, commercial and professional events in Côte d’Ivoire for many years.

Djigui-Ya Agence has taken part in events such as Miss Côte d’Ivoire, Afrik Fashion Show, the Children of Africa gala, the Jayli Awards and SIREXE.

In 2026, the agency celebrates 15 years of existence, a sign of its experience and its place in the Ivorian events sector.

DJIGUI-YA AGENCE
Hospitality, professionalism and excellence at the service of your events.'),
  ('Styliste', 'Designer'),
  ('✨ PRÉSENTATION DE LA MAISON DE COUTURE GILLES TOURÉ – ABIDJAN

La Maison de Couture Gilles Touré est l’une des références emblématiques de la haute couture ivoirienne.

Basée à Abidjan, la maison est reconnue pour son savoir-faire, son élégance et ses créations qui associent harmonieusement l’identité africaine aux tendances modernes.

Le créateur Gilles Touré s’est imposé au fil des années comme une figure majeure de la mode en Côte d’Ivoire et en Afrique de l’Ouest.

La maison propose notamment des créations sur mesure : robes de soirée, robes de gala, robes de mariée, ensembles en tissus africains et différentes pièces haute couture.

À travers ses collections, Gilles Touré met en avant la féminité, le raffinement, la créativité et la richesse des textiles africains.

La Maison Gilles Touré représente ainsi une mode ivoirienne élégante, sophistiquée et ouverte sur l’international.

📍 Localisation : Abidjan, Côte d’Ivoire
👗 Spécialité : Haute couture et créations sur mesure
✨ Style : Élégant, féminin, moderne et africain', '✨ ABOUT THE GILLES TOURÉ COUTURE HOUSE, ABIDJAN

The Gilles Touré Couture House is one of the iconic names of Ivorian haute couture.

Based in Abidjan, the house is known for its know-how, its elegance and creations that harmoniously combine African identity with modern trends.

Over the years, designer Gilles Touré has become a major figure of fashion in Côte d’Ivoire and West Africa.

The house offers made-to-measure creations: evening dresses, gala gowns, wedding dresses, outfits in African fabrics and various haute couture pieces.

Through his collections, Gilles Touré highlights femininity, refinement, creativity and the richness of African textiles.

The Gilles Touré house thus represents an elegant, sophisticated Ivorian fashion open to the world.

📍 Location: Abidjan, Côte d’Ivoire
👗 Speciality: haute couture and made-to-measure creations
✨ Style: elegant, feminine, modern and African'),
  ('FESTIVAL INTERNATIONAL DU BAZIN ET DU TEXTILE AFRICAIN', 'INTERNATIONAL FESTIVAL OF BAZIN AND AFRICAN TEXTILES'),
  ('DA', 'Artistic Director'),
  ('Chaque grand parcours commence par un rêve. Le nôtre a commencé ici, à Abidjan, porté par une conviction simple : le mannequinat ivoirien mérite un accompagnement sérieux, exigeant et humain. J''ai fondé Maître Akesse Model Management pour donner à chaque talent les moyens de construire une vraie carrière, pas à pas, avec rigueur et bienveillance. Cette agence, je la vois comme une famille où chaque profil est préparé, protégé et poussé vers le meilleur de lui-même. Merci de faire partie de cette aventure, ou de vous apprêter à la rejoindre.', 'Every great journey begins with a dream. Ours began here, in Abidjan, driven by a simple conviction: Ivorian modelling deserves serious, demanding and caring guidance. I founded Maître Akesse Model Management to give every talent the means to build a real career, step by step, with rigour and kindness. I see this agency as a family, where every profile is prepared, protected and pushed towards the best of itself. Thank you for being part of this adventure, or for getting ready to join it.'),
  ('AFRICA IN RHYTHM
La mode à l''honneur au Noum Hôtel
 Pour célébrer ses 5 ans, le Noum Hôtel a frappé fort. La soirée Africa & Rhythm a transformé l''établissement en véritable scène de mode, le temps d''un défilé où créativité et élégance africaines se sont donné rendez-vous.
Trois maisons ont porté haut les couleurs de cette célébration : 
 Tradition, 
 La boutique Yaré
 Kignon. 
 Trois univers, trois signatures, unis le temps d''une même soirée sous le signe du style et de l''audace.
Sur le podium
 Portées avec grâce et assurance, les créations ont pris vie grâce aux mannequins de MAÎTRE AKESSE MODEL MANAGEMENT : 
 Tossou Emmanuella, 
 Bolli Emmanuella 
 Roxane Ouattara. 
 Trois silhouettes, une même énergie, celle d''une nouvelle génération de mannequins qui porte fièrement les couleurs de la mode africaine.
 Une soirée où la mode, le rythme et la culture africaine se sont rencontrés — le temps d''un défilé, cinq ans se sont célébrés avec panache.
#AfricaAndRhythm​ #NoomHôtel​ #MaîtreAkesseModelManagement​', 'AFRICA IN RHYTHM
Fashion in the spotlight at the Noom Hotel
To celebrate its 5th anniversary, the Noom Hotel went all out. The Africa & Rhythm evening turned the hotel into a true fashion stage, for a runway show where African creativity and elegance came together.
Three houses proudly carried the colours of this celebration:
Tradition,
La boutique Yaré
Kignon.
Three worlds, three signatures, united for one evening under the sign of style and daring.
On the runway
Worn with grace and confidence, the creations came to life thanks to the models of MAÎTRE AKESSE MODEL MANAGEMENT:
Tossou Emmanuella,
Bolli Emmanuella
Roxane Ouattara.
Three silhouettes, one energy: that of a new generation of models proudly carrying the colours of African fashion.
An evening where fashion, rhythm and African culture met: for one runway show, five years were celebrated in style.
#AfricaAndRhythm #NoomHôtel #MaîtreAkesseModelManagement'),
  ('PARC DES EXPOSITIONS ET LATRILLE EVENT', 'PARC DES EXPOSITIONS AND LATRILLE EVENT'),
  ('Je suis mannequin depuis deux ans au sein de l’agence Maître Akesse Modèles. J’ai eu l’opportunité de participer à plusieurs défilés pour Monsieur Pathéo, Daddy Gilles Touré et Madame Olivia Pérez.
J’ai également participé à la 10ᵉ édition de la JNCC ainsi qu’au Grand-Bassam Fashion Day, 4ᵉ édition, où j’ai eu l’honneur de défiler pour Chan Kan, Ange Daddy et Wafa Haute Couture, dans des tenues toutes plus splendides les unes que les autres.', 'I have been a model with the Maître Akesse agency for two years. I have had the opportunity to walk in several shows for Mr Pathé''O, Daddy Gilles Touré and Mrs Olivia Pérez.
I also took part in the 10th edition of the JNCC and in the 4th edition of Grand-Bassam Fashion Day, where I had the honour of walking for Cha Kane, Ange Daddy and Wafa Haute Couture, in outfits each more splendid than the last.'),
  ('Divine Tama mannequin internationale ivoirienne plus de 5 ans d’expérience', 'Divine Tama, international Ivorian model with more than 5 years of experience.'),
  ('Je suis Cedrick Attobra, mannequin podium,model photo.Je suis  basé à Abidjan, passionné par la mode, le style et l’expression artistique. À travers mes expériences en défilés, shootings et événements, j’ai développé une présence mêlant élégance, créativité et authenticité.
Mon style se distingue par une élégance moderne, les influences africaines, les coupes originales et le streetwear chic. Ce qui me caractérise : ma personnalité, mon adaptabilité et ma capacité à donner une identité unique à chaque création que je porte.', 'I am Cedrick Attobra, a runway and photo model based in Abidjan, passionate about fashion, style and artistic expression. Through runway shows, photo shoots and events, I have developed a presence that blends elegance, creativity and authenticity.
My style stands out for its modern elegance, African influences, original cuts and chic streetwear. What defines me: my personality, my adaptability and my ability to give a unique identity to every creation I wear.'),
  ('Plusieurs années d’expérience dans la mode, entre podiums et shootings.

J’ai eu l’occasion de défiler pour des références de la mode ivoirienne telles que Pathé’O, Gilles Touré, Ciss St Moïse, Rocard Yapo, Les Créations Ange Dady, entre autres.

À cela s’ajoutent de nombreux défilés privés, campagnes, shootings et événements mode, avec des collaborations variées.', 'Several years of experience in fashion, between runways and photo shoots.

I have walked for leading names of Ivorian fashion such as Pathé''O, Gilles Touré, Ciss St Moïse, Rocard Yapo and Les Créations Ange Dady, among others.

On top of that come many private shows, campaigns, photo shoots and fashion events, with a wide range of collaborations.'),
  ('Je suis Diomande Roxane mannequin podiums et modèle photo étant new face je consacre l’entière partie de mon temps à la formation afin d’acquérir toute les compétences requises pour une carrière professionnelle réussite.', 'I am Roxane Diomande, a runway and photo model. As a New Face, I devote all my time to training in order to gain every skill needed for a successful professional career.'),
  ('Hello 👋 My name is OLA_Steph a professional model of maitre akesse modeling agency

Bonjour 👋 Je m''appelle OLA_Steph, mannequin professionnel de l''agence Maître Akesse Modeling Agency.', 'Hello 👋 My name is OLA_Steph, a professional model with the Maître Akesse Model Management agency.'),
  ('J''ai deja fait un concour de mise port bouett et j''ai deja fait du manniquina dans mon ecole moi mon style ces de defiler pour des marque et autre ', 'I have already taken part in a beauty pageant in Port-Bouët and done some modelling at my school. My style is walking for brands and more.'),
  ('Mannequin et modèle photo, élégante et passionnée par l’univers de la mode et de l’image.', 'Runway and photo model, elegant and passionate about the world of fashion and image.'),
  ('Je suis Renée N’DRI, mannequin professionnel. Je suis une personne dynamique, altruiste et joyeuse, avec une grande aisance devant la caméra. Photogénique et à l’aise dans différents univers, je peux aussi bien m’exprimer à travers la photographie et la publicité que sur les podiums lors de défilés. Passionnée par le monde de la mode, je suis toujours prête à relever de nouveaux défis et à mettre mon image et mon énergie au service de chaque projet.', 'I am Renée N’Dri, a professional model. I am dynamic, caring and cheerful, and very much at ease in front of the camera. Photogenic and comfortable in many different worlds, I can express myself through photography and advertising as well as on the runway. Passionate about fashion, I am always ready to take on new challenges and to put my image and energy at the service of every project.'),
  ('Je suis fille ambitieuse et travailleuses, je me distingue par mon charisme et ma personnalité ', 'I am an ambitious and hard-working young woman, and I stand out for my charisma and my personality.'),
  ('Jeune Ivoirienne passionnée de mode et de beauté . 

Expériences en mannequinat, concours de beauté, shootings et comunication.

Je me définis par l’élégance, le dynamisme et le professionnalisme , je suis ouverte aux opportunités dans ces domaines.', 'Young Ivorian woman passionate about fashion and beauty.

Experience in modelling, beauty pageants, photo shoots and communication.

I define myself by elegance, energy and professionalism, and I am open to opportunities in these fields.'),
  ('Je suis Sensuella Kante, mannequin podium et model photo ivoirienne. J’ai eu l’occasion de défiler pour plusieurs stylistes d’Afrique, notamment, M. Ciss St Moïse, Mme Patricia Waotta… ces années de pratiques m’ont appris à travailler les attitudes essentielles à une carrière empreinte de professionnalisme. Je suis également égérie pour plusieurs marques, comme Cha Kane… plusieurs projets artistiques. 
Pour ne citer que ça.', 'I am Sensuella Kanté, an Ivorian runway and photo model. I have had the opportunity to walk for several African designers, including Mr Ciss St Moïse and Mrs Patricia Waotta. These years of practice have taught me the attitudes essential to a career built on professionalism. I am also the face of several brands, such as Cha Kane, and of several artistic projects, to name just a few.'),
  ('Je suis Angela J’ai commencé le mannequinat il y’a 3 ans à Abidjan, j’ai défilé pour plusieurs créateurs ivoirien ex Patrick Asso et Ibrahim Fernandez et plusieurs autres. J’ai shooté pour la marque (ALDO) et (KIABI) et INDIGO et plusieurs autres…', 'I am Angela. I started modelling 3 years ago in Abidjan and have walked for several Ivorian designers, such as Patrick Asso and Ibrahim Fernandez, among others. I have done photo shoots for brands such as ALDO, KIABI and INDIGO, among others.'),
  ('Je suis Cherif Mellina, mannequin au sein de l’agence Maitre Akesse Model Management depuis 1ans, notamment étudiante J’aime particulièrement l’univers du mannequinat et les différents projets qu’il offre.', 'I am Mellina Cherif, a model with Maître Akesse Model Management for 1 year, and also a student. I particularly love the world of modelling and the many projects it offers.'),
  ('Je m''appelle Germaine Kouamé. Commerciale et secrétaire administrative au sein d''un centre de formation de football, je vis également une aventure passionnante dans l''univers de la mode. Pour moi, la mode est un challenge, une thérapie et un moyen de m''exprimer librement, sans me soucier du regard des autres. Depuis un an, j''évolue au sein de l''équipe de Maître Akéssé Model Management, où je progresse lentement mais sûrement.
À mes débuts, j''avais une peur bleue d''affronter la scène. Pour surmonter ce blocage, je me suis lancé un défi de taille pour l''année 2026 [2026] : "Tu peux le faire. Si les autres y arrivent, pourquoi pas toi ? Saisis la toute première opportunité de défilé qui se présente." C''est exactement ce que j''ai fait. Depuis ce jour, la peur du podium a totalement disparu. C''est une immense victoire personnelle, et je tiens à dire un grand merci à Maître Akéssé pour son accompagnement. ', 'My name is Germaine Kouamé. A sales and administrative assistant at a football training centre, I am also living an exciting adventure in the world of fashion. To me, fashion is a challenge, a therapy and a way to express myself freely, without worrying about what others think. For a year now, I have been part of the Maître Akesse Model Management team, where I am progressing slowly but surely.
When I started, I was terrified of going on stage. To overcome this, I set myself a big challenge for 2026: “You can do it. If others can, why not you? Take the very first runway opportunity that comes along.” That is exactly what I did. Since that day, my fear of the runway has completely disappeared. It is a huge personal victory, and I want to say a big thank you to Maître Akesse for the support.'),
  ('Je suis Ophélia Mida, mannequin podium et modèle photo chez Maître Akessé Model Management', 'I am Ophélia Mida, a runway and photo model at Maître Akesse Model Management.'),
  ('Osiris N’goran , mannequin podium et modèle photo chez MAÎTRE AKESSE MODEL MANAGEMENT . Deux (02) années d’expérience dans le domaine de la mode .', 'Osiris N’Goran, runway and photo model at MAÎTRE AKESSE MODEL MANAGEMENT. Two (02) years of experience in fashion.'),
  ('Je me présente comme une personne sociable , extravertie ,disciplinée et passionné par le travail ', 'I describe myself as sociable, outgoing, disciplined and passionate about my work.'),
  ('Je me nomme Monso Joël ange Emmanuel mannequin model photo vidéo et podium , disponible pouvoir afin de vous offrir le meilleur de moi', 'My name is Joël Ange Emmanuel Monso, a photo, video and runway model, available to give you the very best of myself.'),
  ('Hi! I’m Jigger a foreign here in Côte d’Ivoire. I’m working as pastry chef. I’ve been do modeling and commercial back then in my country home. Besides, Modeling is my passion ever since  which is my confidence and discipline builts. It is my world I guess to walk through it and that’s what’s life mean to me. I learn a lot of things like  culture , people which I love the most, doesn’t matter the color, ethnicity , religion, and country. I embrace it as  a family. That’s what’s make me feel like a home full of gratitude and love.', 'Hi! I’m Jigger, a foreigner living in Côte d’Ivoire, where I work as a pastry chef. I did modelling and commercial work back in my home country. Modelling has always been my passion; it is what built my confidence and discipline. It is my world to walk through, and that is what life means to me. I have learnt a lot about cultures and people, which I love the most, whatever their colour, ethnicity, religion or country. I embrace them as family. That is what makes me feel at home, full of gratitude and love.'),
  ('Hello, I am Emmanuella Bolli professional model of the agency master Akéssé model management.

Bonjour, je suis Emmanuella Bolli mannequin professionnel de l’agence maître Akéssé modèle management .', 'Hello, I am Emmanuella Bolli, a professional model with the Maître Akesse Model Management agency.'),
  ('Je suis Elvira Dumas, Mannequin, et financier. Passionnée de mode et de beauté . 
Expériences : - Mannequinat, modèle photo, Concours de beauté.
 Je me définis par l’élégance, le dynamisme et le professionnalisme , je suis ouverte aux opportunités dans ces domaines.', 'I am Elvira Dumas, a model and a finance professional, passionate about fashion and beauty.
Experience: modelling, photo modelling, beauty pageants.
I define myself by elegance, energy and professionalism, and I am open to opportunities in these fields.'),
  ('Mannequin ivoirienne passionnée, mon parcours est marqué par des défilés, des événements et des expériences enrichissantes. Polyvalente et audacieuse, j’allie élégance, charisme et authenticité pour incarner chaque style avec ma propre signature. Mon ambition  faire rayonner mon talent au-delà des frontières.', 'A passionate Ivorian model, my journey has been shaped by runway shows, events and enriching experiences. Versatile and daring, I combine elegance, charisma and authenticity to embody every style with my own signature. My ambition: to make my talent shine beyond borders.'),
  ('Je suis une jeune femme ambitieuse, élégante et passionnée par la beauté, la mode et l’expression de soi. Naturelle, souriante et déterminée, j’aime apprendre, relever de nouveaux défis et mettre en valeur ma personnalité. Je suis motivée à développer mon potentiel dans le monde du mannequinat, à acquérir de nouvelles expériences et à saisir de belles opportunités professionnelles. ✨', 'I am an ambitious, elegant young woman, passionate about beauty, fashion and self-expression. Natural, smiling and determined, I love learning, taking on new challenges and showing my personality. I am motivated to develop my potential in the world of modelling, gain new experience and seize great professional opportunities. ✨'),
  ('Jeune fille dynamique, ayant de l''assurance, intelligente, souriante et désireuse d''apprendre.', 'A dynamic, confident, intelligent and smiling young woman, eager to learn.'),
  ('Défilé', 'Runway show'),
  ('Shoot photo', 'Photo shoot'),
  ('Publicité', 'Advertising')
) as v(fr, en)
on conflict (cle) do nothing;  -- (une traduction corrigée dans l'Administration n'est jamais écrasée)

NOTIFY pgrst, 'reload schema';

-- Contrôle : doit afficher le nombre de traductions (62 ou plus)
select count(*) as traductions_anglaises from traductions_en;
