# Dead Wax v45 · Digital Turntable + Spotify (private integration test)

This release extends the user's **original Supabase-native Dead Wax v43 application** and the approved **v44.3 floating turntable**. It does **not replace or refactor the original collection UI, database loading, edit functions, or physical Listening Diary**.

## What's new

- **Real Spotify OAuth PKCE** with the registered Client ID and exact GitHub Pages callback.
- Connected Spotify Web Playback SDK device, Spotify account connection/disconnection under **Settings → Profile**.
- On-demand track search with **explicit confirmation of each physical vinyl track**. No automatic selection of an alternate edition without user confirmation.
- **Side-only playback** with no skip/seek/shuffle/repeat controls. Start Side A/B/C/D, play tracks in order, and stop at the end of the side. Spotify still permits control from its own clients; stopping relies on SDK state timing and needs real-account validation.
- Black vinyl with distinct grooves for each track; continuous needle progression tied to the **real Spotify playback position** or the simulation clock when disconnected.
- Grab the stylus or click/drag on a groove to cue a different track: this **lifts** the needle and pauses music. **Drop needle** plays the selected track from its beginning.
- **Floating original-album sleeve**: click the front to open the **existing** record-detail screen; flip to see the physical tracklist and cue any track.
- Premium feature classification with **Free Preview enabled** for everyone. Future paid gating needs a verified server entitlement provider.
- All physical listening data remains untouched by Spotify playback; no digital event writes to `records.listened`, `listening_sessions`, `listen_count`, etc.
- Vinyl crackle is **visual only** for Spotify, due to Spotify's policy against mixing/segueing other audio.

## Install safely (do not deploy until you approve)

1. **Back up `main`.** Create a new GitHub branch (for example `feature/deadwax-v45`). GitHub Pages currently publishes the configured branch, usually `main`.
2. Extract **`deadwax_v45_changed_files.zip`** and copy the contents into matching repository folders, preserving paths (`css/`, `js/`, `docs/`). The new root-level `spotify-callback.html` must be in the same folder as `index.html`.
3. Keep all existing application files. `index.html` is the **only modified original file**. Existing `js/deadwax-native-exact-v43.js` and `css/deadwax-static-v43.css` remain identical to your uploaded original.
4. Inspect the branch and only merge/deploy to GitHub Pages when you want the Spotify callback to go live.
5. Confirm the **Spotify Developer Dashboard → Redirect URIs** contains **exactly** `https://erykverhagen.github.io/test/spotify-callback.html`. The app needs **Web API** and **Web Playback SDK**.
6. After the new version has been deployed with your approval, sign in to Dead Wax, open **Account → Settings → Profile → Connect Spotify**, and authorize it with your Spotify Premium account.
7. Open a record with a physical tracklist and choose **Play side A**. Confirm the correct Spotify versions in the matching dialog; use the custom search field for remasters/alternate versions.
8. Browse Grid, List and Cover Flow, flip the sleeve in the floating player, lift/drop the needle, turn the record, and check that marking physical listens has not changed.

## Supabase persistence (optional until approved)

The Spotify integration **works without a new SQL migration** for private tests, but verified track matches are then cached **only in the current browser tab** and need reconfirmation on a new visit. To retain them across sessions and devices, review and apply `docs/DIGITAL_TURNTABLE_V45.sql` in the Supabase SQL editor. The migration **only creates** `public.digital_track_matches` with per-user Row Level Security; it does **not** alter `public.records` or the physical listening tables. Never put Spotify tokens in Supabase match rows.

Do not run this migration unless you approve the database change separately.

## How Spotify authorization works

The browser uses Authorization Code + PKCE and the public Client ID `fc0940a0a57440c3b510d779180d1ab9`. It requires **no Client Secret**. Spotify access/refresh tokens are stored in **browser sessionStorage for this tab**, not in Supabase or GitHub. Authorization state and code verifier are checked and cleared when the callback completes. Dead Wax sign-out and Spotify Disconnect clear that session state.

## Verification performed

- JavaScript syntax checks with Node.js for both new modules.
- Automated Chromium tests using the **original v43 markup and Supabase stub**: Grid/List/Cover Flow, existing detail modal, track counts, side switching, manual stylus dragging, tracklist sleeve flip, clicking sleeve to open the original detail, responsive mobile layout, and **zero physical listening writes**.
- Automated Chromium **mock Spotify Web API/Web Playback SDK**: device readiness, OAuth token restoration, Spotify candidate matching confirmation, transfer to the browser device, live SDK progress linked to stylus movement, multi-track side advancement, end-of-side stop, and no physical listening writes.

**Not verified:** live Spotify login/playback on the owner's real Premium account, real Spotify matching responses, persistent matches against the production Supabase table, and audio/autoplay behavior across every browser. These tests require the deployed callback and owner authorization. No files were uploaded to GitHub and no Supabase SQL was run.

## Spotify licensing and known restrictions

- New Development Mode Spotify applications have **up to five authorized users** and require the app owner to have Premium. This is a *private development test*, not universal public Spotify access.
- The Spotify Web Playback SDK is **not authorized for commercial use without prior written approval**. Paid Dead Wax Premium must not enable Spotify streaming commercially without that approval or an authorized alternative.
- **No audible crackle, crossfade, or overlapping audio effects** on Spotify content.
- Spotify Connect can be controlled externally, so playback sequencing is **best effort**: the app monitors changes and pauses unauthorized tracks, but exact track-end timing and browser autoplay are subject to Spotify and the browser. The app aims to stop near the end of the last track; this needs real playback QA.
- Browsers with DRM/autoplay restrictions may require a fresh user click or a compatible browser such as Chrome.

## Changed / new files

- Modified original: `index.html` (asset reference additions only; original markup otherwise unchanged).
- Added: `spotify-callback.html`, `js/deadwax-turntable-v45.js`, `js/deadwax-spotify-v45.js`, `css/deadwax-turntable-v45.css`, `css/deadwax-spotify-v45.css`, `docs/DIGITAL_TURNTABLE_V45.sql`, this README.
- Supersedes but does not overwrite previous `v44` turntable files.
