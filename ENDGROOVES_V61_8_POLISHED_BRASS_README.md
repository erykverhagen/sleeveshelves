# Endgrooves V61.8 | Polished Brass & Vinyl Fold

Complete GitHub Pages app, layered over the V61.7 stack. No migration needed.

## Changes
- Restored original Dead Wax gold-record logo construction (source: the provided original logo HTML), recolored to brown antique brass with strong reflective highlights. EG replaces DW. Original engraved tribute meaning preserved.
- Replaced the simplified V61.7 favicon with a matching polished brass vinyl mark.
- Fixed wordmark squeezing in expanded sidebar: controlled widths for hamburger, vinyl mark, wordmark and small caption. Collapsed sidebar retains a prominent record mark.
- Added a subtle vinyl folding/unfolding animation with polished glint. Respects reduced-motion preferences.
- Retained V61.7 SVG icon shapes, giving primary metallic buttons a more realistic polished/antique brass finish.
- Preserved all app modules and browser/session navigation state and all original authentication and playback handlers.

## Deploy
Unzip and upload **the contents of this directory** to the published GitHub Pages repository root. Replacing the previous V61.7 files in one commit is recommended to avoid mix-and-match CSS. Hard-refresh after deploy.

## Important
Static verification covers JavaScript syntax, local file resolution, both rail states, and ZIP integrity. Live authenticated Supabase/Spotify integration is not reproducible locally.
