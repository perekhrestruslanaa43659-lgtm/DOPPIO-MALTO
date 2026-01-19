-- Migration to fix postazioni field in Staff table
-- This will recreate the column with proper array type
-- Step 1: Add a temporary column
ALTER TABLE "Staff"
ADD COLUMN IF NOT EXISTS postazioni_new text [];
-- Step 2: Migrate data from old column to new column
-- Handle various formats: empty strings, comma-separated values, existing arrays
UPDATE "Staff"
SET postazioni_new = CASE
        WHEN postazioni::text = ''
        OR postazioni::text = '{}' THEN ARRAY []::text []
        WHEN postazioni::text LIKE '{%}' THEN -- Already in array format, extract values
        string_to_array(
            regexp_replace(
                regexp_replace(postazioni::text, '^{', ''),
                '}$',
                ''
            ),
            ','
        )
        ELSE -- Treat as comma-separated string
        string_to_array(postazioni::text, ',')
    END;
-- Step 3: Clean up the array values (trim whitespace)
UPDATE "Staff"
SET postazioni_new = ARRAY(
        SELECT trim(unnest(postazioni_new))
        WHERE trim(unnest(postazioni_new)) != ''
    );
-- Step 4: Drop old column
ALTER TABLE "Staff" DROP COLUMN postazioni;
-- Step 5: Rename new column to original name
ALTER TABLE "Staff"
    RENAME COLUMN postazioni_new TO postazioni;
-- Step 6: Ensure NOT NULL constraint with default empty array
ALTER TABLE "Staff"
ALTER COLUMN postazioni
SET DEFAULT ARRAY []::text [];
UPDATE "Staff"
SET postazioni = ARRAY []::text []
WHERE postazioni IS NULL;
ALTER TABLE "Staff"
ALTER COLUMN postazioni
SET NOT NULL;