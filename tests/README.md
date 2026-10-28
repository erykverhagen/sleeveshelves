# Stage 2 mock regression

From the project runtime, run:

```sh
python tests/mock_regression.py .
```

Requires Python Playwright and Chromium available at `/usr/bin/chromium`.

Checks Stage 1 safety tests plus first-tab focus containment in a dialog and consistent plus SVG presence. Does not substitute for device-level accessibility, live Supabase/RLS or Spotify tests.
