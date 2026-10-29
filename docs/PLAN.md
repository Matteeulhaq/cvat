# Plan: Annotation Analytics

Branch: `dev-test01`
Base commit SHA: `4a09e27ff869b7aebbfdb07b29c4a34904a0221d`
Started: `0945 29/10/2026` | Hard deadline: `1745 29/10/2026 `

## 1. Goal

Add a per-class annotation count to CVAT. A new Django app named `test` exposes
an authenticated endpoint that returns how many annotations each label has in a
task. A new page in the web UI calls it and draws the result as a bar chart,
with clean empty and error states. One extra grouping (by shape type) is added
on top of the plain count. Speed is measured with a target I set before measuring.

## 2. Scope decisions made now

| Question | Decision | Reason |
|----------|----------|--------|
| What counts as an annotation? | Shapes only (`LabeledShape`). Tracks and tags are excluded. | The brief describes the product as labelled boxes drawn on images. COCO import creates shapes. Counting a track once versus counting its per-frame shapes is a separate question I do not want to answer in 8 hours. |
| Where does the endpoint live? | New Django app `cvat/apps/test`, route `GET /api/test/tasks/<task_id>/class-counts`. | The brief requires a new app named `test`. It keeps the change contained. |
| How are counts computed? | One ORM aggregate query in the view: shapes in the task's jobs, grouped by label name. The database does the counting. | One query, no Python loop over rows. |
| Authentication | CVAT's existing DRF authentication, plus CVAT's existing task permission check for the VIEW scope. No new auth code. | Reuse is safer and easier to explain than a custom check. |
| Item 7 (extra grouping) | Optional query parameter `group_by=shape_type`, returning counts per (label, shape type). | It reuses the same query with one extra column, and it is useful: it shows how a class was annotated (rectangle, polygon, mask). |
| Chart | `chart.js` + `react-chartjs-2` are already declared in `cvat-ui/package.json` but are imported nowhere in `src`. Per this row's original rule I reuse `react-chartjs-2` — no new dependency — and keep the usage minimal. | The library exists, so reuse wins; but the codebase itself draws charts with custom SVG components, so there is no in-repo pattern to copy (see section 3.3). |
| Dataset | COCO 2017 val, all 5,000 images (actual number recorded in Objectives). | Large enough to be meaningful, small enough to run comfortably. Capacity checked: CVAT stores images on disk and serves them in chunks, so RAM does not grow with image count, and the database holds one row per annotation, not per image. With ~64 GB free, the machine could hold several hundred thousand COCO-sized images, so all 5,000 of val2017 (~800 MB, ~37k shape rows) are far inside the limits; import time (a few minutes) is the only cost. Using the full set also gives the MO-1 speed measurement a larger sample. |

## 3. What I did not know yet (answered by reading the code, before coding started)

1. Exact model path from a task to a label. **ANSWERED — the assumption was correct:** Task <- `Segment.task` (`cvat/apps/engine/models.py:1217`) <- `Job.segment` (`models.py:1332`) <- `LabeledShape` (inherits `Annotation`, which carries the `job` FK at `models.py:1617` and the `label` FK at `models.py:1618`; `LabeledShape` itself at `models.py:1674`) -> `Label.name` (`models.py:1465`). One aggregate covers it: `LabeledShape.objects.filter(job__segment__task_id=tid).values("label__name").annotate(count=Count("id"))`. Caveats recorded for K2: (a) every skeleton element is its own `LabeledShape` row via the `parent` FK (`models.py:1675`), and each consensus replica job would store its own shape rows — I count all rows and note the limitation; the COCO import creates neither. (b) Labels live on the Project when the task has one (`Task.get_labels`, `models.py:1020`) — irrelevant for the query, because the join goes through the shape's `label` FK, which is correct either way.
2. The exact call to reuse for the task VIEW permission check in `cvat/apps/engine/permissions.py`. **ANSWERED:** `TaskPermission` (`permissions.py:574`), scope `VIEW` (`permissions.py:601`). Plan: set `iam_permission_class = TaskPermission` on the view and add the custom action to the action-to-scope map `_get_scopes` (`permissions.py:719`), e.g. `("class_counts", "GET"): Scopes.VIEW`. That mapping line is mandatory: an unmapped action hits a hard assertion in the base class (`cvat/apps/iam/permissions.py:132-135`) and the endpoint fails. `PolicyEnforcer` (`cvat/apps/iam/permissions.py:315`) drives the rest. Manual alternative if needed: `TaskPermission.create_scope_view(request, task_id, iam_context)` (`permissions.py:699`), then `perm.check_access()` and check `.allow` — exactly what `PolicyEnforcer._check_permissions` does.
3. Whether `cvat-ui` already has a chart library, and where routes are registered. **ANSWERED:** `chart.js` and `react-chartjs-2` are declared in `cvat-ui/package.json` (lines 40-41) but imported nowhere in `cvat-ui/src`; the existing analytics page draws with custom components, not a chart library. Routes are registered in `cvat-ui/src/components/cvat-app.tsx` (react-router v5 `<Route exact path=...>` entries from around line 558).
4. What the permission layer returns for a user with no access (403 or 404). **ANSWERED from the code, still to be confirmed with curl in step 4:** 403 for an existing task without access — `TaskViewSet.get_queryset` filters by permission only for the `list` action (`cvat/apps/engine/views.py:1183-1187`); for `retrieve` the object is fetched, OPA denies, and DRF raises `PermissionDenied`. 404 only if the task does not exist. I will record what actually happens.

## 4. Order of work and time budget (8 hours of work)

| Step | Work | Budget | Why in this order |
|------|------|--------|-------------------|
| 0 | Fork, clone, branch, record SHA, start Docker, start COCO downloads | 0:20 | These run in the background while I write documents. |
| 1 | Commit Plan, Definition of Done, Objectives (three commits, no code yet) | 0:40 | The brief requires documents first. |
| 2 | Import all 5,000 val2017 images with their COCO annotations. Read the code: models, permissions, one existing viewset. Take notes for K2. | 0:45 | I cannot write the query before I have seen the models. |
| 3 | Item 1: new app, endpoint, URL registration, query | 1:30 | Everything else depends on it. |
| 4 | Item 5: login and task permission. Capture 401 and 403 with curl. | 0:30 | Security belongs next to the endpoint, not after the UI. |
| 5 | Items 2-4: page, bar chart, empty state, error state | 1:30 | This completes the floor (items 1 to 4). |
| 6 | Item 6: measure with the Objectives method. Item 7: `group_by=shape_type`. | 0:45 | Both reuse the finished endpoint. |
| 7 | Finish documents: tick Definition of Done with evidence, list unfinished work, close decision record | 0:40 | Evidence exists by now. |
| 8 | Rehearse K1 to K4 once, then record the Loom (5 minutes or less) | 0:40 | The recording gates everything. |
| 9 | Open PR into my own fork's main, send PR and Loom links | 0:20 | Buffer for problems. |

Milestone checks: items 1-4 working by 5:00 elapsed. If not, I drop item 7
and spend the time on evidence and documents.

## 5. What I have decided to skip

- **Item 8 (live updates over WebSocket).** To my knowledge, CVAT's server has no WebSocket layer for annotations, so it needs a push layer (for example Django Channels) plus change signals on every annotation write path. That is too large and risky for the time left. I will only reconsider it if items 1-7 are complete and verified with more than 90 minutes left, which I do not expect.
- **Item 9 (reconnect handling).** It depends on item 8.
- Tracks and tags in the count (see section 2).
- Video tasks.
- Caching of counts.

Skipped items will be listed in the Definition of Done with this reason.

## 6. Risks

| Risk | Mitigation |
|------|-----------|
| Permission system is unfamiliar | Done before coding: `TaskPermission`, the action-to-scope map and `PolicyEnforcer` are read and documented in section 3.2. |
| Python's standard library already has a module named `test` | The app lives at `cvat.apps.test`, so the full dotted path is unique. If the Django app label collides, I set an explicit label and note it. |
| Frontend build or hot reload is slow | Develop against the running Docker stack and limit UI changes to one page and one component. |
| Overlapping jobs could double-count shapes | Withdrawn before coding: overlap is a video-only setting; image tasks are split into segments without overlap, so this dataset cannot double-count. Revisit only if the dataset changes. |
| AI quota runs out | Keep a private notes file (excluded from git) with state and next step so I can switch tools. |

## 7. Plan changes log

Add a row whenever reality differs from this plan. Do not edit the sections above.

| Elapsed | Change | Reason |
|---------|--------|--------|
| `[FILL: elapsed]` | Section 3 answered from the code; chart decision set to reuse `react-chartjs-2`; overlap risk withdrawn (video-only); expected denial code recorded as 403, to confirm with curl in step 4 | All four items verified in `cvat/apps/engine` (`models.py`, `permissions.py`, `views.py`), `cvat/apps/iam/permissions.py` and `cvat-ui/src` before coding started |
| `[FILL: elapsed]` | Dataset changed from the first 1,000 images to all 5,000 of val2017 | Capacity check showed no hardware cost at this size; the full set gives the MO-1 speed measurement a larger, more meaningful sample |

## 8. Decision record

*Written now as intent. I will confirm or correct it at the end.*

- **Approach taken:** compute counts in the database with a single ORM aggregate inside a new DRF view, on demand per request.
- **Approach rejected:** fetch all annotations through CVAT's existing annotations endpoint and count them in the browser (or maintain a counter table updated on every annotation write).
- **What rejecting it cost:** every request now runs an aggregate over all of the task's shapes, so cost grows with annotation count and nothing is cached. It also leaves no cheap way to push live updates, which is why items 8 and 9 are out of scope. A counter table would have made reads constant-time but needed changes to every write path in the existing engine app, which is far less contained.

*End-of-work confirmation: `[FILL: still accurate / changed because ...]`*
