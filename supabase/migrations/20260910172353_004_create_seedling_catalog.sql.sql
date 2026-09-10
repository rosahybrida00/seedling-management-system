/*
# Create seedling_catalog table — Second catalog for seedlings

## Overview
Creates a dedicated `seedling_catalog` table for the Seedling Catalogue,
a second catalog that coexists independently with the General Catalogue
(`varieties`). When a seedling is marked as "levée" (germinated) in the
greenhouse, it is automatically injected into this catalog.

## New Tables

### `seedling_catalog` — Seedling Catalogue entries
- `id` uuid PK
- `user_id` uuid NOT NULL DEFAULT auth.uid() — owner
- `seedling_id` uuid FK → seedlings(id) ON DELETE SET NULL — link to the source seedling (nullable after deletion)
- `code` text NOT NULL — auto-generated nomenclature code (e.g. "blagra-A-b-12-2026")
- `name` text — variety name (manual entry)
- `obtenteur` text — breeder name (auto-filled from profile)
- `seed_parent` text — female parent name
- `pollen_parent` text — male parent name
- `height` text — height (manual entry)
- `width` text — width/spread (manual entry)
- `flower_diameter` text — flower diameter (manual entry)
- `port` text — growth habit (from traits)
- `feuillage` text — foliage type (from traits)
- `rusticite` text — hardiness (from traits)
- `sol` text — soil type (from traits)
- `adr_label` boolean DEFAULT false — ADR label
- `notes` text — free-form notes from the hybridizer
- `photo_url` text — optional photo
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

## Security
- RLS enabled, owner-scoped CRUD (auth.uid() = user_id).
- user_id defaults to auth.uid() so inserts omitting it still work.

## Indexes
- On user_id for owner-scoped queries.
- On code for search.
*/

CREATE TABLE IF NOT EXISTS seedling_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  seedling_id uuid REFERENCES seedlings(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text,
  obtenteur text,
  seed_parent text,
  pollen_parent text,
  height text,
  width text,
  flower_diameter text,
  port text,
  feuillage text,
  rusticite text,
  sol text,
  adr_label boolean DEFAULT false,
  notes text DEFAULT '',
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE seedling_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_seedling_catalog" ON seedling_catalog;
CREATE POLICY "select_own_seedling_catalog" ON seedling_catalog FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_seedling_catalog" ON seedling_catalog;
CREATE POLICY "insert_own_seedling_catalog" ON seedling_catalog FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_seedling_catalog" ON seedling_catalog;
CREATE POLICY "update_own_seedling_catalog" ON seedling_catalog FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_seedling_catalog" ON seedling_catalog;
CREATE POLICY "delete_own_seedling_catalog" ON seedling_catalog FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_seedling_catalog_user_id ON seedling_catalog (user_id);
CREATE INDEX IF NOT EXISTS idx_seedling_catalog_code ON seedling_catalog (code);
