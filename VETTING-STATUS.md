# Athlete profile vetting

Baseline fetched 2026-10-31: main `d438e32c52b345b963698f1f9c4f1ac96f63f8c7`.
Current repo files and blob SHAs were inspected before edits.

## Batch 1 — review workflow

- Implemented: coach/admin review dialog, name search and issue filter, links to source photo candidates, links back to athlete profiles, current-year precedence, conservative filename matching, older-only/missing photos, duplicate names/IDs, sport/primary-photo issues, missing MaxPreps, missing/invalid tests, possible filename mismatches.
- Implemented: server-authorized account audit returning row/name/type only; no emails or Google identifiers. Requires Apps Script deployment. Client displays NOT CHECKED if unavailable.
- Checked: syntax, whitespace, matching rules (exact vs nickname, duplicate same-sport images vs multisport images), fallback precedence, invalid metrics, duplicate athletes, no mutation of inputs.
- Browser-tested before edits: permanent site loads 267 athletes, leaderboard, sport filter, sign-in controls. Updated review dialog and signed-in flows still pending browser testing.
- User-tested: pending. Do not expand photo publication until this batch is tested by the user on the permanent site.
- Repository publication: review assets, integration, cache-version update, and server audit saved to GitHub main and read back successfully. Permanent-site checks after publication still showed the old unversioned athlete loader and no profile-review script. Deployment is NOT verified. Available connector has no Pages publish/build control; unauthenticated Pages configuration read returned 404. Resolve Pages publication before user acceptance testing.
- Post-edit browser checks: existing public leaderboard and Heber profile still render, MaxPreps link present, review control absent for signed-out visitor. These checks observed the older release, so they do not validate the new review UI.
- Additional server tests passed: student-role request denied; coach request returns expected mismatch; no emails or Google Sub values returned; audit works with read-only mock sheets.

## Source inventory / audit

- Preferred: Drive folder `1wRWTV7WauGCW-Kz5zOVtey_2KBuJ8YYO`, 136 files across Football, Cross Country, Swim, Volleyball, Cheer.
- Fallback: 2025–26 folder `1uf9967P7qxg-eIUOHZ47dOTkye0efvmn`, 260 files across 12 sport folders.
- All sport-folder listings returned fewer than the requested 100 items.
- Public live feed audited: 267 records; 54 with exact current-year candidates, 44 fallback-only. Candidates are not identity approvals.
- Two records with multiple same-sport candidates; four records in duplicate-name groups; twelve with possible spelling/name mismatch leads. Leads never become automatic matches.
- 169 records have neither an exact source match nor a legacy mapped photo. 126 have no sport listed in the live feed; 151 lack one or more public test values; 256 have no verified MaxPreps mapping.
- Local inventory and full audit report are ignored by Git. Shipped source metadata is restricted to roster-related candidates and manual-review leads.

## Photo rollout — pending

No new photo selections or crops published in this batch. Existing five approved football examples, sprite fallback, and Heber soccer-primary code remain unchanged.
Next batch: visually review a small set of unambiguous current-year sources, make deterministic 10:7 crops, compare against approved examples, publish, browser-test, then request user testing before expansion.

## Apps Script deployment

Update the existing Apps Script project from `apps-script/Code.gs`, then update its existing web-app deployment so `config.js` keeps the same endpoint. The new `coachProfileReview` action is authorized by the existing verified coach/admin role and reads account rows without changing athlete scores. Confirm student/public requests cannot access it.

## User acceptance checklist

1. Sign in as coach on the permanent site and open Profile Review. Search an athlete and use an issue filter; open a candidate source and return to the athlete profile.
2. Confirm public/student sessions do not show the review button. Sign out while review is open and confirm it closes.
3. Confirm leaderboard, student submission, coach entry, and approvals retain their existing behavior without saving test scores.
4. Confirm Heber still shows soccer when soccer is the saved primary sport.
5. After backend deployment, confirm account checks show checked-row counts, or explicit NOT CHECKED if service is unavailable.

Meeting date has not been supplied. No scores, primary sports, account links, or approvals were changed during this audit.

