import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  X, Plus, Trash2, DoorOpen, Building, Users, Sparkles, Wrench, CalendarX, StickyNote, AlertCircle, Check, Loader2,
} from 'lucide-react';
import { roomAPI, getErrorMessage } from '../services/api';
import { ModalShell } from './modal/ModalShell';
import {
  ROOM_TYPES, LAB_ROOM_TYPES, DAYS, CONDITIONS, MAX_CAPACITY, FEATURE_PRESETS, TIME_OPTIONS,
  typeMeta, toMin, fmtTime,
} from './rooms/roomMeta';

const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const INPUT_ERR = 'border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/30';

const blankEquipment = () => ({ name: '', quantity: 1, condition: 'Good' });

/** Form state from a room record (edit / duplicate) or defaults (create). */
const fromRoom = (room, { building = '' } = {}) => ({
  roomCode: room?.roomCode || room?.roomNumber || '',
  roomName: room?.roomName || '',
  building: room?.building || building,
  floor: room?.floor || 1,
  roomType: room?.roomType || room?.type || 'Lecture Room',
  capacity: room?.capacity || 40,
  facilities: [...(room?.facilities || [])],
  equipment: (room?.equipment || []).map((eq) => (typeof eq === 'string'
    ? { name: eq, quantity: 1, condition: 'Good' }
    : { name: eq.name || '', quantity: eq.quantity || 1, condition: eq.condition || 'Good' })),
  unavailableTimeSlots: (room?.unavailableTimeSlots || []).map(({ day, startTime, endTime, reason }) => ({ day, startTime, endTime, reason: reason || '' })),
  notes: room?.notes || '',
});

/** Same rules as the server (cleanRoomInput), so most mistakes show before saving. */
const validate = (f, takenCodes) => {
  const errors = {};
  const code = f.roomCode.trim().toUpperCase();
  if (!code) errors.roomCode = 'Enter a room code';
  else if (!/^[A-Z0-9][A-Z0-9 _.\-/]{0,19}$/.test(code)) errors.roomCode = 'Letters, numbers, spaces, dashes, dots or slashes; 20 characters max';
  else if (takenCodes.has(code)) errors.roomCode = `${code} is already used by another room`;
  if (!f.building.trim()) errors.building = 'Enter the building';
  const floor = Number(f.floor);
  if (!Number.isInteger(floor) || floor < 1 || floor > 30) errors.floor = '1 to 30';
  const cap = Number(f.capacity);
  if (!Number.isInteger(cap) || cap < 1 || cap > MAX_CAPACITY) errors.capacity = `A whole number from 1 to ${MAX_CAPACITY}`;

  f.equipment.forEach((eq, i) => {
    if (eq.name.trim() && (!Number.isInteger(Number(eq.quantity)) || Number(eq.quantity) < 1)) errors[`equipment.${i}`] = 'Quantity must be at least 1';
  });
  f.unavailableTimeSlots.forEach((s, i) => {
    if (toMin(s.endTime) <= toMin(s.startTime)) errors[`slot.${i}`] = 'End time must be after the start time';
  });
  f.unavailableTimeSlots.forEach((a, i) => {
    f.unavailableTimeSlots.forEach((b, j) => {
      if (j <= i || a.day !== b.day || errors[`slot.${j}`]) return;
      if (toMin(a.startTime) < toMin(b.endTime) && toMin(a.endTime) > toMin(b.startTime)) {
        errors[`slot.${j}`] = `Overlaps the other ${a.day} block (${fmtTime(a.startTime)}–${fmtTime(a.endTime)})`;
      }
    });
  });
  return errors;
};

const Card = ({ icon: Icon, title, hint, action, children }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" /> {title}
        </h3>
        {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Label = ({ htmlFor, children, required }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
    {children}{required && <span className="text-red-500"> *</span>}
  </label>
);

const FieldError = ({ children }) => (children ? (
  <p className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><AlertCircle className="h-3 w-3 flex-shrink-0" />{children}</p>
) : null);

/**
 * Add / edit / duplicate a room.
 *
 * mode: 'create' | 'edit' | 'duplicate'. `rooms` (all rooms) supplies the
 * building suggestions and the duplicate-code check.
 */
const RoomModal = ({ mode, room, rooms = [], suggestedCode = '', onClose }) => {
  const editing = mode === 'edit';
  const [form, setForm] = useState(() => {
    if (mode === 'create') return fromRoom(null, { building: rooms[0]?.building || '' });
    const base = fromRoom(room);
    return mode === 'duplicate' ? { ...base, roomCode: suggestedCode, roomName: '' } : base;
  });
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const [customFeature, setCustomFeature] = useState('');

  const buildings = useMemo(() => [...new Set(rooms.map((r) => r.building).filter(Boolean))].sort(), [rooms]);
  const takenCodes = useMemo(() => new Set(rooms
    .filter((r) => !editing || String(r._id) !== String(room?._id))
    .map((r) => String(r.roomCode || '').toUpperCase())), [rooms, editing, room]);
  const errors = useMemo(() => validate(form, takenCodes), [form, takenCodes]);
  const show = (key) => (touched ? errors[key] : undefined);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setRow = (list, i, patch) => setForm((f) => ({ ...f, [list]: f[list].map((row, j) => (j === i ? { ...row, ...patch } : row)) }));
  const removeRow = (list, i) => setForm((f) => ({ ...f, [list]: f[list].filter((_, j) => j !== i) }));

  const toggleFeature = (name) => setForm((f) => {
    const has = f.facilities.some((x) => x.toLowerCase() === name.toLowerCase());
    return { ...f, facilities: has ? f.facilities.filter((x) => x.toLowerCase() !== name.toLowerCase()) : [...f.facilities, name] };
  });
  const addCustomFeature = () => {
    const name = customFeature.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (!form.facilities.some((x) => x.toLowerCase() === name.toLowerCase())) set('facilities', [...form.facilities, name]);
    setCustomFeature('');
  };
  const extraFeatures = form.facilities.filter((x) => !FEATURE_PRESETS.some((p) => p.toLowerCase() === x.toLowerCase()));

  const addSlot = () => {
    const last = form.unavailableTimeSlots[form.unavailableTimeSlots.length - 1];
    const nextDay = last ? DAYS[(DAYS.indexOf(last.day) + 1) % DAYS.length] : 'Monday';
    set('unavailableTimeSlots', [...form.unavailableTimeSlots, { day: nextDay, startTime: last?.startTime || '08:00', endTime: last?.endTime || '10:00', reason: last?.reason || '' }]);
  };

  const isLab = LAB_ROOM_TYPES.has(form.roomType);
  const wasLab = editing && LAB_ROOM_TYPES.has(room?.roomType);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setServerError('');
    if (Object.keys(errors).length) {
      toast.error('Check the highlighted fields');
      return;
    }
    const payload = {
      ...form,
      roomCode: form.roomCode.trim().toUpperCase(),
      floor: Number(form.floor),
      capacity: Number(form.capacity),
      equipment: form.equipment.filter((eq) => eq.name.trim()).map((eq) => ({ ...eq, name: eq.name.trim(), quantity: Number(eq.quantity) })),
    };
    setSaving(true);
    try {
      const res = editing ? await roomAPI.update(room._id, payload) : await roomAPI.create(payload);
      toast.success(res.data?.message || 'Room saved');
      (res.data?.warnings || []).forEach((w) => toast(w, { icon: '⚠️', duration: 8000 }));
      onClose(true, res.data?.data);
    } catch (err) {
      setServerError(getErrorMessage(err, 'Could not save the room'));
    } finally {
      setSaving(false);
    }
  };

  const heading = editing ? `Edit ${room?.roomCode || 'room'}` : mode === 'duplicate' ? `Duplicate ${room?.roomCode}` : 'Add a room';
  const TypeIcon = typeMeta(form.roomType).icon;

  return (
    <ModalShell variant="drawer" size="lg" onClose={() => onClose(false)} label={heading} busy={saving} panelClassName="bg-gray-50 dark:bg-gray-900">
      {/* Header with a live summary of the room */}
      <div className="flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-600 px-6 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/70">
              {editing ? 'Update room details' : mode === 'duplicate' ? 'Same setup, new room' : 'New room or facility'}
            </p>
            <h2 className="break-words text-2xl font-bold">{heading}</h2>
          </div>
          <button type="button" onClick={() => onClose(false)} className="flex-shrink-0 rounded-full bg-white/15 p-1.5 transition-colors hover:bg-white/25" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
          <span className="inline-flex items-center gap-1.5 font-semibold"><TypeIcon className="h-4 w-4" />{form.roomCode.trim().toUpperCase() || 'Code'}</span>
          <span>{form.roomType}</span>
          <span>·</span>
          <span>{form.capacity || 0} seats</span>
          <span>·</span>
          <span>{form.building || 'Building'}, floor {form.floor || 1}</span>
        </div>
      </div>

      <form id="room-form" onSubmit={submit} noValidate className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
        {serverError && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{serverError}</span>
            <button type="button" onClick={() => setServerError('')} title="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        )}

        <Card icon={DoorOpen} title="Room" hint="The code is what timetables, students and teachers see.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="room-code" required>Room code</Label>
              <input id="room-code" value={form.roomCode} onChange={(e) => set('roomCode', e.target.value.toUpperCase())}
                placeholder="e.g. COTE-31" maxLength={20} autoComplete="off"
                className={`${INPUT} font-mono uppercase ${show('roomCode') ? INPUT_ERR : ''}`} aria-invalid={!!show('roomCode')} />
              <FieldError>{show('roomCode')}</FieldError>
            </div>
            <div>
              <Label htmlFor="room-name">Display name</Label>
              <input id="room-name" value={form.roomName} onChange={(e) => set('roomName', e.target.value)}
                placeholder="e.g. Programming Lab 2" maxLength={80} className={INPUT} />
            </div>
            <div>
              <Label htmlFor="room-building" required>Building</Label>
              <input id="room-building" list="room-buildings" value={form.building} onChange={(e) => set('building', e.target.value)}
                placeholder="e.g. CoTE Building" maxLength={60}
                className={`${INPUT} ${show('building') ? INPUT_ERR : ''}`} aria-invalid={!!show('building')} />
              <datalist id="room-buildings">{buildings.map((b) => <option key={b} value={b} />)}</datalist>
              <FieldError>{show('building')}</FieldError>
            </div>
            <div>
              <Label htmlFor="room-floor">Floor</Label>
              <input id="room-floor" type="number" min={1} max={30} value={form.floor} onChange={(e) => set('floor', e.target.value)}
                className={`${INPUT} ${show('floor') ? INPUT_ERR : ''}`} />
              <FieldError>{show('floor')}</FieldError>
            </div>
          </div>
        </Card>

        <Card icon={Users} title="Type and capacity" hint="A section with a home room has all its classes there. For sections without one, the generator puts lab subjects in lab rooms and each class in the smallest room that seats it.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Room type">
            {ROOM_TYPES.map((type) => {
              const meta = typeMeta(type);
              const Icon = meta.icon;
              const active = form.roomType === type;
              return (
                <button key={type} type="button" role="radio" aria-checked={active} onClick={() => set('roomType', type)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${active
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-900/30'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50'}`}>
                  <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.tile}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                      {type}{active && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{meta.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {wasLab && !isLab && (
            <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
              This room stops counting as a lab. Sections whose home room it is still have their labs here; other sections’ lab sessions won’t be placed here.
            </p>
          )}

          <div className="mt-4 max-w-xs">
            <Label htmlFor="room-capacity" required>Seats</Label>
            <div className="flex items-stretch">
              <button type="button" onClick={() => set('capacity', Math.max(1, Number(form.capacity || 0) - 5))} className="rounded-l-lg border border-r-0 border-gray-300 px-3 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="5 fewer seats">−5</button>
              <input id="room-capacity" type="number" min={1} max={MAX_CAPACITY} value={form.capacity} onChange={(e) => set('capacity', e.target.value)}
                className={`${INPUT} rounded-none text-center font-semibold ${show('capacity') ? INPUT_ERR : ''}`} />
              <button type="button" onClick={() => set('capacity', Math.min(MAX_CAPACITY, Number(form.capacity || 0) + 5))} className="rounded-r-lg border border-l-0 border-gray-300 px-3 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" aria-label="5 more seats">+5</button>
            </div>
            <FieldError>{show('capacity')}</FieldError>
            {editing && room?.usage?.largestClass > 0 && Number(form.capacity) < room.usage.largestClass && (
              <p className="mt-1.5 text-xs text-orange-700 dark:text-orange-400">
                A class here this term has {room.usage.largestClass} students, more than {form.capacity} seats.
              </p>
            )}
          </div>
        </Card>

        <Card icon={Sparkles} title="Features" hint="Tap to add or remove. Teachers and students see these on the class page.">
          <div className="flex flex-wrap gap-2">
            {FEATURE_PRESETS.map((name) => {
              const on = form.facilities.some((x) => x.toLowerCase() === name.toLowerCase());
              return (
                <button key={name} type="button" aria-pressed={on} onClick={() => toggleFeature(name)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}`}>
                  {on && <Check className="h-3 w-3" />}{name}
                </button>
              );
            })}
            {extraFeatures.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 rounded-full border border-blue-500 bg-blue-600 py-1.5 pl-3 pr-1.5 text-xs font-medium text-white">
                {name}
                <button type="button" onClick={() => toggleFeature(name)} className="rounded-full p-0.5 hover:bg-white/20" aria-label={`Remove ${name}`}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex max-w-sm gap-2">
            <input value={customFeature} onChange={(e) => setCustomFeature(e.target.value)} maxLength={40}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomFeature(); } }}
              placeholder="Something else, e.g. Stage" className={INPUT} aria-label="Add another feature" />
            <button type="button" onClick={addCustomFeature} disabled={!customFeature.trim()} className="rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Add</button>
          </div>
        </Card>

        <Card icon={Wrench} title="Equipment" hint="Countable items and their condition, e.g. 40 computers, 1 projector."
          action={<button type="button" onClick={() => set('equipment', [...form.equipment, blankEquipment()])} className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"><Plus className="h-3.5 w-3.5" /> Add item</button>}>
          {form.equipment.length === 0 ? (
            <p className="text-sm italic text-gray-500 dark:text-gray-400">No equipment listed.</p>
          ) : (
            <div className="space-y-2">
              {form.equipment.map((eq, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <input value={eq.name} onChange={(e) => setRow('equipment', i, { name: e.target.value })} placeholder="Item, e.g. Desktop computer" maxLength={60} className={`${INPUT} min-w-0 flex-1 basis-full sm:basis-auto`} aria-label={`Item ${i + 1} name`} />
                    <input type="number" min={1} max={999} value={eq.quantity} onChange={(e) => setRow('equipment', i, { quantity: e.target.value })} className={`${INPUT} w-20 ${show(`equipment.${i}`) ? INPUT_ERR : ''}`} aria-label={`Item ${i + 1} quantity`} />
                    <select value={eq.condition} onChange={(e) => setRow('equipment', i, { condition: e.target.value })} className={`${INPUT} w-32`} aria-label={`Item ${i + 1} condition`}>
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => removeRow('equipment', i)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30" aria-label={`Remove item ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <FieldError>{show(`equipment.${i}`)}</FieldError>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card icon={CalendarX} title="Blocked times" hint="Weekly times the room can’t be used, e.g. maintenance. New timetables and manual edits keep classes out of them."
          action={<button type="button" onClick={addSlot} className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"><Plus className="h-3.5 w-3.5" /> Add time</button>}>
          {form.unavailableTimeSlots.length === 0 ? (
            <p className="text-sm italic text-gray-500 dark:text-gray-400">Available all week.</p>
          ) : (
            <div className="space-y-2">
              {form.unavailableTimeSlots.map((slot, i) => (
                <div key={i} className={`rounded-lg border p-2.5 ${show(`slot.${i}`) ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40'}`}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_1.4fr_auto]">
                    <select value={slot.day} onChange={(e) => setRow('unavailableTimeSlots', i, { day: e.target.value })} className={INPUT} aria-label={`Blocked time ${i + 1} day`}>
                      {DAYS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <select value={slot.startTime} onChange={(e) => setRow('unavailableTimeSlots', i, { startTime: e.target.value })} className={INPUT} aria-label="From">
                        {TIME_OPTIONS.slice(0, -1).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="hidden text-xs text-gray-400 sm:inline">to</span>
                      <select value={slot.endTime} onChange={(e) => setRow('unavailableTimeSlots', i, { endTime: e.target.value })} className={INPUT} aria-label="To">
                        {TIME_OPTIONS.slice(1).map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
                      </select>
                    </div>
                    <input value={slot.reason} onChange={(e) => setRow('unavailableTimeSlots', i, { reason: e.target.value })} placeholder="Reason (optional)" maxLength={120} className={`${INPUT} col-span-2 sm:col-span-1`} aria-label={`Blocked time ${i + 1} reason`} />
                    <button type="button" onClick={() => removeRow('unavailableTimeSlots', i)} className="justify-self-end rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30" aria-label={`Remove blocked time ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <FieldError>{show(`slot.${i}`)}</FieldError>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card icon={StickyNote} title="Notes" hint="Only staff see these.">
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} maxLength={500} placeholder="e.g. Key is with the CoTE office" className={`${INPUT} resize-y`} aria-label="Notes" />
          <p className="mt-1 text-right text-xs text-gray-400">{form.notes.length}/500</p>
        </Card>
      </form>

      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
        <span className="hidden items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 sm:flex">
          <Building className="h-3.5 w-3.5" /> Rooms are shared by every program
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => onClose(false)} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
          <button type="submit" form="room-form" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add room'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default RoomModal;
