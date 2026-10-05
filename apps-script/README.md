# Globe Athlete Tool — Live Google Sheet connection

This keeps the master spreadsheet private while exposing only the sanitized athlete fields needed by the public site.

## One-time setup

1. Open the **Athlete Training 2026-27** Google Sheet.
2. Choose **Extensions → Apps Script**.
3. Replace the default `Code.gs` contents with the repository file `apps-script/Code.gs`.
4. In Apps Script, open **Project Settings → Script properties** and add:
   - Property: `SPREADSHEET_ID`
   - Value: the spreadsheet ID from the Sheet URL (the text between `/d/` and `/edit`).
5. Choose **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorize the script when Google prompts you.
7. Copy the deployment URL ending in `/exec`.
8. Put only that public `/exec` URL into `config.js` as `window.ATHLETE_DATA_URL`.

## What the public endpoint exposes

- Athlete name, grade/year, gender
- Official Overall / Academics / Athleticism / Strength scores
- GPA **range only**, never exact GPA
- Best valid test/lift performances and paired stars
- 1000 lbs Club total
- Public sport names if/when they exist in the source columns
- Sport bonus or a clearly labeled inferred bonus

It does **not** expose weight, exact GPA, notes, or the spreadsheet ID.

## Refresh behavior

The web app checks the live endpoint on page load, once per minute while open, and when the user returns to the tab. The endpoint caches for about 30 seconds to avoid unnecessary Sheet reads.

If the endpoint is unavailable, the preview continues using its bundled snapshot and shows a `SNAPSHOT` badge instead of `LIVE SHEET`.
