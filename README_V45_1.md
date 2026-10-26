# Dead Wax v45.1 · Floating Turntable Refinement

An additive patch to **your original Dead Wax v45**, preserving its v43 record application, Supabase connection, physical listening toggle and diary, and Spotify integration modules.

## Improvements

- Compact deck, closer tonearm pivot, more natural needle reach.
- Starts on the outer groove and rotates gradually inward to reflect real playback progress.
- Deck shows the record's actual **Shelf ID** in place of `DW / 45`.
- Clearly labeled **MINIMIZE** control: collapse/expand without stopping playback.
- Drag the stylus or vinyl grooves to preview the target song *live*; the track snaps to its band as you move forward or backward.
- A live cue readout below the deck shows track number, name, and INWARD / OUTWARD direction; the sleeve tracklist and groove band highlight synchronize in real time.
- Release to cue the chosen track with the needle lifted; **Drop needle** to play from that song's beginning. No Spotify seek or skip request occurs during movement.
- Black record, visual groove imperfections, fixed record-id and track-count markings are retained.

## Install (over existing v45)

1. Back up your live `main` branch. Ideally stage on a new GitHub branch before merging to the GitHub Pages deployment branch.
2. Extract `deadwax_v45_1_changed_files.zip` and replace these three paths in your existing v45 repository:
   - `index.html`
   - `css/deadwax-turntable-v45.css`
   - `js/deadwax-turntable-v45.js`
3. Keep **everything else**, including the Spotify module, callback page, config, Supabase SQL, original v43 JS/CSS, and other content. The changed-files ZIP is **not** a standalone website.
4. Validate in a browser, including your own record IDs/tracklists and Spotify Premium playback when deployed.

The complete-site ZIP is also included if you prefer a full replacement release after backing up your current repository.

## Verification and boundaries

- Baseline browser integration test against original v43 DOM and mocked Supabase: passed.
- Mock Spotify SDK / API progression, multi-track playback and end-of-side stopping: passed.
- Dedicated six-track test of the track cue preview, snaps in both directions, sleeve highlight, release/drop, minimize/expand and mobile: passed.
- The existing physical listening tables/flags and Spotify integration implementation were not changed.
- Spotify authorization on a real account remains to be verified after you deploy.
- There are no new Supabase schema requirements, no audible crackle over Spotify, and no GitHub or database changes made by the assistant.
