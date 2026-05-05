# 🛠️ Tier Migration Implementation Checklist

**Date:** 2026-01-03
**Target:** Add `tier` column to `rag_rule_candidates` and implement tier-based logic.
**Base Strategy:** [2601032000_tier_migration.md](plan_report/2601032000_tier_migration.md)

## [Phase 1: Database Migration]

**Before Start:**

- ⚠️ 주의: Do NOT run `DROP COLUMN` in production without backup.
- ⚠️ 주의: Validate `CHECK` constraint syntax for Supabase PostgreSQL.

**Implementation Items:**

- [ ] **ID(P4-03-A)**: Add `tier` column to `rag_rule_candidates`

  - `Target`: Supabase SQL Editor > `rag_rule_candidates` table
  - `Logic (SQL)`:
    ```sql
    ALTER TABLE rag_rule_candidates ADD COLUMN IF NOT EXISTS tier TEXT;
    ALTER TABLE rag_rule_candidates ADD CONSTRAINT check_tier CHECK (tier IN ('core', 'style', 'detail'));
    CREATE INDEX idx_tier ON rag_rule_candidates(tier);
    ```
  - `Safety`: use `IF NOT EXISTS` to prevent errors if re-run.

- [ ] **ID(P4-03-B)**: Populate existing data (Optional Data Migration)
  - `Target`: Supabase SQL Editor
  - `Logic (SQL)`:
    ```sql
    UPDATE rag_rule_candidates
    SET tier = CASE
      WHEN pattern_type IN ('hook', 'problem') THEN 'core'
      WHEN pattern_type IN ('metaphor', 'contrast') THEN 'style'
      ELSE 'detail' -- Simplified logic for example
    END
    WHERE tier IS NULL;
    ```

**Definition of Done (검증):**

- [ ] Test: `INSERT INTO rag_rule_candidates (..., tier) VALUES (..., 'invalid_tier')` should FAIL.
- [ ] Test: `SELECT * FROM rag_rule_candidates WHERE tier = 'core'` returns expected rows.

## [Phase 2: Backend API Updates]

**Before Start:**

- ⚠️ 주의: `rag_rule_candidates` insert/update logic needs to accept `tier`.

**Implementation Items:**

- [ ] **ID(P4-03-C)**: Update `POST /api/rubrics/candidates` to save `tier`

  - `Target`: `frontend/src/app/api/rubrics/candidates/route.ts` > `POST` handler
  - `Logic (Pseudo)`:
    ```typescript
    // In map function for insertData
    const tier = determineTier(c.pattern_type); // Helper function needed
    return {
      ...
      tier: tier // Add this field
    };
    ```
  - `Key Variables`: `insertData`, `determineTier` helper (map `pattern_type` -> `tier`)
  - `Safety`: Handle case where `pattern_type` is new/unknown (default to `detail` or leave `null`?).

- [ ] **ID(P4-03-D)**: Update `GET /api/rubrics/candidates` to return `tier`
  - `Target`: `frontend/src/app/api/rubrics/candidates/route.ts` > `GET` handler
  - `Logic (Pseudo)`:
    ```typescript
    const { tier } = searchParams;
    let query = supabase.from("rag_rule_candidates").select("*");
    if (tier) query = query.eq("tier", tier);
    ```
  - `Key Variables`: `searchParams.get('tier')`

**Definition of Done (검증):**

- [ ] Test: Call `POST` api and check if `tier` is saved in DB.
- [ ] Review: Check types definition in `frontend/src/lib/rag/patternExtractor.ts` matches DB schema.

## [Phase 3: Frontend Integration]

**Before Start:**

- ⚠️ 주의: Verify `PatternAnalysisSection.tsx` state management for filters.

**Implementation Items:**

- [ ] **ID(P4-04)**: Implement Tier Filter UI logic
  - `Target`: `frontend/src/components/Assistant/PatternAnalysisSection.tsx`
  - `Logic (Pseudo)`:
    ```typescript
    const filteredCandidates = useMemo(() => {
      if (tierFilter === "all") return candidates;
      return candidates.filter((c) => c.tier === tierFilter);
    }, [candidates, tierFilter]);
    ```
  - `Key Variables`: `tierFilter` state, `filteredCandidates`
  - `Safety`: Ensure `c.tier` can be undefined/null effectively treated as 'uncategorized' or hidden.

**Definition of Done (검증):**

- [ ] Test: Select "Core" filter -> Only see candidates with `tier === 'core'`.
- [ ] Review: Ensure no console warnings about unique keys or prop types.
