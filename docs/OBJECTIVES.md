# Objectives

## Test environment

| Field                    | Value                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU                      | AMD Ryzen 5 5600 (6 cores / 12 threads)                                                                                                                                                                                                                             |
| RAM                      | 15.9 GB                                                                                                                                                                                                                                                             |
| Operating system         | Windows 11 Home (build 26200)                                                                                                                                                                                                                                       |
| Docker                   | Docker 29.9.2, Docker Compose v5.6.1                                                                                                                                                                                                                                |
| CVAT commit SHA          | `4a09e27ff869b7aebbfdb07b29c4a34904a0221d` (same SHA as the Plan)                                                                                                                                                                                                   |
| Dataset                  | COCO 2017 val, all 5,000 images imported (actual: `[FILL: N]`)                                                                                                                                                                                                      |
| Annotations in test task | 36,781 expected from the dataset (val2017 ships 36,781 instance annotations, ~7 per image). `[FILL: actual from the SQL count in the Definition of Done]` — may differ slightly, since the COCO importer can emit more than one shape for a multi-part segmentation |
| Classes in test task     | 80                                                                                                                                                                                                                                                                  |

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
| 1 | `[FILL]` |
| 2 | `[FILL]` |
| 3 | `[FILL]` |
| 4 | `[FILL]` |
| 5 | `[FILL]` |

- Median: `[FILL]`
- Min / Max: `[FILL]` / `[FILL]`
- Target met: `[FILL: yes / no]`
- If missed: `[FILL: what I found, whether I investigated, and what I would change]`

### Honest reading of the result

`[FILL: one or two sentences. For example, whether the time is dominated by the database query or by the authentication layer, and how I know. Do not guess: if I did not check, say so.]`

## Rules I follow for every number in this repository

- Every number comes from my own machine and is saved as raw output under `docs/evidence/`.
- Every measurement is 5 runs, reported as median and spread.
- Nothing is rounded to look better, and a missed target is reported as missed.
