-- Adds the "נמל" (port) shift as a regular, selectable shift period.
-- (Enum values must be committed before use, so the rows are inserted in the next migration.)
alter type public.period_code add value if not exists 'port' before 'morning';
