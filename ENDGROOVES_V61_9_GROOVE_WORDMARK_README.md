# Endgrooves V61.9 | Groove Line Sidebar Lockup

This is a complete GitHub Pages deployment stack derived from V61.8.

## What changed
- Expanded sidebar shows the **ENDGR[record]OVES** wordmark, matching the approved Groove Line artwork. The record replaces the first O after GR.
- Removed the EG monogram entirely from the record assets. The new mark consists of fine concentric brown-brass rings and a tiny central spindle hole, without glossy foil.
- Collapsed sidebar shows **only the matching record**. Clicking it expands the sidebar. The separate menu button appears only in expanded mode.
- Clicking the expanded wordmark still opens All Records. Existing collapse preferences, collection navigation, Supabase, Spotify, and listening diary modules are retained.
- Favicon and placeholder use the same minimal record mark. No database changes.

## Deployment
Unzip and upload **the contents** to your GitHub Pages published repository root, replacing V61.8 assets. Commit all files in one operation and hard-refresh the browser.

## Validation
Static JS syntax, SVG parsing, ZIP asset references and sidebar layout/click actions checked locally. Live authenticated Supabase and Spotify are not verified without service credentials.
