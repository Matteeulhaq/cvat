# Definition of Done

Written before starting. A box is ticked only when the Evidence column holds a
number, a file path or a link. A tick without evidence counts as not done.

Commands below use these variables:

```bash
export CVAT_USER=admin   CVAT_PASS=admin
export TASK=2
export BASE=http://localhost:8080
```

## A. The floor (items 1 to 4)

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [x] | Endpoint returns per-class counts read from the database (item 1) | `curl -u "$CVAT_USER:$CVAT_PASS" $BASE/api/test/tasks/$TASK/class-counts` | `docs/evidence/counts-response.json` — 80 classes returned for task 2 |
| [x] | Counts match the database exactly | Independent SQL, below. Compare every class. | `docs/evidence/counts-sql.txt` — 80 of 80 classes match, every count equal (re-checked programmatically against the saved response; 41,866 shapes total) |
| [x] | Page in the web UI calls the endpoint (item 2) | Browser network tab shows the request and a 200 | `docs/evidence/page-network.png` — DevTools network tab: `GET /api/test/tasks/2/class-counts` → `200 OK`, response `application/vnd.cvat+json` |
| [x] | Counts shown as a graph (item 3) | Screenshot of the chart for the sample task | `docs/evidence/chart.png` — horizontal bar chart for task 2, all 80 classes (person 12,451 down to toaster 10) |
| [x] | Empty state is handled (item 4) | Open the page for a task with no annotations | `docs/evidence/empty-state.png` — task 3 (no annotations) shows a "No annotations in this task" empty state |
| [x] | Failed request is handled (item 4) | Stop `cvat_server` (or block the request) and reload the page | `docs/evidence/error-state.png` — a failed request (a task id that does not exist → the endpoint answers 404, visible in the DevTools console) is rendered as the page's error state — "Could not open the page — No Task matches the given query." with a Back action — instead of a crash or a blank screen. (Stopping `cvat_server` entirely ends in CVAT's global sign-in screen with outage notifications; that is the platform's handling, recorded in section G.) |

## B. Security (item 5)

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [x] | No login is refused | `curl -i $BASE/api/test/tasks/$TASK/class-counts` returns 401 | `docs/evidence/auth-401.txt` — `HTTP/1.1 401 Unauthorized`, body: `"Authentication credentials were not provided."` |
| [x] | User without access to the task is refused | Create a second normal user who is not in the task's organization and not assigned. Request with their credentials and record the status code (code reading says 403 — PermissionDenied via the PolicyEnforcer, because per-task queryset filtering exists only for the list action; 404 would mean the task does not exist) | `docs/evidence/auth-denied.txt` — `HTTP/1.1 403 Forbidden`, body: `"You do not have permission to perform this action."` — the actual code (403) matches the prediction. The user (`nobody`) was verified non-staff in the `auth_user` table (`is_staff=f`, `is_superuser=f` — note CVAT's user table is `auth_user`, set by `db_table` in `cvat/apps/iam/models.py:24`), so the denial is a real authorization decision, not a superuser bypass |
| [x] | The allowed user still works | Same request as the owner returns 200 | `docs/evidence/counts-response.json` — same request as the owner (admin), 200 |

## C. Speed (item 6)

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [x] | Target written before measuring | Git history shows `docs/OBJECTIVES.md` committed before the measurement | `cd2083a3f` (Objectives with the 250 ms target) precedes `eee210c50` (measurement results commit) |
| [x] | 5 runs measured, raw output saved | Method in `docs/OBJECTIVES.md` | `docs/evidence/mo1-raw.txt` — warm-up (discarded) + 5 runs, plus the post-miss investigation baselines |
| [x] | Median and spread reported with hardware and SHA | Results table in `docs/OBJECTIVES.md` | Median **284.4 ms**, min/max **264.0 / 299.3 ms**; hardware (Ryzen 5 5600, 15.9 GB) and SHA (`4a09e27ff`) in the Objectives environment table |
| [x] | Target met, or missed with the reason written | "Honest reading" section in Objectives | **Missed** — median 284.4 ms against 250 ms. Reason investigated and written: the aggregate costs 40.5 ms in Postgres (`EXPLAIN ANALYZE`); an existing endpoint behind the same OPA check (`GET /api/tasks/2`) measures the same 273–430 ms; an auth-only endpoint measures 6–14 ms — the gap is CVAT's per-request OPA authorization round trip, a platform-level cost outside this task's scope |

## D. Extra grouping (item 7)

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [x] | `group_by=shape_type` returns counts per label and shape type | `curl ... "$URL?group_by=shape_type"` | `docs/evidence/group-by-response.json` — 122 `{label, type, count}` rows |
| [x] | Grouped totals equal the plain totals | Sum per label in the grouped output equals the plain count | `docs/evidence/group-by-totals-check.txt` — per-label sums across all 122 grouped rows equal the plain counts for 80 of 80 labels |
| [x] | An invalid `group_by` value is rejected cleanly (400, not 500) | `curl ... "$URL?group_by=nonsense"` | `docs/evidence/group-by-400.txt` — DRF validation error body `{"group_by":["\"nonsense\" is not a valid choice."]}` |
| [x] | Reason for the choice is written | Plan section 2 | Plan section 2, "Item 7 (extra grouping)" row |

## E. Process and code presentation

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [x] | Plan, Objectives and Definition of Done exist under `docs/` | `ls docs/` | `DEFINITION_OF_DONE.md`, `OBJECTIVES.md`, `PLAN.md`, `evidence/` (12 evidence files) |
| [x] | Plan committed before any code | `git log --reverse --oneline` shows the plan commit before every code commit | `126fc247e` (plan) precedes `0ff593b74` (first code commit); first 5 lines: `126fc247e`, `cd2083a3f`, `193cb7b53`, `c9eb07b19`, `0ff593b74` |
| [x] | Many small commits, each saying what and why | `git log --oneline` | 11 commits on `dev-test01` including this one: 3 plan docs, 1 dataset state, 1 endpoint, 1 auth evidence, 1 UI page, 1 non-existent-task evidence, 1 group_by + MO-1 results, 1 docs update, 1 this finalization — each message says what changed and why |
| [x] | No dead code, commented-out blocks or stray files | `git diff main...dev-test01 --stat` reviewed line by line | 35 files changed vs the base commit `4a09e27f`: 5 new `cvat/apps/test` files, 4 backend registration/schema files, 5 `cvat-core`, 5 `cvat-ui`, 3 docs, 12 evidence files, `.gitignore`. Reviewed file by file; a byte-identical duplicate screenshot was removed during this pass |
| [x] | Backend change is contained in `cvat/apps/test`, plus the minimum registration lines | Same diff | Commit `0ff593b74` touches 4 files outside the app: `cvat/apps/engine/permissions.py` (+1 scope-mapping line), `cvat/settings/base.py` (+1 app registration), `cvat/urls.py` (+3 include lines), `cvat/schema.yml` (regenerated) |
| [x] | Decision record confirmed or corrected | Plan section 8 | Confirmed in this commit — PLAN section 8, "End-of-work confirmation": still accurate, with the cost picture refined by the MO-1 baselines (OPA round trip dominates, not the aggregate) |

## F. Recording and submission

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [ ] | Loom is 5 minutes or less | Length shown in Loom | `[FILL: m:ss]` |
| [ ] | K1 to K4 answered without notes, matching my repository | Rehearsed against the real code | `[FILL: Loom link]` |
| [ ] | PR is from `dev-test01` into main of my own fork | PR page shows my fork as base | `[FILL: PR link]` |
| [ ] | No PR opened against the real CVAT repository | Checked my account's PR list | `[FILL: yes]` |
| [ ] | PR link and Loom link sent in reply within 8 hours | Message sent | `[FILL: time sent]` |

## G. Not reached, and why

| Item | Status | Reason |
|------|--------|--------|
| 8. Live updates over WebSocket | Not started | CVAT has no WebSocket layer for annotations that I know of. It needs a push layer plus change signals on every annotation write path, which does not fit alongside items 1 to 7 in 8 hours. Decided in the Plan before coding. |
| 9. Reconnect handling | Not started | Depends on item 8. |
| Tracks and tags in the count | Not done | Scope decision in Plan section 2. Only shapes are counted. |
| Video tasks | Not tested | Sample data is images only. |
| Overlapping jobs | Not applicable | Overlap is a video-only setting; image tasks are split into segments without overlap, so double counting is impossible for this dataset (verified in the Segment model, recorded in Plan section 6). |
| Built UI on :8080 not rebuilt | Not done | The `cvat_ui` image still serves the bundle from before the feature; the page was verified on the webpack dev server (:3000), which proxies `/api` to the same stack. Rebuild with `docker compose -f docker-compose.yml -f docker-compose.dev.yml build cvat_ui` to ship it to :8080. |
| Automated tests for the new app | Not done | Not budgeted in the Plan; the endpoint is verified with curl evidence cross-checked against independent SQL (sections A–D). |
| Stopped-server error screenshot | Not captured | The saved `error-state.png` shows the page's error state for a failed (404) request; with `cvat_server` fully stopped the app lands on CVAT's global sign-in screen with outage notifications — the platform's handling, not the page's. |

## H. Notes for the recording (not graded)

- **K1, file and line that computes the count:** `cvat/apps/test/views.py:55` — the queryset filters `LabeledShape` by `job__segment__task_id`, then `.values("label__name").annotate(count=Count("id"))`. It runs in the view so the database does the counting in a single query — no Python loop over rows, no per-label queries, and no frontend math.
- **K2, where the label of a shape is stored:** `LabeledShape.label` — a foreign key to `engine_label` (`cvat/apps/engine/models.py:1618`); the name lives in `Label.name` (`models.py:1465`). Path I followed: `engine_task` → `engine_segment.task_id` → `engine_job.segment_id` → `engine_labeledshape.job_id` → `engine_labeledshape.label_id` → `Label.name`.
- **K3, one thing I would reverse and what it costs:** the on-demand aggregate (Plan section 8). Reversing it means a counter table maintained on every annotation write path (create/update/delete, COCO import, job merge, consensus replication). Reads become constant-time — but the MO-1 baselines show a read is dominated by the ~240 ms OPA authorization round trip, not by the 40.5 ms count, so the reversal buys little here while touching every write path in the engine app and risking counter drift.
- **K4, one thing I did not understand and what I did about it:** my first working endpoint returned 500 on every request. The container logs showed `AttributeError: 'ClassCountsViewSet' object has no attribute 'search_fields'` raised from CVAT's custom `SearchFilter` (`cvat/apps/engine/filters.py:42`), which calls `getattr(view, "search_fields")` without a default — and DRF runs the default filter backends inside `get_object()` even for a view with no list action. I had not understood that CVAT's filter layer imposes list-view attributes on every viewset. I fixed it by disabling the backends on this view (`filter_backends = ()` — a single-object read has nothing to filter) and re-verified every response code with curl after an image rebuild. Along with this i also did not understand how OPA was working and what DRF was, so i used claude to help me better understand about that and hopefully it helped.
