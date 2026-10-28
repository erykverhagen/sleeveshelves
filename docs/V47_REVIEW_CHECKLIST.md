# V47 review checklist

Please review these **in order** on a staging deployment using your real collection:

1. **Collection + ambience:** Open All Records with no selected sleeve. Confirm the darker smoked-glass panes read as layers over a warm amber environment; photo covers dominate; search, grouping and filters remain easy to reach. Expand/collapse the left nav and verify no lost navigation.
2. **Detail + turntable composition:** Select a multi-disc record with a long title. The right pane should show album header and authentic status controls, then the real tracklist, followed by the always-present parked platter. It must not open as a floating window. Details and tracks scroll internally.
3. **Needle ritual:** Choose side A, drop the needle, lift/pause, use arrow-key cue on the focused platter or drag the stylus to another groove, drop again, turn to side B manually, then Stop. Normal track rows do not seek playback. Minimize and restore the whole right pane without losing the selected record or playback state.
4. **Editing + diary:** Hover artwork for Edit Record, confirm multi-disc Add Disc yields C/D and E/F, collection memberships are selectable, Remove stays in the editor, and physical Listening Diary counts change only after an intentional log.
5. **Responsiveness + integrations:** Try approximately 1920 px, 1440 px and 1024 px. Test Supabase login/session persistence, actual record edit/save, a filter combination, Spotify connect, import/export, and appearance/accessibility settings.

Release blockers: overlapping metadata; controls hidden behind glass; an unexpected floating turntable while record pane is open; incorrect side selection or unexpected diary mutation; missing source features; browser console errors; lost Supabase data.
