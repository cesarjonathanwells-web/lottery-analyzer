-- =============================================================================
-- Materialized Views for Lottery Analysis
-- Run after schema migrations:  psql $DATABASE_URL -f src/lib/db/views.sql
-- Refresh periodically:         REFRESH MATERIALIZED VIEW CONCURRENTLY <name>;
-- =============================================================================

-- ── Number Frequency per Game ────────────────────────────────────────────────
-- Unnests the numbers array and counts how often each number appears.
-- Filter by draw_date in a wrapping query to get a configurable window.

DROP MATERIALIZED VIEW IF EXISTS mv_number_frequency;

CREATE MATERIALIZED VIEW mv_number_frequency AS
SELECT
    d.game_id,
    n.num                                       AS number,
    COUNT(*)                                    AS frequency,
    MAX(d.draw_date)                            AS last_seen,
    ROUND(
        COUNT(*)::numeric
        / NULLIF(
            (SELECT COUNT(*) FROM draws d2 WHERE d2.game_id = d.game_id),
            0
        ) * 100,
        2
    )                                           AS percentage
FROM draws d,
     LATERAL unnest(d.numbers) AS n(num)
GROUP BY d.game_id, n.num
ORDER BY d.game_id, frequency DESC;

CREATE UNIQUE INDEX ON mv_number_frequency (game_id, number);


-- ── Pair Co-occurrence per Game ──────────────────────────────────────────────
-- For every draw, generates all unordered pairs from the numbers array and
-- counts how often each pair appears together.

DROP MATERIALIZED VIEW IF EXISTS mv_pair_frequency;

CREATE MATERIALIZED VIEW mv_pair_frequency AS
SELECT
    d.game_id,
    LEAST(a.num, b.num)        AS num_a,
    GREATEST(a.num, b.num)     AS num_b,
    COUNT(*)                   AS frequency,
    MAX(d.draw_date)           AS last_seen
FROM draws d,
     LATERAL unnest(d.numbers) AS a(num),
     LATERAL unnest(d.numbers) AS b(num)
WHERE a.num < b.num
GROUP BY d.game_id, LEAST(a.num, b.num), GREATEST(a.num, b.num)
ORDER BY d.game_id, frequency DESC;

CREATE UNIQUE INDEX ON mv_pair_frequency (game_id, num_a, num_b);


-- ── Current Gap Analysis per Number per Game ─────────────────────────────────
-- For each number in each game, computes:
--   gap_current  : draws since the number last appeared
--   gap_average  : average gap across all appearances
--   last_seen    : most recent draw date the number appeared

DROP MATERIALIZED VIEW IF EXISTS mv_gap_analysis;

CREATE MATERIALIZED VIEW mv_gap_analysis AS
WITH numbered_draws AS (
    -- Assign a sequential draw rank per game (most recent = highest)
    SELECT
        d.id,
        d.game_id,
        d.draw_date,
        ROW_NUMBER() OVER (PARTITION BY d.game_id ORDER BY d.draw_date, d.draw_time) AS draw_seq
    FROM draws d
),
appearances AS (
    SELECT
        nd.game_id,
        n.num           AS number,
        nd.draw_seq,
        nd.draw_date
    FROM numbered_draws nd,
         LATERAL unnest((SELECT numbers FROM draws WHERE id = nd.id)) AS n(num)
),
max_seq AS (
    SELECT game_id, MAX(draw_seq) AS latest_seq
    FROM numbered_draws
    GROUP BY game_id
),
gaps AS (
    -- Compute gap between consecutive appearances
    SELECT
        a.game_id,
        a.number,
        a.draw_seq,
        a.draw_date,
        a.draw_seq - COALESCE(
            LAG(a.draw_seq) OVER (PARTITION BY a.game_id, a.number ORDER BY a.draw_seq),
            0
        ) AS gap
    FROM appearances a
)
SELECT
    g.game_id,
    g.number,
    ms.latest_seq - MAX(g.draw_seq)             AS gap_current,
    ROUND(AVG(g.gap)::numeric, 2)               AS gap_average,
    MAX(g.draw_date)                             AS last_seen
FROM gaps g
JOIN max_seq ms ON ms.game_id = g.game_id
GROUP BY g.game_id, g.number, ms.latest_seq
ORDER BY g.game_id, gap_current DESC;

CREATE UNIQUE INDEX ON mv_gap_analysis (game_id, number);
