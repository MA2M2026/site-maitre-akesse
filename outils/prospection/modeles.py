# Modèles d'e-mails de prospection « Atelier Talons & Élégance — offre Entreprises » (validés par la propriétaire, 11/11/2026).
# Aucune adresse e-mail n'est stockée ici (dépôt public) : la liste des destinataires reste hors du dépôt.
# Usage : python3 modeles.py <modele> "<Nom de l'organisation>"  → affiche objet, texte et HTML (JSON)
#   modeles : entreprise | diplomatie | institution | association
import json, sys, html

LIEN = 'https://www.maitreakessemodelmanagement.com/cours-talons'
SIGNATURE = ['Franck AKESSE', 'Coach de démarche · Directeur Artistique', 'Maître Akesse Model Management',
             'Tél. : +225 27 22 23 11 76 · WhatsApp : +225 05 45 65 66 87',
             'infos.ma2m@gmail.com · www.maitreakessemodelmanagement.com']
STOP = 'Si vous ne souhaitez plus recevoir nos messages, il vous suffit de répondre « STOP ».'
OFFRE = ['4 séances, le samedi, dans vos locaux ou dans l’espace de votre choix',
         '4 modules : la posture, la démarche en talons, la prestance, la confiance en soi',
         'théorie et pratique, encadrées par les formatrices de l’agence',
         '30 000 FCFA par participante pour le mois complet, à partir de 10 participantes']

MODELES = {
  'entreprise': {
    'objet': 'L’élégance au travail : un atelier pour les femmes de votre entreprise',
    'attention': 'À l’attention de la Direction des Ressources Humaines',
    'intro': ['À l’accueil, en réunion, face à un client ou lors d’une cérémonie, vos collaboratrices sont la première image de votre entreprise. Leur allure parle avant même qu’elles ne prennent la parole.',
              'Maître Akesse Model Management, agence de mannequins et académie basée à Abidjan, propose aux entreprises <b>l’Atelier Talons &amp; Élégance</b> : un programme d’un mois pour apprendre à vos collaboratrices à se tenir, à marcher en talons avec aisance et à se présenter avec assurance.'],
    'apres': 'C’est un geste fort envers vos équipes, idéal pour préparer le 8 mars, vos séminaires ou vos cérémonies de fin d’année.',
    'fin': 'Nous serions heureux d’échanger avec vous pour construire une proposition adaptée à vos équipes.'},
  'diplomatie': {
    'objet': 'L’élégance au travail : un atelier pour les femmes de votre représentation',
    'attention': 'À l’attention du Service administratif et du Protocole',
    'intro': ['Lors des réceptions, des visites officielles et des cérémonies, les femmes de votre représentation incarnent l’image de votre institution. Leur allure parle avant même qu’elles ne prennent la parole.',
              'Maître Akesse Model Management, agence de mannequins et académie basée à Abidjan, a l’honneur de vous présenter <b>l’Atelier Talons &amp; Élégance</b> : un programme d’un mois pour apprendre aux participantes à se tenir, à marcher en talons avec aisance et à se présenter avec assurance, selon les codes du protocole.'],
    'apres': 'L’atelier s’adresse à votre personnel féminin comme aux réseaux de femmes qui gravitent autour de votre représentation, et peut s’inscrire dans vos actions autour du 8 mars ou de vos réceptions officielles.',
    'fin': 'Nous serions honorés d’échanger avec vous pour construire une proposition adaptée à votre représentation.'},
  'institution': {
    'objet': 'L’élégance au service public : un atelier pour les femmes de votre institution',
    'attention': 'À l’attention du Cabinet et de la Direction des Ressources Humaines',
    'intro': ['À l’accueil des usagers, au protocole, lors des cérémonies et des visites officielles, les femmes de votre institution en sont la première image. Leur allure parle avant même qu’elles ne prennent la parole.',
              'Maître Akesse Model Management, agence de mannequins et académie basée à Abidjan, propose aux institutions <b>l’Atelier Talons &amp; Élégance</b> : un programme d’un mois pour apprendre aux agentes à se tenir, à marcher en talons avec aisance et à se présenter avec assurance.'],
    'apres': 'C’est une action concrète de valorisation des femmes, idéale pour préparer la Journée internationale de la femme du 8 mars ou vos cérémonies officielles.',
    'fin': 'Nous serions honorés d’échanger avec vous pour construire une proposition adaptée à votre institution.'},
  'association': {
    'objet': 'Un atelier d’élégance et de confiance pour les membres de votre association',
    'attention': 'À l’attention de la Présidente et du Bureau',
    'intro': ['Prendre la parole, représenter son association, monter sur une estrade lors d’un gala : l’assurance d’une femme se voit dès ses premiers pas.',
              'Maître Akesse Model Management, agence de mannequins et académie basée à Abidjan, propose aux associations et réseaux de femmes <b>l’Atelier Talons &amp; Élégance</b> : un programme d’un mois pour apprendre à vos membres à se tenir, à marcher en talons avec aisance et à se présenter avec assurance.'],
    'apres': 'C’est une activité qui rassemble, valorise vos membres et prépare idéalement vos galas, vos assemblées ou la Journée internationale de la femme du 8 mars.',
    'fin': 'Nous serions heureux d’échanger avec vous pour construire une proposition adaptée à votre association.'},
}

def sans_balises(t):
    return t.replace('<b>', '').replace('</b>', '').replace('&amp;', '&')

def rendre(modele, organisation):
    m = MODELES[modele]
    att = f"{m['attention']} – {organisation}"
    texte = '\n\n'.join([att, 'Madame, Monsieur,'] + [sans_balises(p) for p in m['intro']] +
        ['En bref :\n' + '\n'.join('- ' + o for o in OFFRE), m['apres'],
         'Vous trouverez notre plaquette en pièce jointe, et une présentation en vidéo ici :\n' + LIEN,
         m['fin'], 'Bien cordialement,', '\n'.join(SIGNATURE), STOP])
    R = '#7C2128'
    p = lambda t: f'<p style="margin:0 0 14px">{t}</p>'
    corps = (f'<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2a1416;max-width:620px">'
        + f'<p style="margin:0 0 18px;font-size:13px;color:#8a6a6d">{html.escape(att)}</p>' + p('Madame, Monsieur,')
        + ''.join(p(t) for t in m['intro'])
        + f'<p style="margin:0 0 6px"><b style="color:{R}">En bref :</b></p><ul style="margin:0 0 14px;padding-left:20px">'
        + ''.join(f'<li>{html.escape(o)}</li>' for o in OFFRE) + '</ul>' + p(m['apres'])
        + p(f'Vous trouverez notre plaquette en pièce jointe, et une présentation en vidéo ici :<br><a href="{LIEN}" style="color:{R};font-weight:bold">Voir la vidéo de l’Atelier Talons &amp; Élégance</a>')
        + p(m['fin']) + p('Bien cordialement,')
        + f'<p style="margin:18px 0 14px;border-left:3px solid {R};padding-left:12px"><b style="color:{R}">{SIGNATURE[0]}</b><br>{SIGNATURE[1]}<br><b>{SIGNATURE[2]}</b><br>'
        + f'<span style="font-size:13px">{SIGNATURE[3]}<br>infos.ma2m@gmail.com · <a href="https://www.maitreakessemodelmanagement.com" style="color:{R}">www.maitreakessemodelmanagement.com</a></span></p>'
        + f'<p style="margin:18px 0 0;font-size:12px;color:#8a6a6d">{STOP}</p></div>')
    return {'objet': m['objet'], 'texte': texte, 'html': corps}

if __name__ == '__main__':
    print(json.dumps(rendre(sys.argv[1], sys.argv[2]), ensure_ascii=False, indent=1))
