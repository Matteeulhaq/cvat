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
| [ ] | Page in the web UI calls the endpoint (item 2) | Browser network tab shows the request and a 200 | `[FILL: docs/evidence/page-network.png]` |
| [ ] | Counts shown as a graph (item 3) | Screenshot of the chart for the sample task | `[FILL: docs/evidence/chart.png]` |
| [ ] | Empty state is handled (item 4) | Open the page for a task with no annotations | `[FILL: docs/evidence/empty-state.png]` |
| [ ] | Failed request is handled (item 4) | Stop `cvat_server` (or block the request) and reload the page | `[FILL: docs/evidence/error-state.png]` |

## B. Security (item 5)

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [x] | No login is refused | `curl -i $BASE/api/test/tasks/$TASK/class-counts` returns 401 | `docs/evidence/auth-401.txt` — `HTTP/1.1 401 Unauthorized`, body: `"Authentication credentials were not provided."` |
| [x] | User without access to the task is refused | Create a second normal user who is not in the task's organization and not assigned. Request with their credentials and record the status code (code reading says 403 — PermissionDenied via the PolicyEnforcer, because per-task queryset filtering exists only for the list action; 404 would mean the task does not exist) | `docs/evidence/auth-denied.txt` — `HTTP/1.1 403 Forbidden`, body: `"You do not have permission to perform this action."` — the actual code (403) matches the prediction. The user (`nobody`) was verified non-staff in the `auth_user` table (`is_staff=f`, `is_superuser=f` — note CVAT's user table is `auth_user`, set by `db_table` in `cvat/apps/iam/models.py:24`), so the denial is a real authorization decision, not a superuser bypass |
| [x] | The allowed user still works | Same request as the owner returns 200 | `docs/evidence/counts-response.json` — same request as the owner (admin), 200 |

## C. Speed (item 6)

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [ ] | Target written before measuring | Git history shows `docs/OBJECTIVES.md` committed before the measurement | `cd2083a3f` (Objectives committed; measurement not yet run) |
| [ ] | 5 runs measured, raw output saved | Method in `docs/OBJECTIVES.md` | `[FILL: docs/evidence/mo1-raw.txt]` |
| [ ] | Median and spread reported with hardware and SHA | Results table in `docs/OBJECTIVES.md` | `[FILL: median ms, min, max]` |
| [ ] | Target met, or missed with the reason written | "Honest reading" section in Objectives | `[FILL: met / missed, reason]` |

## D. Extra grouping (item 7)

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [ ] | `group_by=shape_type` returns counts per label and shape type | `curl ... "$URL?group_by=shape_type"` | `[FILL: docs/evidence/group-by-response.json]` |
| [ ] | Grouped totals equal the plain totals | Sum per label in the grouped output equals the plain count | `[FILL: the labels checked]` |
| [ ] | An invalid `group_by` value is rejected cleanly (400, not 500) | `curl ... "$URL?group_by=nonsense"` | `[FILL: docs/evidence/group-by-400.txt]` |
| [ ] | Reason for the choice is written | Plan section 2 | Plan section 2 |

## E. Process and code presentation

| Done | Criterion | How I will prove it | Evidence |
|------|-----------|---------------------|----------|
| [ ] | Plan, Objectives and Definition of Done exist under `docs/` | `ls docs/` | `[FILL: output]` |
| [x] | Plan committed before any code | `git log --reverse --oneline` shows the plan commit before every code commit | `126fc247e` (plan) precedes `0ff593b74` (first code commit); first 5 lines: `126fc247e`, `cd2083a3f`, `193cb7b53`, `c9eb07b19`, `0ff593b74` |
| [ ] | Many small commits, each saying what and why | `git log --oneline` | `[FILL: commit count]` |
| [ ] | No dead code, commented-out blocks or stray files | `git diff main...dev-test01 --stat` reviewed line by line | `[FILL: files changed count]` |
| [x] | Backend change is contained in `cvat/apps/test`, plus the minimum registration lines | Same diff | Commit `0ff593b74` touches 4 files outside the app: `cvat/apps/engine/permissions.py` (+1 scope-mapping line), `cvat/settings/base.py` (+1 app registration), `cvat/urls.py` (+3 include lines), `cvat/schema.yml` (regenerated) |
| [ ] | Decision record confirmed or corrected | Plan section 8 | `[FILL: link to commit]` |

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
| `[FILL: anything else I did not finish]` | | |

## H. Notes for the recording (not graded)

- **K1, file and line that computes the count:** `cvat/apps/test/views.py:55` — the queryset filters `LabeledShape` by `job__segment__task_id`, then `.values("label__name").annotate(count=Count("id"))`. It runs in the view so the database does the counting in a single query — no Python loop over rows, no per-label queries, and no frontend math.
- **K2, where the label of a shape is stored:** `LabeledShape.label` — a foreign key to `engine_label` (`cvat/apps/engine/models.py:1618`); the name lives in `Label.name` (`models.py:1465`). Path I followed: `engine_task` → `engine_segment.task_id` → `engine_job.segment_id` → `engine_labeledshape.job_id` → `engine_labeledshape.label_id` → `Label.name`.
- **K3, one thing I would reverse and what it costs:** `[FILL]`
- **K4, one thing I did not understand and what I did about it:** `[FILL]`
