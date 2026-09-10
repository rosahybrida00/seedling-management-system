/*
# Allow 'germinated' status for seedlings

## Overview
The seedlings table has a CHECK constraint on status that only allows
'observing', 'discarded', 'selected'. We need to add 'germinated' for the
new "levée" (germinated) workflow.

## Changes
- Drop and recreate the CHECK constraint on seedlings.status to include 'germinated'.
*/

ALTER TABLE seedlings DROP CONSTRAINT IF EXISTS seedlings_status_check;
ALTER TABLE seedlings ADD CONSTRAINT seedlings_status_check
  CHECK (status IN ('observing', 'discarded', 'selected', 'germinated'));
