/**
 * Erni's - ForeverYoung — Anmeldung Backend
 * ------------------------------------------
 * Google Apps Script Web App powering register / lookup / update / cancel
 * + admin list for the Day-Dance 27.06.2026.
 *
 * Deploy: see DEPLOYMENT.md in the site repo.
 *
 * Script properties required (File → Project properties → Script properties):
 *   SHEET_ID         The Spreadsheet ID (from the Sheet URL).
 *   ADMIN_PASSWORD   Shared secret for admin.html.
 *   NOTIFY_EMAIL     Where to send admin notifications (e.g. othmar@…).
 *   EVENT_NAME       Optional. Default: "Erni's - ForeverYoung".
 *   SITE_URL         Optional. Default: "https://ernis-foreveryoung.ch".
 */

const SHEET_NAME = 'Anmeldungen';
const HEADERS = [
  'code', 'createdAt', 'updatedAt', 'status',
  'vorname', 'nachname', 'email', 'telefon',
  'partner', 'partnerName',
  'zimmer', 'bus', 'mitteilung'
];
// Alphabet excludes 0,O,1,I,L for readability.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// ---------- Entry points ----------

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return jsonOut({ ok: false, error: 'Ungültige Anfrage.' });
  }

  try {
    switch (body.action) {
      case 'register':   return jsonOut(handleRegister(body));
      case 'lookup':     return jsonOut(handleLookup(body));
      case 'update':     return jsonOut(handleUpdate(body));
      case 'cancel':     return jsonOut(handleCancel(body));
      case 'adminList':  return jsonOut(handleAdminList(body));
      default:
        return jsonOut({ ok: false, error: 'Unbekannte Aktion.' });
    }
  } catch (err) {
    console.error(err);
    return jsonOut({ ok: false, error: 'Serverfehler: ' + err.message });
  }
}

function doGet() {
  return jsonOut({ ok: true, service: 'Erni ForeverYoung Anmeldung API' });
}

// ---------- Handlers ----------

function handleRegister(b) {
  const vorname  = sanitize(b.vorname);
  const nachname = sanitize(b.nachname);
  const email    = sanitize(b.email);
  if (!vorname || !nachname || !email) {
    return { ok: false, error: 'Vorname, Nachname und E-Mail sind erforderlich.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'E-Mail-Adresse ist ungültig.' };
  }

  const sheet = getSheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const code = generateUniqueCode(sheet);
    const now  = new Date();
    const partner     = !!b.partner;
    const partnerName = partner ? sanitize(b.partnerName) : '';
    const row = [
      code, now, now, 'active',
      vorname, nachname, email,
      sanitize(b.telefon),
      partner, partnerName,
      !!b.zimmer, !!b.bus,
      sanitize(b.mitteilung)
    ];
    sheet.appendRow(row);

    const record = {
      code, vorname, nachname, email,
      telefon: sanitize(b.telefon),
      partner, partnerName,
      zimmer: !!b.zimmer, bus: !!b.bus,
      mitteilung: sanitize(b.mitteilung),
      status: 'active'
    };
    sendConfirmationEmail(record);
    notifyAdmin('Neue Anmeldung', formatRecord(record));

    return { ok: true, code: code };
  } finally {
    lock.releaseLock();
  }
}

function handleLookup(b) {
  const row = findRow(b.code, b.nachname);
  if (!row) return { ok: false, error: 'Keine Anmeldung gefunden. Bitte Code und Nachname prüfen.' };
  return { ok: true, record: rowToObject(row.values) };
}

function handleUpdate(b) {
  const row = findRow(b.code, b.nachname);
  if (!row) return { ok: false, error: 'Keine Anmeldung gefunden.' };
  if (row.values[col('status')] === 'cancelled') {
    return { ok: false, error: 'Diese Anmeldung wurde bereits storniert.' };
  }

  const sheet = getSheet();
  const rIndex = row.rowIndex;
  // Updatable fields only:
  if (b.vorname     !== undefined) sheet.getRange(rIndex, col('vorname')+1).setValue(sanitize(b.vorname));
  if (b.email       !== undefined) sheet.getRange(rIndex, col('email')+1).setValue(sanitize(b.email));
  if (b.telefon     !== undefined) sheet.getRange(rIndex, col('telefon')+1).setValue(sanitize(b.telefon));
  if (b.partner     !== undefined) {
    const p = !!b.partner;
    sheet.getRange(rIndex, col('partner')+1).setValue(p);
    // If partner is unchecked, clear the name; else update it when provided.
    if (!p) sheet.getRange(rIndex, col('partnerName')+1).setValue('');
    else if (b.partnerName !== undefined) sheet.getRange(rIndex, col('partnerName')+1).setValue(sanitize(b.partnerName));
  } else if (b.partnerName !== undefined) {
    sheet.getRange(rIndex, col('partnerName')+1).setValue(sanitize(b.partnerName));
  }
  if (b.zimmer      !== undefined) sheet.getRange(rIndex, col('zimmer')+1).setValue(!!b.zimmer);
  if (b.bus         !== undefined) sheet.getRange(rIndex, col('bus')+1).setValue(!!b.bus);
  if (b.mitteilung  !== undefined) sheet.getRange(rIndex, col('mitteilung')+1).setValue(sanitize(b.mitteilung));
  sheet.getRange(rIndex, col('updatedAt')+1).setValue(new Date());

  const updated = rowToObject(sheet.getRange(rIndex, 1, 1, HEADERS.length).getValues()[0]);
  sendUpdateEmail(updated);
  notifyAdmin('Anmeldung geändert', formatRecord(updated));
  return { ok: true, record: updated };
}

function handleCancel(b) {
  const row = findRow(b.code, b.nachname);
  if (!row) return { ok: false, error: 'Keine Anmeldung gefunden.' };
  if (row.values[col('status')] === 'cancelled') {
    return { ok: false, error: 'Diese Anmeldung wurde bereits storniert.' };
  }
  const sheet = getSheet();
  sheet.getRange(row.rowIndex, col('status')+1).setValue('cancelled');
  sheet.getRange(row.rowIndex, col('updatedAt')+1).setValue(new Date());

  const cancelled = rowToObject(sheet.getRange(row.rowIndex, 1, 1, HEADERS.length).getValues()[0]);
  sendCancellationEmail(cancelled);
  notifyAdmin('Anmeldung storniert', formatRecord(cancelled));
  return { ok: true };
}

function handleAdminList(b) {
  const pw = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!pw || b.password !== pw) return { ok: false, error: 'Passwort falsch.' };

  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true, records: [], totals: emptyTotals() };
  const data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const records = data.map(rowToObject);
  const totals = computeTotals(records);
  return { ok: true, records: records, totals: totals };
}

// ---------- Helpers ----------

function getSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('SHEET_ID script property is not set.');
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  // Ensure headers are present even if sheet pre-exists.
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (firstRow.join('|') !== HEADERS.join('|')) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateUniqueCode(sheet) {
  const existing = new Set();
  const last = sheet.getLastRow();
  if (last >= 2) {
    sheet.getRange(2, col('code')+1, last - 1, 1).getValues()
         .forEach(r => existing.add(String(r[0])));
  }
  for (let i = 0; i < 50; i++) {
    const c = randomCode();
    if (!existing.has(c)) return c;
  }
  throw new Error('Konnte keinen eindeutigen Code generieren.');
}

function randomCode() {
  const rand = n => {
    let s = '';
    for (let i = 0; i < n; i++) {
      s += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    }
    return s;
  };
  return 'ERNI-' + rand(4) + '-' + rand(4);
}

function findRow(code, nachname) {
  if (!code || !nachname) return null;
  const normCode = String(code).trim().toUpperCase();
  const normName = String(nachname).trim().toLowerCase();
  const sheet = getSheet();
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    if (String(r[col('code')]).trim().toUpperCase() === normCode &&
        String(r[col('nachname')]).trim().toLowerCase() === normName) {
      return { rowIndex: i + 2, values: r };
    }
  }
  return null;
}

function col(name) {
  return HEADERS.indexOf(name);
}

function rowToObject(row) {
  const o = {};
  HEADERS.forEach((h, i) => {
    let v = row[i];
    if (v instanceof Date) v = v.toISOString();
    o[h] = v;
  });
  return o;
}

function sanitize(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, 2000);
}

function computeTotals(records) {
  const active = records.filter(r => r.status !== 'cancelled');
  const withPartner = active.filter(r => r.partner === true || r.partner === 'true').length;
  return {
    total: records.length,
    active: active.length,
    cancelled: records.length - active.length,
    // Guest head-count: each active RSVP counts 1, +1 if partner.
    guests: active.length + withPartner,
    partner: withPartner,
    zimmer: active.filter(r => r.zimmer === true || r.zimmer === 'true').length,
    bus: active.filter(r => r.bus === true || r.bus === 'true').length
  };
}
function emptyTotals() { return { total: 0, active: 0, cancelled: 0, guests: 0, partner: 0, zimmer: 0, bus: 0 }; }

// ---------- Email ----------

function eventName() {
  return PropertiesService.getScriptProperties().getProperty('EVENT_NAME') || "Erni's - ForeverYoung";
}
function siteUrl() {
  return PropertiesService.getScriptProperties().getProperty('SITE_URL') || 'https://ernis-foreveryoung.ch';
}

function sendConfirmationEmail(r) {
  const subject = 'Bestätigung Deiner Anmeldung — ' + eventName();
  const html = buildEmailHtml({
    title: 'Danke für Deine Anmeldung!',
    intro: 'Wir freuen uns riesig, dass Du am <b>27. Juni 2026</b> dabei bist — Day-Dance im Beach Club vom Hotel Hermitage in Luzern ab 15:00 Uhr.',
    record: r,
    showCode: true,
    codeNote: 'Mit diesem Code und Deinem Nachnamen kannst Du Deine Anmeldung jederzeit ansehen, ändern oder stornieren.',
    ctaLabel: 'Anmeldung verwalten',
    ctaUrl: siteUrl() + '/verwalten.html'
  });
  MailApp.sendEmail({ to: r.email, subject: subject, htmlBody: html });
}

function sendUpdateEmail(r) {
  const subject = 'Deine Anmeldung wurde aktualisiert — ' + eventName();
  const html = buildEmailHtml({
    title: 'Deine Anmeldung wurde geändert',
    intro: 'Wir haben Deine Anmeldung soeben aktualisiert. Hier sind die aktuellen Angaben:',
    record: r,
    showCode: true,
    ctaLabel: 'Anmeldung verwalten',
    ctaUrl: siteUrl() + '/verwalten.html'
  });
  MailApp.sendEmail({ to: r.email, subject: subject, htmlBody: html });
}

function sendCancellationEmail(r) {
  const subject = 'Stornierung Deiner Anmeldung — ' + eventName();
  const html = buildEmailHtml({
    title: 'Deine Anmeldung wurde storniert',
    intro: 'Schade, dass Du nicht dabei sein kannst. Wir haben Deine Anmeldung wie gewünscht storniert. Falls das ein Versehen war, melde Dich bitte direkt bei uns.',
    record: r,
    showCode: false,
    ctaLabel: 'Zurück zur Website',
    ctaUrl: siteUrl()
  });
  MailApp.sendEmail({ to: r.email, subject: subject, htmlBody: html });
}

function notifyAdmin(subject, body) {
  const to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  MailApp.sendEmail({ to: to, subject: '[Erni Anmeldung] ' + subject, body: body });
}

function buildEmailHtml(o) {
  const r = o.record;
  const yes = v => v ? 'Ja' : 'Nein';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#333;max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#66c7f4;color:#fff;padding:20px;border-radius:6px 6px 0 0;">
      <h2 style="margin:0;font-size:20px;">${o.title}</h2>
    </div>
    <div style="border:1px solid #e3e3e3;border-top:none;padding:24px;border-radius:0 0 6px 6px;">
      <p style="margin-top:0;">Liebe/r ${escapeHtml(r.vorname)},</p>
      <p>${o.intro}</p>
      ${o.showCode ? `
        <div style="background:#f5fbfe;border:1px dashed #66c7f4;padding:16px;border-radius:4px;text-align:center;margin:20px 0;">
          <div style="font-size:12px;color:#777;letter-spacing:0.08em;">DEIN CODE</div>
          <div style="font-family:Consolas,monospace;font-size:22px;font-weight:700;color:#1a6fa3;margin-top:6px;">${escapeHtml(r.code)}</div>
        </div>
        ${o.codeNote ? `<p style="font-size:13px;color:#555;">${o.codeNote}</p>` : ''}
      ` : ''}
      <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px;">
        <tr><td style="padding:6px 0;color:#777;width:40%;">Name</td><td style="padding:6px 0;">${escapeHtml(r.vorname)} ${escapeHtml(r.nachname)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">E-Mail</td><td style="padding:6px 0;">${escapeHtml(r.email)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Telefon</td><td style="padding:6px 0;">${escapeHtml(r.telefon) || '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Mit Begleitung</td><td style="padding:6px 0;">${yes(r.partner)}${(r.partner && r.partnerName) ? ' (' + escapeHtml(r.partnerName) + ')' : ''}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Zimmer reservieren</td><td style="padding:6px 0;">${yes(r.zimmer)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;">Bus 22:00 Uhr</td><td style="padding:6px 0;">${yes(r.bus)}</td></tr>
        <tr><td style="padding:6px 0;color:#777;vertical-align:top;">Mitteilung</td><td style="padding:6px 0;white-space:pre-wrap;">${escapeHtml(r.mitteilung) || '—'}</td></tr>
      </table>
      <p style="text-align:center;margin-top:24px;">
        <a href="${o.ctaUrl}" style="background:#66c7f4;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:700;">${o.ctaLabel}</a>
      </p>
      <p style="font-size:12px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">
        Othmar und Christin Erni · Adligenswil, Schweiz<br/>
        ${eventName()} · 27. Juni 2026 · Hotel Hermitage, Luzern
      </p>
    </div>
  </div>`;
}

function formatRecord(r) {
  return [
    'Code: ' + r.code,
    'Status: ' + (r.status || 'active'),
    'Name: ' + r.vorname + ' ' + r.nachname,
    'E-Mail: ' + r.email,
    'Telefon: ' + (r.telefon || '—'),
    'Begleitung: ' + (r.partner ? ('Ja' + (r.partnerName ? ' (' + r.partnerName + ')' : '')) : 'Nein'),
    'Zimmer: ' + (r.zimmer ? 'Ja' : 'Nein'),
    'Bus: ' + (r.bus ? 'Ja' : 'Nein'),
    'Mitteilung: ' + (r.mitteilung || '—')
  ].join('\n');
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
