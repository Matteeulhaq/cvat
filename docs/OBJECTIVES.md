# Objectives

## Test environment

| Field                    | Value                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| CPU                      | AMD Ryzen 5 5600 (6 cores / 12 threads)                           |
| RAM                      | 15.9 GB                                                           |
| Operating system         | Windows 11 Home (build 26200)                                     |
| Docker                   | Docker 29.9.2, Docker Compose v5.6.1                              |
| CVAT commit SHA          | `4a09e27ff869b7aebbfdb07b29c4a34904a0221d` (same SHA as the Plan) |
| Dataset                  | COCO 2017 val, all 5,000 images imported                          |
| Annotations in test task | 41,866 (from `docs/evidence/counts-sql.txt`; val2017 ships 36,781 raw instance annotations — multi-part segmentations import as multiple shapes) |
| Classes in test task     | 80 (all COCO thing classes; `docs/evidence/counts-response.json`)                                                                |

### Machine capacity (checked before measuring)

- CVAT stores task images on disk and serves frames on demand in chunks, so RAM does not grow with image count.
- The database holds one row per annotation (`engine_labeledshape`), not one per image.
- With ~64 GB free on the data disk, the ceiling is several hundred thousand COCO-sized images (~200 KB each). All 5,000 of val2017 (~800 MB of images, ~37k shape rows) are far inside the machine's limits; import time is the only cost that grows with N.

## MO-1: Endpoint response time

| Field | Entry |
|-------|-------|
| What is measured | Total response time of `GET /api/test/tasks/<task_id>/class-counts` for the sample task, as reported by curl (`time_total`). |
| How | One warm-up request is discarded. Then 5 timed requests, run one after another, using the command below. Raw output saved to `docs/evidence/mo1-raw.txt`. |
| Target | **Median of 5 runs at or below 250 ms.** |
| Why this target | I set it before measuring. A task of 5,000 COCO images holds roughly 36-37 thousand shape rows (val2017 ships about 36.8k annotations), and the count is a single grouped aggregate over an indexed foreign key, so the database work should still be small even at this size. Most of the cost is expected to be CVAT's authentication and permission check, not the count. 250 ms is a real test of that: it fails if I accidentally loop over rows in Python or run one query per label, and it is not so tight that it only measures my laptop. |
| Conditions | Local Docker stack, the sample task above, authenticated as the superuser, `group_by` not set, nothing else heavy running, same machine for all 5 runs. |
| Not included | The first request after a cold start (the warm-up), video tasks, the `group_by=shape_type` variant, and browser render time. |

### Results (filled in only after measuring)

| Run | Time (s) |
|-----|----------|
| 1 | 0.299327 |
| 2 | 0.270090 |
| 3 | 0.284425 |
| 4 | 0.288551 |
| 5 | 0.264006 |

- Median: **0.284425 s (284.4 ms)**
- Min / Max: **0.264006 s (264.0 ms)** / **0.299327 s (299.3 ms)**
- Target met: **no** — median 284.4 ms against the 250 ms target (missed by 34.4 ms); reported as missed per the rules above
- If missed: I investigated before writing this. Raw output including the investigation is in `docs/evidence/mo1-raw.txt`. Three findings: (1) the database aggregate itself costs 40.5 ms (`EXPLAIN ANALYZE`, index scan over all 41,866 shape rows, 80 groups); (2) an existing CVAT endpoint guarded by the same permission layer, `GET /api/tasks/2`, costs the same as mine (273–430 ms over three runs); (3) an endpoint with authentication but no OPA permission check, `GET /api/server/about/`, costs 6–14 ms. So the ~284 ms is dominated by CVAT's per-request OPA authorization round trip, which every task endpoint pays, not by the class-count query. What I would change if this were a product endpoint: cache OPA decisions for repeated (user, resource, scope) triples, or evaluate the policy in-process — both are platform-level changes outside this task's scope. What I would NOT do is optimize the query: 40 ms of the 284 ms is the count, and halving it would not move the median under the target.

### Honest reading of the result

The time is dominated by the authentication/authorization layer, not by the database query. I know because I measured all three parts separately (commands and outputs in `docs/evidence/mo1-raw.txt`): the aggregate runs in 40.5 ms in Postgres (`EXPLAIN ANALYZE`), the whole request takes ~284 ms, an existing endpoint behind the same OPA permission check (`GET /api/tasks/2`) takes the same ~273–430 ms, and an endpoint with authentication but no permission check (`GET /api/server/about/`) takes 6–14 ms. The ~240 ms gap between the last two is the OPA round trip that CVAT's `PolicyEnforcer` makes for every task-scoped request; my endpoint pays it like every other one.

## Rules I follow for every number in this repository

- Every number comes from my own machine and is saved as raw output under `docs/evidence/`.
- Every measurement is 5 runs, reported as median and spread.
- Nothing is rounded to look better, and a missed target is reported as missed.
