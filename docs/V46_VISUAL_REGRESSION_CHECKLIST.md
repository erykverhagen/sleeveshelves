# SleeveShelves V46 acceptance checklist

**Baseline:** User-supplied V45.3, not a guessed V46. **Status:** mocked UI smoke checks completed, full acceptance pending live test.

### Real data and access
- [ ] Authenticate existing Supabase account, refresh, sign out, sign back in.
- [ ] Compare record IDs/counts, cover URLs, metadata, record_collections links with production baseline.
- [ ] Create, rename and remove collections; verify multi-collection membership.
- [ ] Edit disposable record, including grail, reactions, custom track sides and artwork.
- [ ] Remove a disposable record via the guarded editor action.
- [ ] Test CSV import, CSV/Excel/PDF export without changing original field values.

### Navigation and presentation
- [x] Grid, List, Cover Flow render with mocked records.
- [x] Search/filter, collection navigation and filter drawer open with mocked records.
- [x] Collapsible navigation; independent center scroll and floating selected detail.
- [x] No simulated app data shipped in the deployable site.
- [ ] Verify 1440px, 1080px and narrow-screen device sizes with the real collection.
- [ ] Verify settings 12-inch / Double Album / Box Set, focus and reduced motion.
- [ ] Verify popup, dropdown, edit, user and authentication backgrounds for legibility.

### Turntable
- [x] Test session can start visual side playback with native engine.
- [ ] Live needle drag with real catalog-side tracks and Spotify Premium.
- [ ] Confirm accurate provider resume/pause/stop and track mapping.
- [ ] Confirm end-of-side/manual flip without unintended automatic playback.
- [ ] Test OAuth callback after any hostname/domain migration.
- [ ] Verify session minimization does not alter listened counts.

### Gaps identified in V45.3 source
- [ ] Implement/merge actual per-session Listening Diary if available in a newer verified build.
- [ ] Decide whether the virtual turntable should be embedded rather than retaining the standalone dock.
- [ ] Decide whether to change native Shelf ID + Artist edit validation (requires separate assessment).
- [ ] Decide whether separate record-detail tabs and notifications should be developed as new features.

No database migration is needed by this visual pass.
