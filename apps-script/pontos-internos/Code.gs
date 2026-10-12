const PI_SPREADSHEET_ID = '1qL4S-vNDI2iONCVtl6fUuWo6EK0v62IWFGydrLKhlbQ';
const PI_SHEET_NAME = 'Respostas ao formulário';
const PI_CATEGORY_NAMES = { A:'[A] OUVIDORIA', B:'[B] DESTAQUE', C:'[C] HIERARQUIA & METAS', D:'[D] DIVERSOS' };

function setup() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('PI_ACCESS_KEY')) properties.setProperty('PI_ACCESS_KEY', Utilities.getUuid() + Utilities.getUuid());
  SpreadsheetApp.openById(PI_SPREADSHEET_ID).getSheetByName(PI_SHEET_NAME).getRange('A1:I1').getValues();
  Logger.log('Chave de acesso: ' + properties.getProperty('PI_ACCESS_KEY'));
  return properties.getProperty('PI_ACCESS_KEY');
}

function doGet(e) {
  try {
    validateAccess_(e && e.parameter && e.parameter.accessKey);
    if (!e || !e.parameter || e.parameter.action !== 'listRows') throw new Error('Ação inválida.');
    return json_({ ok:true, rows:listRows_() });
  } catch (error) { return json_({ ok:false, error:error.message }); }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e && e.postData && e.postData.contents || '{}');
    validateAccess_(payload.accessKey);
    if (payload.action !== 'appendPoints') throw new Error('Ação inválida.');
    return json_(appendPoints_(payload));
  } catch (error) { return json_({ ok:false, error:error.message }); }
}

function appendPoints_(payload) {
  validatePayload_(payload);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const propertyKey = 'request:' + payload.requestId;
    const previous = properties.getProperty(propertyKey);
    if (previous) { const receipt=JSON.parse(previous); receipt.duplicateRequest=true; return receipt; }
    const sheet = SpreadsheetApp.openById(PI_SPREADSHEET_ID).getSheetByName(PI_SHEET_NAME);
    if (!sheet) throw new Error('A aba "Respostas ao formulário" não foi encontrada.');
    const now = new Date();
    const values = payload.rows.map(row => toSheetRow_(payload.responsible, row, now));
    const firstRow = sheet.getLastRow() + 1;
    sheet.getRange(firstRow, 1, values.length, 9).setValues(values);
    SpreadsheetApp.flush();
    const receipt = { ok:true, duplicateRequest:false, firstRow:firstRow, rowCount:values.length, requestId:payload.requestId };
    properties.setProperty(propertyKey, JSON.stringify(receipt));
    return receipt;
  } finally { lock.releaseLock(); }
}

function validatePayload_(payload) {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(String(payload.requestId || ''))) throw new Error('requestId inválido.');
  if (!clean_(payload.responsible) || clean_(payload.responsible).length > 120) throw new Error('Responsável inválido.');
  if (!Array.isArray(payload.rows) || !payload.rows.length || payload.rows.length > 100) throw new Error('O lote precisa conter de 1 a 100 linhas.');
  payload.rows.forEach(function(row, index) {
    if (!PI_CATEGORY_NAMES[row.category]) throw new Error('Categoria inválida na linha ' + (index + 1) + '.');
    if (!clean_(row.label) || clean_(row.label).length > 160) throw new Error('Tipo de ponto inválido na linha ' + (index + 1) + '.');
    if (!clean_(row.nicks) || clean_(row.nicks).length > 5000) throw new Error('Nicks inválidos na linha ' + (index + 1) + '.');
    if (clean_(row.print) && !/^https:\/\//i.test(clean_(row.print))) throw new Error('O print da linha ' + (index + 1) + ' precisa usar HTTPS.');
  });
}

function toSheetRow_(responsible, entry, now) {
  const row = [now, clean_(responsible), clean_(entry.nicks), PI_CATEGORY_NAMES[entry.category], '', '', '', '', clean_(entry.print)];
  row[4 + 'ABCD'.indexOf(entry.category)] = clean_(entry.label);
  return row;
}

function listRows_() {
  const sheet = SpreadsheetApp.openById(PI_SPREADSHEET_ID).getSheetByName(PI_SHEET_NAME);
  if (!sheet) throw new Error('A aba de respostas não foi encontrada.');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const firstRow = Math.max(2, lastRow - 1999);
  return sheet.getRange(firstRow, 1, lastRow - firstRow + 1, 9).getDisplayValues().map(function(row) {
    return { date:row[0], responsible:row[1], nicks:row[2], category:row[3], label:row[4] || row[5] || row[6] || row[7], print:row[8] };
  });
}

function validateAccess_(value) {
  const expected = PropertiesService.getScriptProperties().getProperty('PI_ACCESS_KEY');
  if (!expected) throw new Error('Execute setup() antes de publicar.');
  if (String(value || '') !== expected) throw new Error('Acesso negado.');
}

function clean_(value) { return String(value == null ? '' : value).trim(); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
