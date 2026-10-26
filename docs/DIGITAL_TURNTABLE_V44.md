# Dead Wax v44.2 · Animated Floating Digital Turntable

**Baseline:** the user's unmodified Dead Wax v43 original (`test-main.zip`), with the isolated v44 demo feature added. This version replaces the *v44 foundation* addon files only. Neither Spotify playback nor audio is connected.

## What's new

- A dedicated **bottom-right floating player** on a higher stacking layer, visible in the home/collection **and** while a record detail modal is open.
- A hand-crafted **skeuomorphic CSS turntable** with a rotating LP, cover-art center label, animated S-shaped chrome tonearm with a visible stylus on the LP, brushed-metal platter, wood cabinet, speed marking and status light. Reduced-motion preferences are respected.
- **Minimize** the full player into a small, persistent Now Spinning launcher, then reopen it without changing the playback state. The minimized launcher also remains visible in the record detail view.
- **The active record is identified across Grid, List, Cover Flow, Cover Flow metadata and search results.** Markers distinguish digital playback from the original physical listened icon and listening diary.
- In the detail modal for the active record, a **Now Spinning** marker appears beneath the album metadata, its currently playing track is highlighted and a small inline status offers "Open turntable". Other records show no misleading playback indication.
- Record detail retains **Play Side A/B/C/D/E/F…** controls and the original tracklist.

## Needle animation (v44.2)

- The tonearm is visibly mounted above the platter and its stylus reaches the playable groove when a side starts.
- Starting playback cues the needle **from the rest position onto the LP**.
- **Lift needle** raises the stylus slightly but keeps it above the current groove; **Drop needle** lowers it again without resetting the track.
- **Stop / reset**, **Turn record** and natural end-of-side swing the arm **back to its rest outside the LP**. The record stops rotating; stop still rewinds to track 1.
- The deck DOM node is retained between state changes, so CSS transitions are continuous and aren't cancelled by a re-render.
- Motion-reduction settings disable motion effects; all playback in this release remains silent simulation only.

## Interaction rules

1. Choose a side from an original record's detail tracklist. The turntable starts a five-second-per-track **silent simulation** of that side; no audio is produced.
2. **Lift needle** pauses at the current track; **Drop needle** resumes it.
3. **Stop / reset** returns to the beginning of the selected side and stops.
4. **Turn record** moves to the other side of the same physical disc (A↔B, C↔D, etc.), resets to that side's first track and waits for a needle drop.
5. **Swap record** ends this session, hides the player and returns to the main collection if record details were open.
6. The final track stops automatically. No auto-repeat, seeking, skipping or shuffle.
7. The popup remains above the record detail screen; editing and settings modals temporarily hide it, but do not reset the session.

## Explicit preservation / regression boundaries

- Original v43 `js/deadwax-native-exact-v43.js`, `css/deadwax-static-v43.css`, Supabase config and schemas are **byte-for-byte unchanged**.
- **No writes to Supabase** and **no updates to physical `listened`, `listen_count`, `last_listened_at` or `listening_sessions`** from this feature. Streaming sessions are intentionally separate from physical listens.
- The addon is implemented as a standalone `js/deadwax-turntable-v44.js` and `css/deadwax-turntable-v44.css` plus **two cache-busted addon references** in original `index.html`.
- The original collection layout and record modal markup are not replaced. Player and active-record indicators are attached non-destructively at runtime.
- Entitlement metadata: `digital_turntable` → `premium`, `publicPreview: true`. This is not yet a server-enforced paid subscription entitlement.
- Spotify OAuth, matching, licensed audio playback and permitted vinyl-crackle mixing are **not included**.

## Upload to GitHub

1. **Preferred:** create a new development branch in `erykverhagen/test` (not `main`). GitHub Pages currently uses the main branch, so uploading directly to main would modify your live app.
2. Extract `deadwax_v44_animated_needle_changed_files.zip`. GitHub's Upload Files dialog **does not unpack ZIP files**.
3. Copy these files into their matching GitHub folders:
   - `index.html` → repository root
   - `js/deadwax-turntable-v44.js` → `js/`
   - `css/deadwax-turntable-v44.css` → `css/`
   - `docs/DIGITAL_TURNTABLE_V44.md` → `docs/`
4. Keep all other original files as they are. Test using a branch preview or local/static hosting before merging to `main`.
5. If you would rather replace the full repository source in one operation, extract `deadwax_v44_animated_needle_complete_site.zip` instead. Its root contains `index.html`, `js/`, `css/`, `docs/` and Supabase config. **Do not upload the ZIP itself as a file in the repository expecting Pages to unpack it.**

## Smoke tests already run

- Original app loaded with real v43 HTML/CSS/JS against a synthetic Supabase session containing two records.
- Grid active-record badge, List active-record badge, Cover Flow card and metadata badges.
- Persist across detail-open/detail-close, minimized and expanded states and view switching.
- Correct record indicated in its own detail page; other records aren't misidentified.
- Pause, stop/reset, turn, swap and clearing badges.
- Floating panel higher in stacking order than the detail modal; small viewport fit.
- No captured JavaScript exceptions and no synthetic Supabase record writes.

These are isolated browser integration checks. **Live authentication, full collection-data regression and actual streaming have not been tested.**


## v44.3: physical grooves and tracked needle

- Vinyl groove rings are generated from the number of tracks on the selected physical side.
- Track boundaries and a muted active-track band appear on the record surface.
- The needle advances inward gradually across each track, reflecting simulated elapsed time, and jumps to the next boundary at the next track.
- Pausing lifts but preserves the needle's current groove location. Stop/turn parks the arm.
- A very subtle deterministic micro-scratch texture is drawn **within the grooves** and changes appearance slightly while spinning.
- This texture is **visual only**. No crackle is mixed into Spotify streams or other audio. Audible groove transition effects require a provider that explicitly allows them.
- All original v43 source files and the physical listening diary remain unchanged.
