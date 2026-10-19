// Fichier Excel (.xlsx) fabriqué dans le navigateur, sans outil extérieur : un classeur de
// plusieurs feuilles (journaux et états du « Dossier du mois », espace 3). Un .xlsx est un
// dossier compressé (zip) de fichiers XML : on l'écrit ici « sans compression », ce qu'Excel,
// LibreOffice et Google Sheets lisent sans problème.
// P.xlsx([{ nom, lignes: [[valeur…]…], largeurs: [nombre…] }]) → Blob ; la 1re ligne de
// chaque feuille est en gras ; les nombres restent des nombres (sommes possibles dans Excel).
(function () {
  'use strict';
  const P = window.Portail;
  const TABLE_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(octets) {
    let c = 0xffffffff;
    for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  // Zip « stocké » (sans compression) : fichiers [{ nom, octets }] → Uint8Array
  function zip(fichiers) {
    const enc = new TextEncoder(), morceaux = [], central = [];
    let decalage = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff], u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    fichiers.forEach((f) => {
      const nom = enc.encode(f.nom), crc = crc32(f.octets), taille = f.octets.length;
      // version 20, drapeau 0x0800 (noms en UTF-8), méthode 0 (stocké), date 01/01/1980
      const commun = [].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(taille), u32(taille), u16(nom.length), u16(0));
      const local = new Uint8Array([].concat(u32(0x04034b50), commun));
      morceaux.push(local, nom, f.octets);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), commun, u16(0), u16(0), u16(0), u32(0), u32(decalage))), nom);
      decalage += local.length + nom.length + taille;
    });
    const tailleCentral = central.reduce((s, c) => s + c.length, 0);
    const fin = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(fichiers.length), u16(fichiers.length), u32(tailleCentral), u32(decalage), u16(0)));
    const tout = morceaux.concat(central, [fin]);
    const sortie = new Uint8Array(tout.reduce((s, c) => s + c.length, 0));
    let o = 0;
    tout.forEach((c) => { sortie.set(c, o); o += c.length; });
    return sortie;
  }
  const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  function colonne(i) { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
  function feuille(f) {
    const cols = (f.largeurs || []).map((l, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + l + '" customWidth="1"/>').join('');
    const rangs = f.lignes.map((l, r) => '<row r="' + (r + 1) + '">' + l.map((v, c) => {
      const ref = colonne(c) + (r + 1), style = r === 0 ? ' s="1"' : typeof v === 'number' ? ' s="2"' : '';
      if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + style + '><v>' + v + '</v></c>';
      return v == null || v === '' ? '' : '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' + xml(v) + '</t></is></c>';
    }).join('') + '</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + rangs + '</sheetData></worksheet>';
  }
  P.xlsx = (feuilles) => {
    const enc = new TextEncoder();
    const noms = feuilles.map((f, i) => (String(f.nom).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Feuille ' + (i + 1)));
    const fichiers = [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        feuilles.map((f, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        noms.map((n, i) => '<sheet name="' + xml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        feuilles.map((f, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
        '<Relationship Id="rId' + (feuilles.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      // styles : 0 normal, 1 en-tête en gras, 2 nombre avec séparateur de milliers
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']
    ].concat(feuilles.map((f, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', feuille(f)]));
    return new Blob([zip(fichiers.map((f) => ({ nom: f[0], octets: enc.encode(f[1]) })))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };
})();
