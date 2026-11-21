// The Apps Script the student pastes into script.new (from /drive). It runs
// in their own Google account (where their school allows Drive and Gmail
// for Apps Script even when it blocks Classroom for outside apps): finds
// class files, asks Synaptic what to do with them, converts and places
// them, and reports back. Never deletes: old versions go to the bin.

// appsscript.json: only the permissions it needs (and Gmail read-only, not
// full mail access, which GmailApp would otherwise ask for).
export const AGENT_MANIFEST = JSON.stringify(
  {
    timeZone: "Europe/Madrid",
    exceptionLogging: "STACKDRIVER",
    runtimeVersion: "V8",
    oauthScopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/script.external_request",
      "https://www.googleapis.com/auth/script.scriptapp",
    ],
  },
  null,
  2,
);

export function agentScript(baseUrl: string, token: string): string {
  return `// Synaptic · Unificar con Drive
// 1) Ejecuta instalar() una vez y acepta los permisos.
// 2) Ya está: cada hora busca material nuevo, Synaptic decide dónde va y
//    tú lo apruebas en ${baseUrl}/drive. Nunca borra: lo viejo va a la papelera.

var SYNAPTIC = ${JSON.stringify(baseUrl)};
var TOKEN = ${JSON.stringify(token)};
var LIMIT_MS = 300000; // 5 minutos por ejecución; lo que falte, la próxima hora
var T0 = 0;
var LAST_TEXT = null; // texto del último tema convertido, para Synaptic

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sincronizar').timeBased().everyHours(1).create();
  sincronizar();
  console.log('Listo: se sincroniza cada hora. Revisa el plan en ' + SYNAPTIC + '/drive');
}

function sincronizar() {
  T0 = Date.now();
  var runId = new Date().toISOString();
  var found = fuentes_();
  var res = api_({ op: 'sync', found: found.map(function (f) { return { id: f.getId(), name: f.getName(), mimeType: f.getMimeType(), createdAt: f.getDateCreated().toISOString() }; }) });
  if (!res) return;
  // Los enlaces que pegaste en Synaptic: se buscan desde la próxima vez.
  PropertiesService.getUserProperties().setProperty('extraIds', JSON.stringify(res.extraIds || []));
  var results = [], undone = [];
  // Deshacer lo que pediste en Synaptic.
  (res.undo || []).forEach(function (u) {
    try {
      if (u.action === 'trash') DriveApp.getFileById(u.fileId).setTrashed(false); // sacar de la papelera
      else {
        try { DriveApp.getFileById(u.fileId).setTrashed(true); } catch (e) {}
        if (u.oldId) DriveApp.getFileById(u.oldId).setTrashed(false);
      }
      undone.push(u.id);
    } catch (e) { console.log('No se pudo deshacer ' + u.fileId + ': ' + e.message); }
  });
  // Lo aprobado: convertir y colocar.
  var byId = {};
  found.forEach(function (f) { byId[f.getId()] = f; });
  for (var i = 0; i < (res.actions || []).length; i++) {
    if (Date.now() - T0 > LIMIT_MS) { console.log('Pausa por tiempo: sigue la próxima hora'); break; }
    var a = res.actions[i];
    try {
      var src = byId[a.id] || DriveApp.getFileById(a.id);
      results.push(colocar_(src, a.target));
    } catch (e) {
      results.push({ id: a.id, ok: false, error: String(e && e.message || e).slice(0, 300) });
    }
  }
  // Temas colocados antes: su texto, para que Synaptic haga sus páginas.
  (res.textFor || []).forEach(function (x) {
    if (Date.now() - T0 > LIMIT_MS) return;
    var text = textoDePdf_(x.fileId);
    if (text) results.push({ id: x.id, ok: true, textOnly: true, text: text });
  });
  if (results.length || undone.length) api_({ op: 'report', runId: runId, results: results, undone: undone });
  console.log('Hecho: ' + results.filter(function (r) { return r.ok; }).length + ' colocados, ' + results.filter(function (r) { return !r.ok; }).length + ' con error, ' + undone.length + ' deshechos');
}

// ---- hablar con Synaptic ----
function api_(body) {
  var r = UrlFetchApp.fetch(SYNAPTIC + '/api/drive-agent', { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + TOKEN }, payload: JSON.stringify(body), muteHttpExceptions: true });
  if (r.getResponseCode() >= 300) { console.log('Synaptic respondió ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200)); return null; }
  return JSON.parse(r.getContentText());
}

// ---- de dónde salen los archivos de los profes ----
// Los adjuntos de Classroom no salen en "Compartido conmigo", pero se pueden
// abrir por su id: los sacamos de los avisos de Classroom en Gmail, de las
// carpetas de clase ya conocidas y de los enlaces que pegues en Synaptic.
function fuentes_() {
  var props = PropertiesService.getUserProperties();
  var known = JSON.parse(props.getProperty('carpetas') || '{}');
  var byId = {};
  // Solo lo de otros (profes); tus propios borradores no se tocan.
  var me = DriveApp.getRootFolder().getOwner().getEmail();
  var add = function (f) { try { if (!f.isTrashed() && !(f.getOwner() && f.getOwner().getEmail() === me)) byId[f.getId()] = f; } catch (e) {} };
  lista_(DriveApp.searchFiles('sharedWithMe = true and trashed = false')).forEach(add);
  var walk = function (d, depth) { lista_(d.getFiles()).forEach(add); if (depth < 2) lista_(d.getFolders()).forEach(function (x) { walk(x, depth + 1); }); };
  Object.keys(known).forEach(function (id) { try { walk(DriveApp.getFolderById(id), 0); } catch (e) {} });
  var porId = function (id) { if (!byId[id]) { try { add(DriveApp.getFileById(id)); } catch (e) {} } };
  var extra = JSON.parse(props.getProperty('extraIds') || '[]');
  extra.forEach(porId);
  try {
    var dias = props.getProperty('gmailVisto') ? 7 : 120;
    GmailApp.search('from:classroom.google.com newer_than:' + dias + 'd', 0, 100).forEach(function (t) {
      t.getMessages().forEach(function (m) {
        (m.getBody().match(/drive\\.google\\.com\\/(?:file\\/d\\/|open\\?id=)([A-Za-z0-9_-]{20,})/g) || []).forEach(function (u) { porId(u.match(/([A-Za-z0-9_-]{20,})$/)[1]); });
      });
    });
    props.setProperty('gmailVisto', '1');
  } catch (e) { console.log('Gmail no disponible: ' + e.message); }
  // Aprender las carpetas de clase de donde vienen.
  Object.keys(byId).forEach(function (id) { try { var ps = byId[id].getParents(); while (ps.hasNext()) { var p = ps.next(); known[p.getId()] = p.getName(); } } catch (e) {} });
  props.setProperty('carpetas', JSON.stringify(known));
  return Object.keys(byId).map(function (k) { return byId[k]; });
}

// ---- colocar un archivo donde dice Synaptic ----
function colocar_(src, target) {
  var dir = carpeta_(target.folder);
  var path = target.folder.concat([target.name]).join('/');
  var old = buscar_(dir, target.name);
  if (old && fechaOrigen_(old) >= src.getDateCreated()) return { id: src.getId(), ok: true, outputId: old.getId(), path: path, oldId: null };
  LAST_TEXT = null;
  var copia = src.makeCopy(target.name + ' (nuevo)', dir);
  copia.setDescription('src:' + src.getId() + '|' + src.getDateCreated().toISOString() + (target.workbook ? '|cuaderno' : ''));
  var final = target.pdf ? aPdf_(copia, dir, target.name) : (copia.setName(target.name), copia);
  if (!final) throw new Error('no se pudo convertir a PDF (se reintentará si lo pides)');
  if (old && old.getId() !== final.getId()) old.setTrashed(true);
  // Entrega oficial: tus borradores de esa unidad van a la papelera
  // (recuperables 30 días, y con «Deshacer» en Synaptic). Solo los tuyos;
  // el enunciado y la carpeta Código no se tocan.
  var trashed = [];
  if (target.kind === 'submission') {
    var me = DriveApp.getRootFolder().getOwner().getEmail();
    lista_(dir.getFiles()).forEach(function (x) {
      if (x.getId() === final.getId() || /_Enunciado\.pdf$/.test(x.getName())) return;
      try { if (!x.getOwner() || x.getOwner().getEmail() !== me) return; } catch (e) { return; }
      x.setTrashed(true);
      trashed.push({ id: x.getId(), path: target.folder.concat([x.getName()]).join('/') });
    });
  }
  // El texto del tema: de la copia de Google que ya se hizo para el PDF, o
  // del propio PDF (Drive lo lee al pasarlo a Doc).
  var text = null;
  if (target.kind === 'topic' || target.kind === 'session') text = LAST_TEXT || textoDePdf_(final.getId());
  return { id: src.getId(), ok: true, outputId: final.getId(), path: path, oldId: old ? old.getId() : null, trashed: trashed, text: text };
}

// La carpeta de la asignatura se busca en "Mi unidad" ignorando emojis y
// espacios ("📌 AD" vale para AD); si no existe, se crea.
function carpeta_(parts) {
  var norm = function (s) { return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); };
  var root = DriveApp.getRootFolder(), f = null, it = root.getFolders();
  while (it.hasNext()) { var x = it.next(); if (norm(x.getName()) === norm(parts[0])) { f = x; break; } }
  if (!f) f = root.createFolder(parts[0]);
  for (var i = 1; i < parts.length; i++) { var s = f.getFoldersByName(parts[i]); f = s.hasNext() ? s.next() : f.createFolder(parts[i]); }
  return f;
}
function buscar_(dir, name) { var it = dir.getFilesByName(name); return it.hasNext() ? it.next() : null; }
function fechaOrigen_(f) { var m = (f.getDescription() || '').match(/src:[^|]*\\|([^|\\s]+)/); return m ? new Date(m[1]) : f.getDateCreated(); }
function lista_(it) { var a = []; while (it.hasNext()) a.push(it.next()); return a; }

// pptx/docx/Google → PDF: copia en formato de Google, exporta a PDF y borra
// la copia temporal. Reintenta si Drive pide calma (403/429). Si falla,
// devuelve null y no sustituye nada.
function aPdf_(f, dir, name) {
  if (f.getMimeType() === 'application/pdf') { f.setName(name); return f; }
  var H = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  var desc = f.getDescription() || '';
  var mt = f.getMimeType(), gid = f.getId(), temp = false;
  if (mt.indexOf('application/vnd.google-apps.') !== 0) {
    var target = /presentation|powerpoint/i.test(mt) || /\\.pptx?$/i.test(f.getName()) ? 'application/vnd.google-apps.presentation'
      : /spreadsheet|excel/i.test(mt) || /\\.xlsx?$/i.test(f.getName()) ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document';
    var r = reintentar_(function () { return UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.getId() + '/copy', { method: 'post', contentType: 'application/json', headers: H, muteHttpExceptions: true, payload: JSON.stringify({ name: name + ' (temp)', mimeType: target, parents: [dir.getId()] }) }); });
    if (r.getResponseCode() >= 300) { f.setTrashed(true); return null; }
    gid = JSON.parse(r.getContentText()).id; temp = true;
  }
  var ex = reintentar_(function () { return UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + gid + '/export?mimeType=application/pdf', { headers: H, muteHttpExceptions: true }); });
  var tx = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + gid + '/export?mimeType=text/plain', { headers: H, muteHttpExceptions: true });
  if (tx.getResponseCode() < 300) LAST_TEXT = tx.getContentText().slice(0, 30000);
  if (temp) DriveApp.getFileById(gid).setTrashed(true);
  if (ex.getResponseCode() >= 300) { f.setTrashed(true); return null; }
  var nf = dir.createFile(ex.getBlob().setName(name));
  nf.setDescription(desc);
  f.setTrashed(true);
  return nf;
}
// El texto de un PDF: una copia como Doc de Google (Drive reconoce el
// texto), exportada a texto y a la papelera. null si no se puede.
function textoDePdf_(fileId) {
  try {
    var H = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
    var r = reintentar_(function () { return UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '/copy?ocrLanguage=es', { method: 'post', contentType: 'application/json', headers: H, muteHttpExceptions: true, payload: JSON.stringify({ name: 'synaptic-texto (temp)', mimeType: 'application/vnd.google-apps.document' }) }); });
    if (r.getResponseCode() >= 300) return null;
    var gid = JSON.parse(r.getContentText()).id;
    var tx = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + gid + '/export?mimeType=text/plain', { headers: H, muteHttpExceptions: true });
    DriveApp.getFileById(gid).setTrashed(true);
    return tx.getResponseCode() < 300 ? tx.getContentText().slice(0, 30000) : null;
  } catch (e) { return null; }
}
function reintentar_(fn) {
  var r;
  for (var k = 0; k < 6; k++) { r = fn(); var c = r.getResponseCode(); if (c !== 403 && c !== 429 && c < 500) break; Utilities.sleep(3000 * (k + 1)); }
  return r;
}
`;
}
