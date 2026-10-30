# Endgrooves V61.7 | Brass Iconography

GitHub Pages-ready **full site** based on the supplied latest V61.5 functional stack (the V61.4.8 native application + Affinity V1 + V61.5 UX refinement).

## What changed
- Rebranded user-facing app and login text to **Endgrooves** while preserving shelf/collection nomenclature.
- Added original, scalable, accessible antique-brass **SVG icon set** for the app's existing navigation, filters, add, views, actions, mini-player and modal.
- Refined brass UI token accents; retained the original warm, premium dark visual language.
- New engraved brass Endgrooves record mark and favicon.
- Added `/design/iconography-preview.html` to inspect every symbol.

## Preservation
- Kept every V61.5 app module, Supabase/native DB contract, OAuth callback and Affinity code.
- No SQL migration, data export, Spotify reauthorization, or environment change required by this design patch.
- All native button IDs and event handlers remain in place. This is an additive presentation adapter.
- Supabase globals retain their original names deliberately for compatibility.

## Deploy to GitHub Pages
1. Download and extract this ZIP.
2. Copy **all contents of its top-level folder** to the repository's published root (not the folder itself if Pages serves `/`).
3. Commit/push, then hard-refresh after GitHub Pages finishes deploying.
4. Check sign-in, shelves, filters, records, modal, listening, Spotify and the Affinity cards against your own Supabase environment.
5. If needed, rollback by restoring the previous site files. No database changes are involved.

## Notes
- Existing `supabase-config.js` is copied verbatim from the baseline. Check that its public URL and anon key match the configured deployment. Never commit a service-role key.
- The iconography is vector-recreated from the approved *visual concept*, not extracted pixels or a new functional design.
- `js/endgrooves-icons-v61_7.js` and `css/endgrooves-brass-v61_7.css` are the new isolated layer.
