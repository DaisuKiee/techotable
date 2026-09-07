"""
Google OR-Tools timetable optimizer (CP-SAT).

Modelling notes
---------------
Each class (one subject for one section) is broken into MEETING BLOCKS - a
3-hour lab is one 3-hour block, a 3-unit lecture becomes 2h + 1h - and every
block is an interval on a single timeline where

    position = day_index * slots_per_day + slot_index

Resource clashes are then expressed with AddNoOverlap over those intervals:
a section, a teacher and a room can each only be in one place at a time. This
replaces the previous formulation, which reified "class occupies this cell AND
this room is assigned" with

    model.AddBoolAnd([occupies, assigned]).OnlyEnforceIf(aux)

That only says aux => (occupies AND assigned). It never forces aux to 1, so the
solver could leave every aux at 0 and the `sum(...) <= 1` clash constraints were
vacuous - it happily returned OPTIMAL for timetables that put six classes in one
room with the same teacher at the same hour. NoOverlap cannot be satisfied
vacuously, and it is what CP-SAT is actually good at.

Input JSON
----------
{
  "subjects":  [{_id, subject_code, subject_name, units, lecture_hours,
                 lab_hours, required_qualifications[], needs_lab}],
  "faculty":   [{_id, name, specializations[], max_teaching_load, current_load,
                 qualifications[], unavailable[{day,start,end}],
                 experience{subject_id: 0-100}}],
  "rooms":     [{_id, room_code, room_type, capacity}],
  "sections":  2  |  [{code, letter, max_students}],
  "days":      ["Monday", ...],
  "time_slots":[{start, end, is_break?}],
  "existing":  [{faculty_id, room_id, section_code, day, start_time, end_time}],
  "options":   {max_block_hours, weights{...}},
  "time_limit": 60
}
"""

import json
import sys
from collections import defaultdict

from ortools.sat.python import cp_model

# Room types that can host a laboratory session
LAB_ROOM_TYPES = {'Laboratory', 'Computer Lab', 'Workshop'}

# Objective weights. Experience dominates, then qualification; load balance and
# compactness are tie-breakers so they can never outvote a good teacher match.
DEFAULT_WEIGHTS = {
    'experience': 10,   # per point of 0-100 recency-weighted subject experience
    'qualified': 300,   # specialization matches the subject's requirements
    'balance': 40,      # penalty per unit of the busiest teacher's load
    'compact': 1,       # penalty per timeline position, nudges classes earlier
    'prefer_8am': 50,   # penalty for starting at 7:00 AM unless schedule is loaded
}


def _hhmm_to_minutes(value):
    hours, _, minutes = str(value).partition(':')
    return int(hours) * 60 + int(minutes or 0)


class TimetableOptimizer:
    def __init__(self, data):
        self.model = cp_model.CpModel()
        self.data = data

        self.subjects = data['subjects']
        self.faculty = data['faculty']
        self.rooms = data['rooms']
        self.days = data.get('days') or [
            'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
        ]
        self.slots = data.get('time_slots') or self._default_slots()
        self.sections = self._normalise_sections(data.get('sections', 1))
        self.existing = data.get('existing') or []
        # {section_code: [subject_id]} - offerings that already exist and must
        # not be generated a second time.
        self.already_scheduled = {
            str(k): {str(v) for v in (vals or [])}
            for k, vals in (data.get('already_scheduled') or {}).items()
        }
        self.skipped = []

        options = data.get('options') or {}
        self.max_block = max(1, int(options.get('max_block_hours', 3)))
        self.max_room_candidates = max(1, int(options.get('max_room_candidates', 6)))
        self.weights = {**DEFAULT_WEIGHTS, **(options.get('weights') or {})}

        self.slots_per_day = len(self.slots)
        self.horizon = len(self.days) * self.slots_per_day

        # Break slots are marked in the input; the old code string-matched
        # '12:00', so any other lunch window was silently schedulable.
        self.break_slots = {
            i for i, s in enumerate(self.slots)
            if s.get('is_break') or s.get('isLunch')
        }

        self.classes = []        # [{subject, section, blocks:[hours], needs_lab}]
        self.blocks = {}         # (c, b) -> {start, end, interval, day, length}
        self.fac_vars = {}       # (c, f) -> BoolVar
        self.room_vars = {}      # (c, r) -> BoolVar
        self.diagnostics = []

    # ---------------------------------------------------------------- setup

    @staticmethod
    def _default_slots():
        return [
            {'start': '07:00', 'end': '08:00'},
            {'start': '08:00', 'end': '09:00'},
            {'start': '09:00', 'end': '10:00'},
            {'start': '10:00', 'end': '11:00'},
            {'start': '11:00', 'end': '12:00'},
            {'start': '12:00', 'end': '13:00', 'is_break': True},
            {'start': '13:00', 'end': '14:00'},
            {'start': '14:00', 'end': '15:00'},
            {'start': '15:00', 'end': '16:00'},
            {'start': '16:00', 'end': '17:00'},
        ]

    @staticmethod
    def _normalise_sections(value):
        """Accept a count (legacy) or real section descriptors."""
        if isinstance(value, int):
            return [{'letter': chr(65 + i), 'code': None, 'max_students': 40}
                    for i in range(max(1, value))]
        sections = []
        for i, s in enumerate(value or []):
            sections.append({
                'letter': s.get('letter') or chr(65 + i),
                'code': s.get('code'),
                'max_students': s.get('max_students') or 40,
            })
        return sections or [{'letter': 'A', 'code': None, 'max_students': 40}]

    def _split_hours(self, hours, prefer_max=False):
        """
        Break required hours into meeting blocks of at most `max_block` hours.

        Lab hours pass prefer_max=True because a laboratory is run as full-length
        sessions - 9 lab hours is three 3-hour sessions, not one 9-hour block
        (which no day can hold) and not 2+2+2+2+1.

        Lecture hours avoid leaving a lone 1-hour straggler, so 4 hours becomes
        2h + 2h rather than 3h + 1h.
        """
        hours = int(hours or 0)
        if hours <= 0:
            return []

        blocks = []
        remaining = hours
        while remaining > 0:
            take = min(self.max_block, remaining)
            if not prefer_max and remaining - take == 1 and take > 1:
                take -= 1
            blocks.append(take)
            remaining -= take
        return blocks

    def build_classes(self):
        for subject in self.subjects:
            lecture = int(subject.get('lecture_hours') or 0)
            lab = int(subject.get('lab_hours') or 0)
            if lecture + lab <= 0:
                # Fall back to units so a subject is never silently dropped
                lecture = int(subject.get('units') or 3)

            code_str = str(subject.get('subject_code') or '').upper()
            name_str = str(subject.get('subject_name') or '').upper()
            is_nstp = 'NSTP' in code_str or 'NSTP' in name_str

            if is_nstp:
                total_hours = (lecture + lab) or int(subject.get('units') or 3)
                blocks = [total_hours]
                lab_from = None
            else:
                lecture_blocks = self._split_hours(lecture)
                lab_blocks = self._split_hours(lab, prefer_max=True)
                blocks = lecture_blocks + lab_blocks
                lab_from = len(lecture_blocks) if lab_blocks else None

            for section in self.sections:
                key = str(section['code'] or section['letter'])
                # Regenerating a section that is already scheduled would create
                # a second offering of the same subject, which is what produced
                # duplicate class spaces. Only fill in what is missing.
                if str(subject.get('_id')) in self.already_scheduled.get(key, set()):
                    self.skipped.append({
                        'subject_code': subject.get('subject_code'),
                        'section': key,
                        'reason': 'already scheduled',
                    })
                    continue

                self.classes.append({
                    'subject': subject,
                    'section': section,
                    'blocks': blocks,
                    'lab_from': lab_from,
                    'needs_lab': (lab > 0 or bool(subject.get('needs_lab'))) and not is_nstp,
                    'is_nstp': is_nstp,
                })

    # ------------------------------------------------------- candidate sets

    def _allowed_starts(self, length):
        """Positions where a block of `length` hours fits inside one day."""
        allowed = []
        for day_idx in range(len(self.days)):
            for slot_idx in range(self.slots_per_day - length + 1):
                window = range(slot_idx, slot_idx + length)
                if any(i in self.break_slots for i in window):
                    continue
                allowed.append(day_idx * self.slots_per_day + slot_idx)
        return allowed

    def _candidate_faculty(self, subject):
        """
        Teachers who may take this subject.

        Anyone whose load can absorb it; specialization only influences the
        objective, so a subject is never left unscheduled purely because nobody
        lists the exact specialization.
        """
        units = int(subject.get('units') or 3)
        candidates = [
            f_idx for f_idx, f in enumerate(self.faculty)
            if int(f.get('current_load') or 0) + units <= int(f.get('max_teaching_load') or 24)
        ]
        return candidates or list(range(len(self.faculty)))

    def _candidate_rooms(self, klass):
        """
        Rooms of the right type and capacity, tightest fit first.

        The list is capped: rooms of the same type and capacity are
        interchangeable, so offering the solver all 30 rooms only multiplies
        symmetric branches it has to rule out. Keeping the best few cuts the
        model size substantially with no practical loss of quality.
        """
        needed = klass['section']['max_students']
        wants_lab = klass['needs_lab']
        code = klass['subject']['subject_code']

        def shortlist(rooms):
            # Smallest room that still fits, so big halls stay free for big sections
            rooms.sort(key=lambda r: (self.rooms[r].get('capacity') or 0, r))
            return rooms[:self.max_room_candidates]

        eligible = [
            r_idx for r_idx, room in enumerate(self.rooms)
            if (room.get('capacity') or 0) >= needed
            and (not wants_lab or room.get('room_type') in LAB_ROOM_TYPES)
        ]
        if eligible:
            return shortlist(eligible)

        # Relax capacity before relaxing type: a slightly crowded lab beats
        # running a laboratory session in a lecture room.
        by_type = [r_idx for r_idx, room in enumerate(self.rooms)
                   if not wants_lab or room.get('room_type') in LAB_ROOM_TYPES]
        if by_type:
            largest = max((self.rooms[r].get('capacity') or 0) for r in by_type)
            self.diagnostics.append(
                f'{code}: no {"laboratory" if wants_lab else ""} room seats {needed} '
                f'students (largest is {largest}), so capacity was relaxed.'.replace('  ', ' ')
            )
            by_type.sort(key=lambda r: -(self.rooms[r].get('capacity') or 0))
            return by_type[:self.max_room_candidates]

        self.diagnostics.append(
            f'{code}: no laboratory room exists, so a lecture room was used.'
        )
        return shortlist(list(range(len(self.rooms))))

    # ------------------------------------------------------------ variables

    def create_variables(self):
        for c_idx, klass in enumerate(self.classes):
            for b_idx, length in enumerate(klass['blocks']):
                allowed = self._allowed_starts(length)
                if not allowed:
                    raise ValueError(
                        f"{klass['subject']['subject_code']} needs a "
                        f"{length}-hour block, but no day has {length} "
                        f"consecutive free hours in this shift."
                    )

                start = self.model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(allowed), f'start_c{c_idx}_b{b_idx}')
                end = self.model.NewIntVar(0, self.horizon, f'end_c{c_idx}_b{b_idx}')
                self.model.Add(end == start + length)

                interval = self.model.NewIntervalVar(
                    start, length, end, f'iv_c{c_idx}_b{b_idx}')

                day = self.model.NewIntVar(0, len(self.days) - 1, f'day_c{c_idx}_b{b_idx}')
                self.model.AddDivisionEquality(day, start, self.slots_per_day)

                self.blocks[(c_idx, b_idx)] = {
                    'start': start, 'end': end, 'interval': interval,
                    'day': day, 'length': length,
                }

            klass['faculty_candidates'] = self._candidate_faculty(klass['subject'])
            klass['room_candidates'] = self._candidate_rooms(klass)

            for f_idx in klass['faculty_candidates']:
                self.fac_vars[(c_idx, f_idx)] = self.model.NewBoolVar(f'fac_c{c_idx}_f{f_idx}')
            for r_idx in klass['room_candidates']:
                self.room_vars[(c_idx, r_idx)] = self.model.NewBoolVar(f'room_c{c_idx}_r{r_idx}')

    # ---------------------------------------------------------- constraints

    def _fixed_intervals_from_existing(self):
        """
        Already-saved classes, as immovable intervals.

        These were ignored entirely before, so a generated timetable could drop
        a class on top of one that was already published.
        """
        by_faculty = defaultdict(list)
        by_room = defaultdict(list)
        by_section = defaultdict(list)

        day_index = {d: i for i, d in enumerate(self.days)}
        slot_index = {s['start']: i for i, s in enumerate(self.slots)}

        for n, row in enumerate(self.existing):
            d = day_index.get(row.get('day'))
            if d is None:
                continue
            start_slot = slot_index.get(row.get('start_time'))
            if start_slot is None:
                continue

            start_min = _hhmm_to_minutes(row['start_time'])
            end_min = _hhmm_to_minutes(row.get('end_time') or row['start_time'])
            length = max(1, round((end_min - start_min) / 60))
            length = min(length, self.slots_per_day - start_slot)

            pos = d * self.slots_per_day + start_slot
            iv = self.model.NewFixedSizeIntervalVar(pos, length, f'busy{n}')

            if row.get('faculty_id'):
                by_faculty[str(row['faculty_id'])].append(iv)
            if row.get('room_id'):
                by_room[str(row['room_id'])].append(iv)
            if row.get('section_code'):
                by_section[str(row['section_code'])].append(iv)

        return by_faculty, by_room, by_section

    def add_constraints(self):
        busy_fac, busy_room, busy_section = self._fixed_intervals_from_existing()

        # Force NSTP subjects to always be scheduled on Saturday from 08:00 to 11:00
        if 'Saturday' in self.days:
            sat_idx = self.days.index('Saturday')
            slot_0800_idx = next((i for i, s in enumerate(self.slots) if s.get('start') == '08:00'), None)
            if slot_0800_idx is not None:
                nstp_target_start = sat_idx * self.slots_per_day + slot_0800_idx
                for c_idx, klass in enumerate(self.classes):
                    if klass.get('is_nstp'):
                        for b_idx in range(len(klass['blocks'])):
                            self.model.Add(self.blocks[(c_idx, b_idx)]['start'] == nstp_target_start)

        # Exactly one teacher and one room per class
        for c_idx, klass in enumerate(self.classes):
            self.model.AddExactlyOne(
                [self.fac_vars[(c_idx, f)] for f in klass['faculty_candidates']])
            self.model.AddExactlyOne(
                [self.room_vars[(c_idx, r)] for r in klass['room_candidates']])

            # A subject should not meet twice in one day. Skipped when a subject
            # has more sessions than there are days, otherwise the model would
            # be trivially infeasible for something like a 9-hour lab on a
            # 2-day grid.
            day_vars = [self.blocks[(c_idx, b)]['day'] for b in range(len(klass['blocks']))]
            if 1 < len(day_vars) <= len(self.days):
                self.model.AddAllDifferent(day_vars)
            elif len(day_vars) > len(self.days):
                self.diagnostics.append(
                    f"{klass['subject']['subject_code']}: {len(day_vars)} sessions "
                    f"across {len(self.days)} days, so some days carry two sessions."
                )

        # A section cannot be in two places at once. This constraint did not
        # exist before, which is why generated timetables double-booked students.
        by_section = defaultdict(list)
        for c_idx, klass in enumerate(self.classes):
            key = klass['section']['code'] or klass['section']['letter']
            for b_idx in range(len(klass['blocks'])):
                by_section[key].append(self.blocks[(c_idx, b_idx)]['interval'])
        for key, intervals in by_section.items():
            self.model.AddNoOverlap(intervals + busy_section.get(str(key), []))

        # A teacher cannot be in two places at once
        for f_idx, f in enumerate(self.faculty):
            intervals = list(busy_fac.get(str(f.get('_id')), []))

            for c_idx, klass in enumerate(self.classes):
                if f_idx not in klass['faculty_candidates']:
                    continue
                presence = self.fac_vars[(c_idx, f_idx)]
                for b_idx in range(len(klass['blocks'])):
                    blk = self.blocks[(c_idx, b_idx)]
                    intervals.append(self.model.NewOptionalIntervalVar(
                        blk['start'], blk['length'], blk['end'], presence,
                        f'fiv_c{c_idx}_b{b_idx}_f{f_idx}'))

            # Declared unavailability becomes an immovable busy interval
            for n, window in enumerate(f.get('unavailable') or []):
                iv = self._window_interval(window, f'unavail_f{f_idx}_{n}')
                if iv is not None:
                    intervals.append(iv)

            if len(intervals) > 1:
                self.model.AddNoOverlap(intervals)

        # A room cannot host two classes at once
        for r_idx, room in enumerate(self.rooms):
            intervals = list(busy_room.get(str(room.get('_id')), []))

            for c_idx, klass in enumerate(self.classes):
                if r_idx not in klass['room_candidates']:
                    continue
                presence = self.room_vars[(c_idx, r_idx)]
                for b_idx in range(len(klass['blocks'])):
                    blk = self.blocks[(c_idx, b_idx)]
                    intervals.append(self.model.NewOptionalIntervalVar(
                        blk['start'], blk['length'], blk['end'], presence,
                        f'riv_c{c_idx}_b{b_idx}_r{r_idx}'))

            if len(intervals) > 1:
                self.model.AddNoOverlap(intervals)

        # Teaching load, counting what the teacher already carries
        for f_idx, f in enumerate(self.faculty):
            terms = []
            for c_idx, klass in enumerate(self.classes):
                if f_idx not in klass['faculty_candidates']:
                    continue
                units = int(klass['subject'].get('units') or 3)
                terms.append(self.fac_vars[(c_idx, f_idx)] * units)
            if terms:
                cap = int(f.get('max_teaching_load') or 24) - int(f.get('current_load') or 0)
                self.model.Add(sum(terms) <= max(0, cap))

    def _window_interval(self, window, name):
        """Turn a {day, start, end} window into a fixed interval, if it lands in the grid."""
        try:
            day_idx = self.days.index(window.get('day'))
        except ValueError:
            return None

        start_min = _hhmm_to_minutes(window.get('start') or window.get('startTime') or '')
        end_min = _hhmm_to_minutes(window.get('end') or window.get('endTime') or '')
        if end_min <= start_min:
            return None

        first, last = None, None
        for i, slot in enumerate(self.slots):
            s, e = _hhmm_to_minutes(slot['start']), _hhmm_to_minutes(slot['end'])
            if e > start_min and s < end_min:
                first = i if first is None else first
                last = i
        if first is None:
            return None

        pos = day_idx * self.slots_per_day + first
        return self.model.NewFixedSizeIntervalVar(pos, last - first + 1, name)

    # ------------------------------------------------------------ objective

    def set_objective(self):
        terms = []

        for c_idx, klass in enumerate(self.classes):
            subject = klass['subject']
            subject_id = str(subject.get('_id'))
            required = {str(q).lower() for q in (subject.get('required_qualifications') or [])}

            for f_idx in klass['faculty_candidates']:
                var = self.fac_vars[(c_idx, f_idx)]
                f = self.faculty[f_idx]

                # Recency-weighted experience with THIS subject, 0-100, computed
                # in Node from teachingHistory. This is the "most experienced
                # teacher is most recommended" rule the recommender already uses.
                experience = int((f.get('experience') or {}).get(subject_id, 0) or 0)
                if experience:
                    terms.append(var * (experience * self.weights['experience']))

                specs = {str(s).lower() for s in (f.get('specializations') or [])}
                if required and any(
                    r in s or s in r for r in required for s in specs
                ):
                    terms.append(var * self.weights['qualified'])

        # Real load balancing. The previous "objective 1" was an empty loop, so
        # nothing stopped one teacher absorbing every subject.
        if self.faculty:
            loads = []
            for f_idx, f in enumerate(self.faculty):
                per_faculty = []
                for c_idx, klass in enumerate(self.classes):
                    if f_idx not in klass['faculty_candidates']:
                        continue
                    units = int(klass['subject'].get('units') or 3)
                    per_faculty.append(self.fac_vars[(c_idx, f_idx)] * units)
                load = self.model.NewIntVar(0, 1000, f'load_f{f_idx}')
                self.model.Add(load == sum(per_faculty) if per_faculty else load == 0)
                loads.append(load)

            busiest = self.model.NewIntVar(0, 1000, 'busiest_load')
            self.model.AddMaxEquality(busiest, loads)
            terms.append(busiest * -self.weights['balance'])

        # Nudge classes towards earlier slots so a section's day stays compact
        # instead of leaving long idle gaps.
        slot_0700_idx = next((i for i, s in enumerate(self.slots) if s.get('start') == '07:00'), None)

        for (c_idx, b_idx), blk in self.blocks.items():
            terms.append(blk['start'] * -self.weights['compact'])

            # 7 AM is optional: apply penalty to starting at 07:00 AM so 08:00 AM is preferred,
            # but 07:00 AM is automatically used if the schedule is loaded or tight.
            if slot_0700_idx is not None and self.weights.get('prefer_8am', 0) > 0:
                slot_in_day = self.model.NewIntVar(0, self.slots_per_day - 1, f'slot_in_day_c{c_idx}_b{b_idx}')
                self.model.AddModuloEquality(slot_in_day, blk['start'], self.slots_per_day)
                is_7am = self.model.NewBoolVar(f'is_7am_c{c_idx}_b{b_idx}')
                self.model.Add(slot_in_day == slot_0700_idx).OnlyEnforceIf(is_7am)
                self.model.Add(slot_in_day != slot_0700_idx).OnlyEnforceIf(is_7am.Not())
                terms.append(is_7am * -self.weights['prefer_8am'])

        if terms:
            self.model.Maximize(sum(terms))

    # ---------------------------------------------------------------- solve

    def preflight(self):
        """
        Catch the impossible cases before the solver reports a bare INFEASIBLE,
        which told the user nothing about what to change.
        """
        problems = []
        teaching_slots = sum(1 for i in range(self.slots_per_day) if i not in self.break_slots)
        capacity_hours = teaching_slots * len(self.days)

        required_by_section = defaultdict(int)
        for klass in self.classes:
            key = str(klass['section']['code'] or klass['section']['letter'])
            required_by_section[key] += sum(klass['blocks'])

        # Hours the section has already committed. Ignoring these produced a
        # bare INFEASIBLE when a section was simply already full.
        booked_by_section = defaultdict(int)
        for row in self.existing:
            key = str(row.get('section_code') or '')
            if not key:
                continue
            start = _hhmm_to_minutes(row.get('start_time') or '0:00')
            end = _hhmm_to_minutes(row.get('end_time') or '0:00')
            booked_by_section[key] += max(0, round((end - start) / 60))

        for key, hours in required_by_section.items():
            booked = booked_by_section.get(key, 0)
            if hours + booked > capacity_hours:
                detail = (f' It already has {booked} hours scheduled.' if booked else '')
                problems.append(
                    f'Section {key} needs {hours} more hours but the {len(self.days)}-day '
                    f'grid only has {capacity_hours} teaching hours.{detail} '
                    f'Remove some existing classes or widen the shift.'
                )

        total_units = sum(
            int(k['subject'].get('units') or 3) for k in self.classes
        )
        available = sum(
            max(0, int(f.get('max_teaching_load') or 24) - int(f.get('current_load') or 0))
            for f in self.faculty
        )
        if total_units > available:
            problems.append(
                f'The schedule needs {total_units} teaching units but the available '
                f'faculty can only take {available}. Add faculty or raise load limits.'
            )

        room_hours_needed = sum(sum(k['blocks']) for k in self.classes)
        room_hours_available = len(self.rooms) * capacity_hours
        if room_hours_needed > room_hours_available:
            problems.append(
                f'{room_hours_needed} room-hours are needed but only '
                f'{room_hours_available} are available across {len(self.rooms)} rooms.'
            )

        return problems

    def solve(self, time_limit_seconds=60, workers=8):
        solver = cp_model.CpSolver()
        self._time_limit = max(1, float(time_limit_seconds))
        solver.parameters.max_time_in_seconds = self._time_limit
        # The solver ran single-threaded before, leaving most of the time budget
        # on the table for anything non-trivial.
        solver.parameters.num_search_workers = max(1, int(workers))
        solver.parameters.log_search_progress = False
        return solver.Solve(self.model), solver

    # ------------------------------------------------------------- solution

    def extract_solution(self, solver):
        schedules = []

        for c_idx, klass in enumerate(self.classes):
            assigned_faculty = next(
                (self.faculty[f] for f in klass['faculty_candidates']
                 if solver.Value(self.fac_vars[(c_idx, f)])), None)
            assigned_room = next(
                (self.rooms[r] for r in klass['room_candidates']
                 if solver.Value(self.room_vars[(c_idx, r)])), None)

            time_slots = []
            for b_idx, length in enumerate(klass['blocks']):
                pos = solver.Value(self.blocks[(c_idx, b_idx)]['start'])
                day_idx, slot_idx = divmod(pos, self.slots_per_day)
                # One entry per contiguous block, so a 3-hour class is one
                # 13:00-16:00 meeting rather than three 1-hour rows.
                time_slots.append({
                    'day': self.days[day_idx],
                    'start_time': self.slots[slot_idx]['start'],
                    'end_time': self.slots[slot_idx + length - 1]['end'],
                    'hours': length,
                    'is_lab': klass['lab_from'] is not None and b_idx >= klass['lab_from'],
                })

            time_slots.sort(key=lambda t: (self.days.index(t['day']), t['start_time']))

            schedules.append({
                'subject': klass['subject'],
                'section': klass['section']['letter'],
                'section_code': klass['section']['code'],
                'faculty': assigned_faculty,
                'room': assigned_room,
                'time_slots': time_slots,
            })

        return schedules

    def summarise(self, solver, schedules):
        """Per-teacher load and experience match, for the UI to show its work."""
        load = defaultdict(int)
        matched = 0
        for s in schedules:
            if not s['faculty']:
                continue
            load[s['faculty']['name']] += int(s['subject'].get('units') or 3)
            exp = (s['faculty'].get('experience') or {}).get(str(s['subject'].get('_id')), 0)
            if exp:
                matched += 1

        elapsed = solver.WallTime()
        limit = getattr(self, '_time_limit', None)

        return {
            'subjects_scheduled': len(schedules),
            'solver_time': round(elapsed, 3),
            'objective': solver.ObjectiveValue() if schedules else 0,
            'faculty_load': dict(load),
            'busiest_faculty_units': max(load.values()) if load else 0,
            'assignments_with_experience': matched,
            # Lets the caller offer "try again with more time" instead of the
            # user wondering why the result says FEASIBLE rather than OPTIMAL.
            'hit_time_limit': bool(limit and elapsed >= limit - 0.5),
        }


def optimize_schedule(input_json):
    try:
        data = json.loads(input_json) if isinstance(input_json, str) else input_json

        optimizer = TimetableOptimizer(data)
        optimizer.build_classes()

        if not optimizer.classes:
            # Everything requested is already on the timetable. That is a
            # success with nothing to do, not a failure.
            if optimizer.skipped:
                return {
                    'success': True,
                    'status': 'NOTHING_TO_SCHEDULE',
                    'schedules': [],
                    'skipped': optimizer.skipped,
                    'statistics': {'subjects_scheduled': 0, 'solver_time': 0},
                    'diagnostics': [
                        f'All {len(optimizer.skipped)} subject(s) already have a '
                        f'schedule for this section. Nothing left to generate.'
                    ],
                }
            return {'success': False, 'status': 'NO_INPUT', 'schedules': None,
                    'error': 'No subjects to schedule.'}

        blockers = optimizer.preflight()
        if blockers:
            return {
                'success': False,
                'status': 'INFEASIBLE',
                'schedules': None,
                'error': blockers[0],
                'blockers': blockers,
            }

        optimizer.create_variables()
        optimizer.add_constraints()
        optimizer.set_objective()

        status, solver = optimizer.solve(
            time_limit_seconds=data.get('time_limit', 60),
            workers=(data.get('options') or {}).get('workers', 8),
        )

        status_text = solver.StatusName(status)
        solved = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        schedules = optimizer.extract_solution(solver) if solved else None

        result = {
            'success': solved,
            'status': status_text,
            'schedules': schedules,
            'statistics': optimizer.summarise(solver, schedules) if solved else {},
            'diagnostics': optimizer.diagnostics,
            'skipped': optimizer.skipped,
        }

        if not solved:
            result['error'] = (
                'No timetable satisfies every constraint. Common causes: too few '
                'rooms of the required type, faculty load limits too tight, or a '
                'shift too short for the required hours.'
                if status == cp_model.INFEASIBLE else
                f'Solver stopped with status {status_text}. Try a longer time limit.'
            )

        return result

    except ValueError as exc:
        # Raised by create_variables for structurally impossible requests
        return {'success': False, 'status': 'INFEASIBLE', 'schedules': None,
                'error': str(exc)}
    except Exception as exc:  # noqa: BLE001 - surface the reason to the caller
        return {'success': False, 'status': 'ERROR', 'schedules': None,
                'error': f'{type(exc).__name__}: {exc}'}


if __name__ == '__main__':
    print(json.dumps(optimize_schedule(sys.stdin.read())))
