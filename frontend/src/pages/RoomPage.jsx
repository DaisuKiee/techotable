import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Search, X, Grid3x3, List, RefreshCw, Building, Users, DoorOpen, FlaskConical, Gauge, CalendarX,
  SearchCheck, Pencil, Ban, RotateCcw, Copy, AlertTriangle, Home, ArrowUpDown,
} from 'lucide-react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import RoomModal from '../components/RoomModal';
import RoomDetailsDrawer, { DeactivateRoomDialog } from '../components/rooms/RoomDetailsDrawer';
import FreeRoomFinder from '../components/rooms/FreeRoomFinder';
import { LAB_ROOM_TYPES, ROOM_TYPES, typeMeta, usageTone, nextRoomCode } from '../components/rooms/roomMeta';
import { roomAPI, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MANAGERS = ['admin', 'scheduling_officer', 'program_manager'];
const VIEW_KEY = 'rooms.view';
const SORTS = {
  code: { label: 'Room code', fn: () => 0 },
  'capacity-desc': { label: 'Most seats', fn: (a, b) => b.capacity - a.capacity },
  'capacity-asc': { label: 'Fewest seats', fn: (a, b) => a.capacity - b.capacity },
  'usage-desc': { label: 'Busiest', fn: (a, b) => (b.usage?.hours || 0) - (a.usage?.hours || 0) },
  'usage-asc': { label: 'Least used', fn: (a, b) => (a.usage?.hours || 0) - (b.usage?.hours || 0) },
};
const byCode = (a, b) => String(a.roomCode).localeCompare(String(b.roomCode), undefined, { numeric: true });

const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } };

const UsageBar = ({ usage, compact = false }) => {
  const pct = usage?.utilization || 0;
  const tone = usageTone(pct);
  return (
    <div className={compact ? 'w-28' : ''}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={`font-semibold ${tone.text}`}>{usage?.classes ? `${usage.hours} h/week` : 'Not used'}</span>
        {usage?.classes > 0 && <span className="text-gray-500 dark:text-gray-400">{pct}%</span>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${Math.max(pct, usage?.classes ? 3 : 0)}%` }} />
      </div>
    </div>
  );
};

const RoomCard = ({ room, canManage, onOpen, onEdit, onDeactivate, onRestore }) => {
  const meta = typeMeta(room.roomType);
  const Icon = meta.icon;
  const inactive = room.isActive === false;
  const blocked = room.unavailableTimeSlots?.length || 0;
  const home = room.usage?.homeSections || [];
  const stop = (fn) => (e) => { e.stopPropagation(); fn(room); };

  return (
    <article
      role="button" tabIndex={0} onClick={() => onOpen(room)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(room); } }}
      aria-label={`${room.roomCode}, ${room.roomType}, ${room.capacity} seats${inactive ? ', deactivated' : ''}`}
      className={`group flex cursor-pointer flex-col rounded-xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-gray-800 ${
        inactive ? 'border-dashed border-gray-300 opacity-75 dark:border-gray-600' : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700 dark:hover:border-indigo-700'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${meta.tile}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-mono text-base font-bold text-gray-900 dark:text-white">{room.roomCode}</h3>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{room.roomName || room.roomType}</p>
        </div>
        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200" title="Seats">
          <Users className="h-3.5 w-3.5" />{room.capacity}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>{room.roomType}</span>
        {inactive && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">Deactivated</span>}
        {room.usage?.overCapacity && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300"><AlertTriangle className="h-3 w-3" /> Over capacity</span>}
        {blocked > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"><CalendarX className="h-3 w-3" /> {blocked} blocked</span>}
        {home.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" title={`Home room of ${home.join(', ')}`}><Home className="h-3 w-3" /> {home.length === 1 ? home[0] : `${home.length} sections`}</span>}
      </div>

      {!!room.facilities?.length && (
        <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400" title={room.facilities.join(', ')}>
          {room.facilities.slice(0, 3).join(' · ')}{room.facilities.length > 3 ? ` +${room.facilities.length - 3}` : ''}
        </p>
      )}

      <div className="mt-auto pt-3"><UsageBar usage={room.usage} /></div>

      {canManage && (
        <div className="mt-3 flex items-center gap-1 border-t border-gray-100 pt-2 opacity-100 transition-opacity dark:border-gray-700 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button type="button" onClick={stop(onEdit)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          {inactive ? (
            <button type="button" onClick={stop(onRestore)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
          ) : (
            <button type="button" onClick={stop(onDeactivate)} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/30"><Ban className="h-3.5 w-3.5" /> Deactivate</button>
          )}
        </div>
      )}
    </article>
  );
};

const SkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
    {Array.from({ length: 8 }, (_, i) => (
      <div key={i} className="h-44 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex gap-3"><div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700" /><div className="flex-1 space-y-2"><div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" /><div className="h-3 w-32 rounded bg-gray-100 dark:bg-gray-700/60" /></div></div>
        <div className="mt-4 h-3 w-20 rounded bg-gray-100 dark:bg-gray-700/60" />
        <div className="mt-10 h-1.5 rounded bg-gray-100 dark:bg-gray-700/60" />
      </div>
    ))}
  </div>
);

const RoomPage = () => {
  const { user } = useAuth();
  const canManage = MANAGERS.includes(user?.role);

  const [rooms, setRooms] = useState([]);
  const [term, setTerm] = useState(null);
  const [terms, setTerms] = useState([]);
  const [pickedTerm, setPickedTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('active');
  const [usageFilter, setUsageFilter] = useState('');
  const [sort, setSort] = useState('code');
  const [view, setView] = useState(readView);

  const [form, setForm] = useState(null); // { mode, room, suggestedCode }
  const [details, setDetails] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setLoadError('');
    try {
      const res = await roomAPI.getAll({
        status: 'all',
        includeUsage: true,
        ...(pickedTerm ? { academicYear: pickedTerm.academicYear, semester: pickedTerm.semester } : {}),
      });
      setRooms(res.data.data || []);
      setTerm(res.data.term || null);
      setTerms(res.data.terms || []);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load rooms'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pickedTerm]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch { /* remembered next time instead */ } }, [view]);

  // Keep an open details panel in step with reloaded data
  useEffect(() => {
    if (details) setDetails((d) => rooms.find((r) => r._id === d._id) || d);
  }, [rooms]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => rooms.filter((r) => r.isActive !== false), [rooms]);
  const buildings = useMemo(() => [...new Set(rooms.map((r) => r.building).filter(Boolean))].sort(), [rooms]);
  const stats = useMemo(() => {
    const used = active.filter((r) => r.usage?.classes > 0);
    return {
      active: active.length,
      inactive: rooms.length - active.length,
      seats: active.reduce((s, r) => s + (r.capacity || 0), 0),
      labs: active.filter((r) => LAB_ROOM_TYPES.has(r.roomType)).length,
      // One decimal below 1%, so a few booked rooms don't read as 0%
      avgUse: (() => {
        const avg = active.length ? active.reduce((s, r) => s + (r.usage?.utilization || 0), 0) / active.length : 0;
        return avg > 0 && avg < 1 ? avg.toFixed(1) : Math.round(avg);
      })(),
      unused: active.length - used.length,
      over: active.filter((r) => r.usage?.overCapacity),
      classes: active.reduce((s, r) => s + (r.usage?.classes || 0), 0),
    };
  }, [rooms, active]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (status === 'active' && r.isActive === false) return false;
      if (status === 'inactive' && r.isActive !== false) return false;
      if (building && r.building !== building) return false;
      if (type === 'labs' ? !LAB_ROOM_TYPES.has(r.roomType) : type && r.roomType !== type) return false;
      if (usageFilter === 'unused' && r.usage?.classes > 0) return false;
      if (usageFilter === 'over' && !r.usage?.overCapacity) return false;
      if (!q) return true;
      return [r.roomCode, r.roomName, r.building, r.roomType, ...(r.facilities || []), ...(r.usage?.homeSections || [])]
        .some((v) => String(v || '').toLowerCase().includes(q));
    }).sort((a, b) => SORTS[sort].fn(a, b) || byCode(a, b));
  }, [rooms, search, status, building, type, usageFilter, sort]);

  // Building -> floor -> rooms, for the grid
  const groups = useMemo(() => {
    const out = new Map();
    for (const r of filtered) {
      const b = r.building || 'No building';
      if (!out.has(b)) out.set(b, new Map());
      const floors = out.get(b);
      const f = r.floor || 1;
      if (!floors.has(f)) floors.set(f, []);
      floors.get(f).push(r);
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, floors]) => ({ name, count: [...floors.values()].reduce((s, l) => s + l.length, 0), floors: [...floors.entries()].sort(([a], [b]) => a - b) }));
  }, [filtered]);

  const anyFilter = search || building || type || usageFilter || status !== 'active';
  const clearFilters = () => { setSearch(''); setBuilding(''); setType(''); setUsageFilter(''); setStatus('active'); };

  const openCreate = () => setForm({ mode: 'create' });
  const openEdit = (room) => { setDetails(null); setForm({ mode: 'edit', room }); };
  const openDuplicate = (room) => {
    setDetails(null);
    setForm({ mode: 'duplicate', room, suggestedCode: nextRoomCode(room.roomCode, rooms.map((r) => r.roomCode)) });
  };
  const restore = async (room) => {
    try {
      const res = await roomAPI.restore(room._id);
      toast.success(res.data?.message || 'Room restored');
      load({ quiet: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not restore the room'));
    }
  };

  const termOptions = useMemo(() => {
    const list = [...terms];
    if (term && !list.some((t) => t.academicYear === term.academicYear && t.semester === term.semester)) list.unshift({ ...term, classes: 0 });
    return list;
  }, [terms, term]);

  const actions = { canManage, onOpen: setDetails, onEdit: openEdit, onDeactivate: setDeactivating, onRestore: restore };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">Room Management</h1>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => load({ quiet: true })} disabled={refreshing || loading} title="Refresh rooms"
                className="rounded-lg border border-gray-300 bg-white p-2.5 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button type="button" onClick={() => setFinderOpen((v) => !v)} aria-pressed={finderOpen}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${finderOpen
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-200'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`}>
                <SearchCheck className="h-5 w-5" /><span className="hidden sm:inline">Find a free room</span>
              </button>
              {canManage && (
                <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-md transition-colors hover:bg-indigo-700 hover:shadow-lg">
                  <Plus className="h-5 w-5" /><span className="hidden sm:inline">Add Room</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">
            Classrooms and labs shared by every program. Click a room to see its week; the generator uses active rooms only.
          </p>
          {term && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <Gauge className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <label htmlFor="room-term" className="text-gray-600 dark:text-gray-400">Usage for</label>
              <select id="room-term" value={`${term.academicYear}|${term.semester}`}
                onChange={(e) => { const [academicYear, semester] = e.target.value.split('|'); setPickedTerm({ academicYear, semester: Number(semester) }); }}
                className="rounded-md border border-gray-300 bg-white py-1 pl-2 pr-7 text-sm font-semibold text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                {termOptions.map((t) => (
                  <option key={`${t.academicYear}|${t.semester}`} value={`${t.academicYear}|${t.semester}`}>
                    {t.label}{t.classes ? ` (${t.classes} classes)` : ' (no classes yet)'}
                  </option>
                ))}
              </select>
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{stats.classes} class{stats.classes === 1 ? '' : 'es'} booked in active rooms</span>
            </div>
          )}
        </div>

        {/* Stats; Labs and Unused double as filters */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          <StatCard icon={DoorOpen} label="Rooms" value={stats.active} hint={stats.inactive ? `${stats.inactive} deactivated` : 'All active'} tone="indigo" onClick={clearFilters} title="Show all active rooms" />
          <StatCard icon={Users} label="Seats" value={stats.seats.toLocaleString()} hint={stats.active ? `Avg. ${Math.round(stats.seats / stats.active)} per room` : 'No rooms'} tone="blue" />
          <StatCard icon={FlaskConical} label="Lab rooms" value={stats.labs} hint="Click to filter" tone="violet" active={type === 'labs'} onClick={() => setType((t) => (t === 'labs' ? '' : 'labs'))} title="Show lab rooms" />
          <StatCard icon={Gauge} label="Avg. use" value={`${stats.avgUse}%`} hint="Of teachable hours" tone="emerald" />
          <StatCard icon={CalendarX} label="Unused" value={stats.unused} hint="No classes this term" tone="amber" active={usageFilter === 'unused'} onClick={() => setUsageFilter((u) => (u === 'unused' ? '' : 'unused'))} title="Show rooms with no classes" className="col-span-2 md:col-span-1" />
        </div>

        {stats.over.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1">
              <strong>{stats.over.length} room{stats.over.length === 1 ? ' has' : 's have'} a class bigger than the seats:</strong> {stats.over.slice(0, 5).map((r) => r.roomCode).join(', ')}{stats.over.length > 5 ? '…' : ''}
            </span>
            <button type="button" onClick={() => setUsageFilter((u) => (u === 'over' ? '' : 'over'))} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-100 dark:bg-red-950 dark:text-red-200">
              {usageFilter === 'over' ? 'Show all' : 'Show them'}
            </button>
          </div>
        )}

        {finderOpen && <FreeRoomFinder term={term} onOpenRoom={setDetails} onClose={() => setFinderOpen(false)} />}

        {/* Search and filters */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search rooms"
                placeholder="Search code, name, feature or section…"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Clear search"><X className="h-4 w-4" /></button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm dark:border-gray-600" role="group" aria-label="Status">
                {[['active', `Active ${stats.active}`], ['inactive', `Deactivated ${stats.inactive}`], ['all', 'All']].map(([key, label], i) => (
                  <button key={key} type="button" onClick={() => setStatus(key)} aria-pressed={status === key}
                    className={`px-3 py-2 font-medium transition-colors ${i ? 'border-l border-gray-300 dark:border-gray-600' : ''} ${status === key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {buildings.length > 1 && (
                <select value={building} onChange={(e) => setBuilding(e.target.value)} aria-label="Building" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  <option value="">All buildings</option>
                  {buildings.map((b) => <option key={b}>{b}</option>)}
                </select>
              )}
              <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Room type" className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="">All types</option>
                <option value="labs">Lab rooms</option>
                {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <label className="relative">
                <span className="sr-only">Sort</span>
                <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-gray-300 py-2.5 pl-8 pr-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                </select>
              </label>
              <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600" role="group" aria-label="View">
                <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'} title="Cards" className={`px-3 py-2 transition-colors ${view === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'}`}><Grid3x3 className="h-5 w-5" /></button>
                <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} title="Table" className={`border-l border-gray-300 px-3 py-2 transition-colors dark:border-gray-600 ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'}`}><List className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
          {anyFilter && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Showing {filtered.length} of {rooms.length}</span>
              <button type="button" onClick={clearFilters} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">Reset filters</button>
            </div>
          )}
        </div>

        {/* Rooms */}
        {loading ? (
          <SkeletonGrid />
        ) : loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
            <p className="font-semibold text-red-800 dark:text-red-300">{loadError}</p>
            <button type="button" onClick={() => load()} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-600 dark:bg-gray-800">
            <DoorOpen className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
            <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{rooms.length === 0 ? 'No rooms yet' : 'No rooms match'}</h3>
            <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">{rooms.length === 0 ? 'Add the classrooms and labs the generator can use.' : 'Try another search or reset the filters.'}</p>
            {rooms.length === 0 && canManage ? (
              <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"><Plus className="h-5 w-5" /> Add the first room</button>
            ) : (
              <button type="button" onClick={clearFilters} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Reset filters</button>
            )}
          </div>
        ) : view === 'grid' ? (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.name} aria-label={g.name}>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                  <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> {g.name}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">· {g.count} room{g.count === 1 ? '' : 's'}</span>
                </h2>
                <div className="space-y-5">
                  {g.floors.map(([floor, list]) => (
                    <div key={floor}>
                      {g.floors.length > 1 && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Floor {floor} · {list.length}</h3>}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {list.map((room) => <RoomCard key={room._id} room={room} {...actions} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-right">Seats</th>
                    <th className="px-4 py-3">Use this term</th>
                    <th className="px-4 py-3">Notes</th>
                    {canManage && <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((room) => {
                    const meta = typeMeta(room.roomType);
                    const Icon = meta.icon;
                    const inactive = room.isActive === false;
                    return (
                      <tr key={room._id} onClick={() => setDetails(room)} className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${inactive ? 'opacity-60' : ''}`}>
                        <td className="whitespace-nowrap px-4 py-3">
                          <button type="button" onClick={(e) => { e.stopPropagation(); setDetails(room); }} className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tile}`}><Icon className="h-4 w-4" /></span>
                            <span>
                              <span className="block font-mono font-semibold text-gray-900 dark:text-white">{room.roomCode}</span>
                              {room.roomName && <span className="block max-w-[14rem] truncate text-xs text-gray-500 dark:text-gray-400">{room.roomName}</span>}
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>{room.roomType}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">{room.building} · F{room.floor || 1}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{room.capacity}</td>
                        <td className="px-4 py-3"><UsageBar usage={room.usage} compact /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {inactive && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">Deactivated</span>}
                            {room.usage?.overCapacity && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">Over capacity</span>}
                            {room.unavailableTimeSlots?.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{room.unavailableTimeSlots.length} blocked</span>}
                            {room.usage?.homeSections?.length > 0 && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Home: {room.usage.homeSections.join(', ')}</span>}
                          </div>
                        </td>
                        {canManage && (
                          <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => openEdit(room)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30" title={`Edit ${room.roomCode}`}><Pencil className="h-4 w-4" /></button>
                              <button type="button" onClick={() => openDuplicate(room)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title={`Duplicate ${room.roomCode}`}><Copy className="h-4 w-4" /></button>
                              {inactive ? (
                                <button type="button" onClick={() => restore(room)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30" title={`Restore ${room.roomCode}`}><RotateCcw className="h-4 w-4" /></button>
                              ) : (
                                <button type="button" onClick={() => setDeactivating(room)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30" title={`Deactivate ${room.roomCode}`}><Ban className="h-4 w-4" /></button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {details && (
        <RoomDetailsDrawer
          room={details}
          term={term}
          canManage={canManage}
          onClose={() => setDetails(null)}
          onEdit={openEdit}
          onDuplicate={openDuplicate}
          onDeactivate={(room) => setDeactivating(room)}
          onRestore={restore}
        />
      )}

      {form && (
        <RoomModal
          mode={form.mode}
          room={form.room}
          rooms={rooms}
          suggestedCode={form.suggestedCode}
          onClose={(saved) => { setForm(null); if (saved) load({ quiet: true }); }}
        />
      )}

      {deactivating && (
        <DeactivateRoomDialog
          room={deactivating}
          onClose={() => setDeactivating(null)}
          onDone={(message, kind) => {
            toast.success(message || 'Done');
            setDeactivating(null);
            if (kind === 'delete') setDetails(null);
            load({ quiet: true });
          }}
        />
      )}
    </Layout>
  );
};

export default RoomPage;
