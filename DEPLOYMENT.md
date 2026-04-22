# Einrichtung — Anmeldungs-Backend (Google Apps Script + Google Sheet)

Diese Website ist statisch. Die Funktionen Anmelden, Abrufen, Ändern, Stornieren, Admin-Übersicht und E-Mail-Versand werden von einer **Google Apps Script Web-App** übernommen, die in ein Google Sheet schreibt und E-Mails über dein Gmail verschickt. Kein Server, keine Kosten, keine Kreditkarte. Ca. 20 Minuten Aufwand — einmalig.

## Voraussetzungen

- Ein Google-Konto (jenes, das die Anmeldungen "besitzen" und die Bestätigungs-E-Mails verschicken soll — voraussichtlich `othmar@…` oder `christin@…`).
- Schreibzugriff auf dieses Repository (um die Web-App-URL in `assets/config.js` einzutragen).

---

## Schritt 1 — Google Sheet erstellen (die "Datenbank")

1. Öffne <https://sheets.new> im gleichen Browser, in dem du mit dem Eigentümer-Konto angemeldet bist.
2. Tabelle umbenennen: **Erni Anmeldungen 2026** (beliebiger Name).
3. Kopiere die **Spreadsheet-ID** aus der URL. In `https://docs.google.com/spreadsheets/d/ABC123xyz/edit` ist die ID `ABC123xyz`.

Spalten musst du nicht anlegen — das Script erstellt beim ersten Aufruf automatisch das Tabellenblatt `Anmeldungen` inklusive Kopfzeile.

## Schritt 2 — Apps-Script-Projekt anlegen

1. Öffne <https://script.new>.
2. Projekt oben links umbenennen: **Erni Anmeldung API**.
3. Lösche den vorgegebenen Inhalt von `Code.gs` und füge den **gesamten Inhalt** der Datei `apps-script/Code.gs` aus diesem Repository ein.
4. Datei → Speichern (⌘S bzw. Strg+S).

## Schritt 3 — Skripteigenschaften setzen

Skripteigenschaften enthalten Geheimnisse und stehen nicht im Code.

1. Im Apps-Script-Editor links auf das **Zahnrad-Symbol (Projekteinstellungen)** klicken.
2. Unter **Skripteigenschaften** auf **Skripteigenschaft hinzufügen**. Folgende vier Einträge ergänzen:

| Eigenschaft | Wert |
|---|---|
| `SHEET_ID` | Die Spreadsheet-ID aus Schritt 1 |
| `ADMIN_PASSWORD` | Passwort für den Zugriff auf `admin.html` (nicht trivial wählen) |
| `NOTIFY_EMAIL` | E-Mail-Adresse, die bei jeder neuen/geänderten/stornierten Anmeldung benachrichtigt wird |
| `SITE_URL` | `https://ernis-foreveryoung.ch` *(optional — wird in den E-Mail-Links verwendet)* |

3. Auf **Skripteigenschaften speichern** klicken.

## Schritt 4 — Zugriff auf Gmail und Sheets autorisieren

Beim ersten Lauf fragt Apps Script nach den erforderlichen Berechtigungen.

1. Im Editor in der Funktionsauswahl oben **`doGet`** auswählen und auf **Ausführen** klicken.
2. Google zeigt: **"Autorisierung erforderlich"** → **Berechtigungen prüfen** → Konto wählen → die Warnung **"Google hat diese App nicht überprüft"** erscheint, weil es dein eigenes Script ist — auf **Erweitert** → **Erni Anmeldung API öffnen (unsicher)** → **Zulassen** klicken.
3. Der Lauf sollte fehlerfrei durchlaufen. Das Ausführungsprotokoll kannst du schliessen.

## Schritt 5 — Als Web-App veröffentlichen

1. Oben rechts auf **Bereitstellen → Neue Bereitstellung**.
2. Beim Symbol neben "Typ auswählen" auf **Web-App** klicken.
3. Felder ausfüllen:
   - **Beschreibung**: `Erni Anmeldung v1`
   - **Ausführen als**: `Ich (dein@gmail.com)`
   - **Wer hat Zugriff**: `Jeder`
4. Auf **Bereitstellen** klicken und etwaige zusätzliche Abfragen bestätigen.
5. **Web-App-URL kopieren** — sieht so aus: `https://script.google.com/macros/s/AKfycb…/exec`.

> ⚠️ "Jeder" ist korrekt. Damit kann jede Person, die die URL kennt, an das Script senden. Der Admin-Endpunkt ist im Script zusätzlich durch `ADMIN_PASSWORD` geschützt.

## Schritt 6 — Website mit dem Backend verbinden

1. `assets/config.js` im Repository öffnen.
2. `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` durch die URL aus Schritt 5 ersetzen.
3. Änderungen committen und pushen. GitHub Pages veröffentlicht die neue Version nach ca. 1 Minute.

```js
window.ERNI_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbXXX.../exec"
};
```

## Schritt 7 — Funktionstest

1. Öffne `https://ernis-foreveryoung.ch/anmeldung.html`.
2. Eine Testanmeldung mit deiner eigenen E-Mail-Adresse absenden.
3. Erwartetes Verhalten:
   - Die Bestätigungsseite zeigt einen Code im Format `ERNI-7K3Q-9FXM`.
   - Dein Posteingang erhält eine gestaltete Bestätigungs-E-Mail mit dem Code.
   - Im Postfach von `NOTIFY_EMAIL` trifft eine Admin-Benachrichtigung ein.
   - Im Google Sheet wird eine neue Zeile eingefügt.
4. `https://ernis-foreveryoung.ch/verwalten.html` öffnen → Code und Nachname eingeben → die Anmeldung erscheint.
5. Etwas ändern → **Änderungen speichern** → Bestätigungs-E-Mail kommt an.
6. **Anmeldung stornieren** → Status in der Tabelle wechselt auf `cancelled` → Stornierungs-E-Mail kommt an.
7. `https://ernis-foreveryoung.ch/admin.html` öffnen → `ADMIN_PASSWORD` eingeben → alle Anmeldungen, Totale und der CSV-Export sind sichtbar.

## Script später aktualisieren

Wenn du `Code.gs` änderst:

1. Neuen Code im Apps-Script-Editor einfügen, speichern.
2. **Bereitstellen → Bereitstellungen verwalten → Stift-Symbol → Version: Neue Version → Bereitstellen**.
3. Die URL bleibt gleich — auf der Website ist keine Änderung nötig.

## Gmail-Kontingent (zur Info)

Ein kostenloses `@gmail.com`-Konto kann über `MailApp` in Apps Script bis zu **100 E-Mails pro Tag** verschicken. Ein Google-Workspace-Konto hat deutlich höhere Limits. Für ein privates Fest liegt das weit über dem zu erwartenden Aufkommen.

## Fehlerbehebung

- **"Die Anmeldung ist noch nicht aktiviert"** → In `config.js` steht noch die Platzhalter-URL. Die echte URL eintragen.
- **CORS-Fehler in der Browser-Konsole** → Vermutlich wurde irgendwo `Content-Type: application/json` gesetzt. Der Code verwendet bewusst `text/plain` — bitte nicht ändern.
- **Keine E-Mail kommt an** → Prüfen, ob `NOTIFY_EMAIL` gesetzt ist, ob die Autorisierung in Schritt 4 erfolgt ist und ob das Kontingent reicht (`MailApp.getRemainingDailyQuota()` im Script-Editor ausführen).
- **"Passwort falsch" im Admin-Bereich** → Die Eigenschaft `ADMIN_PASSWORD` fehlt oder weicht ab. In Projekteinstellungen → Skripteigenschaften prüfen.
- **Alles zurücksetzen** → Zeilen im Sheet löschen, Kopfzeile behalten. Oder das Tabellenblatt komplett löschen — das Script legt es beim nächsten Aufruf neu an.

## Schnellüberblick: was passiert wo

| Ebene | Ort | Inhalt |
|---|---|---|
| Frontend | GitHub Pages (`ernis-foreveryoung.ch`) | HTML, CSS, JavaScript |
| Backend | Google Apps Script Web-App | Registrierungs-/Änderungs-/Stornierungs-Logik |
| Datenbank | Google Sheet im Drive des Eigentümer-Kontos | Eine Zeile pro Anmeldung |
| E-Mail-Versand | Gmail des Eigentümer-Kontos (via `MailApp`) | Bestätigungen, Änderungen, Stornierungen, Admin-Meldungen |
| Admin-Zugriff | `admin.html` + `ADMIN_PASSWORD` | Liste, Totale, CSV-Export |
