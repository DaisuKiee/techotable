---
name: ctu-timetabling
description: How this project's timetable generator works and how to change it safely - the CP-SAT model (backend/python/ortools_scheduler.py), the JS fallback solver (backend/services/builtinSolver.service.js), the bridge that feeds both, the hard rules, objective weights and priority presets, past bugs, and how to verify a change. Use before touching schedule generation, constraints, weights, NSTP/lab/home-room rules, the Generate Schedule modal's solver options, or when a generated timetable looks wrong.
---

# CTU timetabling engine

Generation is a constraint-optimisation problem solved by **two engines that must stay equivalent**:

| Engine | File | When it runs |
|---|---|---|
| OR-Tools CP-SAT | `backend/python/ortools_scheduler.py` | Python + `ortools` available (local dev) |
| Built-in JS solver | `backend/services/builtinSolver.service.js` | Fallback, and the only engine on the Pterodactyl host (Node only, no Python) |

`backend/services/ortoolsBridge.service.js` builds ONE input payload (`preparePythonInput`) and hands it to either engine; both return the same result shape, so saving, preview and statistics don't care which ran. Neither engine uses an LLM - "AI" in the UI means optimisation, not a language model.

## The model (both engines)

- **Classes** = one subject for one section, split into **meeting blocks**: a 3-unit lecture is 2h + 1h, lab hours become full-length sessions (9 lab hours = three 3h blocks), first-year NSTP is one block.
- **Timeline**: `position = dayIndex * slotsPerDay + slotIndex`. Break slots (`is_break`) can't be crossed by a block.
- **Hard rules** (never violated):
  - a section, a teacher and a room are each in one place at a time (CP-SAT: `AddNoOverlap` on intervals);
  - saved classes (`existing`) and declared unavailability of teachers and rooms are immovable busy intervals;
  - a subject meets at most once per day (skipped when it has more sessions than days);
  - teaching load stays within each teacher's remaining cap (`max_teaching_load - current_load`);
  - a section with a **home room** takes every class there, labs included; otherwise labs need a `LAB_ROOM_TYPES` room (capacity relaxes before type does);
  - subjects already in `already_scheduled` for a section are never generated again (this caused duplicate class spaces).
  - **borrowed teachers**: `Subject.guestFaculty` lists teachers from other departments approved for that subject. `loadInputs` adds them to the run and `preparePythonInput` sends `only_subjects: [subjectIds]`; `_candidate_faculty` (Python) and `candidateFaculty` (JS) only offer them for those subjects. Their home-department load still counts (loads are per term, all programs). Approve/withdraw: `POST/DELETE /api/subjects/:id/guest-faculty`; the faculty picker shows "From other departments" from `recommendFacultyForSubject().otherDepartments`. Subject experience matches by code OR normalised name (`utils/teachingExperience.js`), so the same course under another department's code counts.
- **Objective** (`DEFAULT_WEIGHTS`, mirrored in both files):

  | Weight | Default | Meaning |
  |---|---|---|
  | experience | 10 | x per point of 0-100 recency-weighted experience with the subject |
  | qualified | 300 | specialization matches required qualifications |
  | balance | 40 | penalty per unit of the busiest teacher's load |
  | compact | 1 | penalty per timeline position (keeps days tight, earlier) |
  | prefer_8am | 50 | penalty for a 7:00 AM start (7 AM still used when needed) |

  Plus a **soft** first-year-only NSTP preference for Saturday 08:00-11:00. It must stay soft: as a hard rule it made schedules infeasible.
- **Priority presets** (`schedule.controller.js`, "What should it optimise for?"): `balanced` = defaults; `experience` = {experience 20, balance 20}; `workload` = {experience 5, balance 120}; `compact` = {compact 6, prefer_8am 80}.
- **Search depth** (JS only): `quick` stops after 40 restarts without improvement (`STALE_RESTARTS`); `thorough` then runs ruin-and-recreate (tear out 2-15% related classes, rebuild, keep only if better) until the time limit. The JS engine reports `FEASIBLE`, never `OPTIMAL`.

## CP-SAT search aids (OR-Tools engine only; they don't change which timetables are valid)

- **Warm start**: `withWarmStart()` in the bridge runs the JS solver quickly (1-3 s) and passes its plan as `options.hint`; `add_hints()` in the Python model turns it into `AddHint`s. Bad or partial hints are harmless. `statistics.warm_start_classes` says how many classes were hinted.
- **Symmetry breaking**: a class's equal-length blocks of the same kind (lecture/lab) are ordered `start[b] < start[b+1]`. Hints are matched to blocks earliest-first so they agree with that order.
- `num_workers` (not the deprecated `num_search_workers`) sets parallelism.

## Trade-offs ("What this plan gives up" in the preview)

`summariseTradeoffs()` in the bridge describes what the chosen weighting gave up: classes outside the required specialization, teachers with no history in the subject, teachers within 2 units of their cap, meetings before 8 AM, and students' longest wait between classes (lunch excluded). Returned as `preview.tradeoffs {notes, facts}`.

## Builder assistant (`/schedules/builder`, right-hand panel)

- `POST /api/schedules/builder-suggest` runs `previewWithORTools` for one section with the builder's unsaved cards passed as `extraExisting` (fixed blocks; their subjects count as already scheduled and their units count toward teacher loads). Returns the preview's schedules, closeCalls and tradeoffs; the panel adds a suggestion as unsaved cards (one per meeting) after re-checking each slot with the grid's `resolveRange`.
- `POST /api/schedules/builder-assistant` answers questions with Gemini (`generateChatResponse` + a builder-specific system prompt listing the section, placed classes, subjects still needing hours and the program's teachers with load/unavailability). It only advises; nothing is placed without the user clicking Add.

- B-LO's memory (`models/AssistantMemory.model.js`, `services/assistantMemory.service.js`): one document per user+scope ('builder') holding the saved conversation per section (key = section id, last 60 messages; the last 12 go back to Gemini) and up to 40 notes. After each streamed answer the server sends `done`, saves the exchange, then runs a second Gemini call (temperature 0, JSON) that extracts lasting facts the USER stated (preferences, rules, decisions; "remember..." / "forget...") and sends a `memory` event. Notes are injected into every builder prompt across sections. Answers the user stopped mid-stream are not saved. Endpoints: `GET /schedules/builder-assistant/memory?key=`, `DELETE .../memory/conversation?key=`, `DELETE .../memory/notes[/:noteId]`.

## Close calls ("Your call" in the preview)

`findCloseCalls()` in the bridge runs on either engine's output: for each generated class it lists up to 3 other teachers whose fit score (experience x weight + qualified bonus) is within `CLOSE_MARGIN` (50 points) of the chosen one, or higher, AND who are free at all of that class's meetings (generated, saved and unavailable times) with enough spare load. The preview returns them as `preview.closeCalls`; `CloseCallsPanel` in `GenerateScheduleModal.jsx` lets the person swap the teacher before saving, disabling options that would clash with another pick or exceed `spareUnits`. Save time doesn't re-check conflicts, so keep that client-side guard in step with any new hard rule about teachers. Skipped when the preview has conflicts.

## Changing a rule or weight - checklist

1. Change it in **both** engines. Weights live in `DEFAULT_WEIGHTS` (Python) and the mirrored object at the top of `builtinSolver.service.js`. A rule in one engine only means Pterodactyl and local dev produce different timetables.
2. If it can make a request impossible, add the check to **both** `preflight()` implementations so both refuse with the same message.
3. CP-SAT is integer-only: scale fractional values (e.g. hours x 2 for half-hours) and keep variable domains narrow.
4. Never express a clash rule with a reified AND (`AddBoolAnd(...).OnlyEnforceIf(aux)`). It only says `aux => ...`, so the solver can leave every `aux` at 0 and the clash constraint is vacuous. That exact bug once produced "OPTIMAL" timetables with six classes in one room. Use intervals + `AddNoOverlap`.
5. Prefer soft (objective) over hard for preferences. Hard rules are for things that are physically impossible or forbidden.
6. If a new option comes from the UI: `GenerateScheduleModal.jsx` -> controller `generate`/`preview` (`req.body`) -> `runSolver(...)` in the bridge -> `options` in the payload -> both engines.

## Verifying a change

1. `node --check` the JS files; `python -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" backend/python/ortools_scheduler.py`.
2. Compare the engines on real data (read-only, nothing is saved):

   ```bash
   node .claude/skills/ctu-timetabling/scripts/compare-engines.js --program BSIT --seconds 20
   ```

   It plans one section per year level from scratch with OR-Tools (if Python is available), JS quick and JS thorough, and prints score, time, busiest teacher load and a clash check. Expect: no clashes anywhere, OR-Tools >= thorough >= quick, thorough within ~0.1% of OR-Tools. A big gap or any clash means the engines drifted.
3. A generated timetable that "looks wrong" is usually data, not the solver: check teachers' `max_teaching_load`, `unavailable` windows, missing lab rooms, a home room that's too small, or subjects already scheduled for the section.

## Gotchas

- First-year NSTP rules apply only when generating year level 1.
- Subject codes are scoped per program; don't match subjects by code alone across programs.
- Published schedules are what faculty and students see (`status: 'published', isActive: true`); generation creates drafts.
- Previews (`previewWithORTools`) don't save; saving a preview goes through `savePreview`, so options must be sent with the preview request.
