-- Custom SQL migration file, put your code below! --

-- Garmin's "Time UTC" extended-data field is "M/D/YYYY H:MM:SS AM/PM" with no
-- zero-padding (e.g. "5/4/2026 1:05:00 PM"). It was being stored as-is in the
-- text `timestamp` column, so lexicographic ordering broke: "5/10/..." sorts
-- before "5/4/..." because '1' < '4'. The ingestion code (garmin.service.ts)
-- now parses this into zero-padded ISO8601 UTC before storing. This migration
-- reformats existing rows the same way so they sort correctly too — it only
-- rewrites the string representation, the underlying instant is unchanged.
-- Re-runnable: only touches rows still in the old "M/D/YYYY ..." format.
UPDATE tracking_points t
SET timestamp = format(
  '%s-%s-%sT%s:%s:%s.000Z',
  m[3],
  lpad(m[1], 2, '0'),
  lpad(m[2], 2, '0'),
  lpad((
    CASE
      WHEN upper(m[7]) = 'PM' AND m[4]::int <> 12 THEN m[4]::int + 12
      WHEN upper(m[7]) = 'AM' AND m[4]::int = 12 THEN 0
      ELSE m[4]::int
    END
  )::text, 2, '0'),
  lpad(m[5], 2, '0'),
  lpad(m[6], 2, '0')
)
FROM (
  SELECT id, regexp_match(
    timestamp,
    '^(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$',
    'i'
  ) AS m
  FROM tracking_points
  WHERE timestamp ~* '^\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s*(AM|PM)$'
) sub
WHERE t.id = sub.id;
