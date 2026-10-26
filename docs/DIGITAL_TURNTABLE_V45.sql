-- Dead Wax v45: optional persistence for explicitly approved Spotify track matches.
-- This is additive. Does not change records, physical listening, or existing collections.
-- Only run in Supabase after reviewing this migration; v45 can privately test without it.
CREATE TABLE IF NOT EXISTS public.digital_track_matches (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shelf_id text NOT NULL,
  side text NOT NULL,
  position text NOT NULL,
  physical_title text NOT NULL,
  spotify_uri text NOT NULL CHECK (spotify_uri ~ '^spotify:track:[A-Za-z0-9]+$'),
  spotify_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,shelf_id,side,position)
);
ALTER TABLE public.digital_track_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS digital_track_matches_user_select ON public.digital_track_matches;
CREATE POLICY digital_track_matches_user_select ON public.digital_track_matches
FOR SELECT USING (auth.uid()=user_id);
DROP POLICY IF EXISTS digital_track_matches_user_insert ON public.digital_track_matches;
CREATE POLICY digital_track_matches_user_insert ON public.digital_track_matches
FOR INSERT WITH CHECK (auth.uid()=user_id);
DROP POLICY IF EXISTS digital_track_matches_user_update ON public.digital_track_matches;
CREATE POLICY digital_track_matches_user_update ON public.digital_track_matches
FOR UPDATE USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
DROP POLICY IF EXISTS digital_track_matches_user_delete ON public.digital_track_matches;
CREATE POLICY digital_track_matches_user_delete ON public.digital_track_matches
FOR DELETE USING (auth.uid()=user_id);
-- Do not store Spotify access tokens or refresh tokens in this table.
NOTIFY pgrst, 'reload schema';
