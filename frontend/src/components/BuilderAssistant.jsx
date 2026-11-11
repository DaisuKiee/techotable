import React, { useEffect, useRef, useState } from 'react';
import { Wand2, Send, Loader2, X, Plus, CheckCircle, AlertTriangle, MessageSquare, Square, Brain, Trash2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { scheduleAPI, getErrorMessage } from '../services/api';
import { useConfirm } from '../context/ConfirmContext';
import { renderMarkdown } from '../utils/markdown';
import { useDockBlo } from '../utils/bloDock';
import AnimatedRobotHeadNoChatBubble from './AnimatedRobotHeadNoChatBubble';

const fmt = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

const QUICK_QUESTIONS = [
  'What should I place next?',
  'Check this week for problems',
  'Which teacher fits the remaining subjects best?',
  'How can I make the days more compact?',
];

/**
 * The builder's AI panel.
 *
 *  Suggestions - runs the timetable solver for the subjects still missing,
 *                around everything already on the grid (saved and unsaved),
 *                and lets you add each suggestion as an unsaved card.
 *  Ask AI      - questions about this section, answered by Gemini with the
 *                current grid, remaining subjects and teacher loads as context.
 *
 * All the data work is passed in by ScheduleBuilder:
 *   onSuggest()              -> Promise<{ schedules, failed, closeCalls, tradeoffs, message }>
 *   onAsk(question, onChunk, onEvent, signal) -> Promise<string>, streaming via onChunk
 *
 * B-LO's memory lives on the server: this section's conversation (loaded when
 * the panel opens, so it survives refreshes and other devices) and the notes
 * B-LO keeps about you across sections, which you can review and delete.
 *   onAdd(suggestion, facultyId) -> number of cards added
 */
const BuilderAssistant = ({ sectionKey, sectionLabel, onSuggest, onAsk, onAdd, facultyName, onClose, disabled }) => {
  const confirm = useConfirm();
  // While B-LO is docked here, the floating chat bubble hides
  useDockBlo(true);
  const [tab, setTab] = useState('suggest');

  // Suggestions
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [added, setAdded] = useState({}); // index -> true
  const [teacherPick, setTeacherPick] = useState({}); // index -> facultyId

  // Chat
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef(null);
  const abortRef = useRef(null);

  // Memory: saved conversation + notes
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showMemory, setShowMemory] = useState(false);

  const loadMemory = async () => {
    try {
      const res = await scheduleAPI.getBuilderMemory(sectionKey);
      const data = res.data.data || {};
      setNotes(data.notes || []);
      return data;
    } catch {
      return null;
    }
  };

  // Bring back this section's conversation
  useEffect(() => {
    let live = true;
    setHistoryLoaded(false);
    loadMemory().then((data) => {
      if (!live) return;
      setMessages((data?.messages || []).map((m) => ({ role: m.role, content: m.content })));
      setHistoryLoaded(true);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  const clearChat = async () => {
    if (!(await confirm({
      title: 'Clear this conversation?',
      message: `B-LO forgets the messages for ${sectionLabel || 'this section'}. What it remembers about you (Memory) is kept.`,
      confirmText: 'Clear conversation',
      type: 'danger',
      footnote: null,
    }))) return;
    try {
      await scheduleAPI.clearBuilderConversation(sectionKey);
      setMessages([]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not clear the conversation'));
    }
  };

  const forgetNote = async (note) => {
    try {
      await scheduleAPI.deleteBuilderNote(note._id);
      setNotes((list) => list.filter((n) => n._id !== note._id));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update B-LO’s memory'));
    }
  };

  const forgetAll = async () => {
    if (!(await confirm({
      title: 'Make B-LO forget everything?',
      message: `B-LO deletes all ${notes.length} things it remembers about you. Conversations are kept.`,
      confirmText: 'Forget everything',
      type: 'danger',
      footnote: null,
    }))) return;
    try {
      await scheduleAPI.clearBuilderNotes();
      setNotes([]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update B-LO’s memory'));
    }
  };

  // Stop a reply that's still streaming when the panel closes
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, thinking]);

  const suggest = async () => {
    setBusy(true);
    setError('');
    setAdded({});
    setTeacherPick({});
    try {
      setResult(await onSuggest());
    } catch (err) {
      setResult(null);
      setError(err?.response?.data?.message || err?.message || 'Could not get suggestions.');
    } finally {
      setBusy(false);
    }
  };

  const add = (s, i) => {
    const n = onAdd(s, teacherPick[i] || s.faculty);
    if (n > 0) setAdded((a) => ({ ...a, [i]: true }));
  };

  const addAll = () => {
    (result?.schedules || []).forEach((s, i) => { if (!added[i]) add(s, i); });
  };

  const ask = async (text) => {
    const q = String(text || draft).trim();
    if (!q || thinking) return;
    setDraft('');
    // The reply streams into this message as it's written
    setMessages((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '', streaming: true }]);
    const setReply = (patchReply) => setMessages((m) => {
      const next = [...m];
      next[next.length - 1] = { ...next[next.length - 1], ...patchReply };
      return next;
    });
    const controller = new AbortController();
    abortRef.current = controller;
    setThinking(true);
    try {
      const answer = await onAsk(
        q,
        (text) => setReply({ content: text }),
        (event) => {
          // The answer is complete; B-LO may still be noting things to remember
          if (event.type === 'done') setReply({ streaming: false });
          if (event.type === 'memory' && event.added?.length) {
            setReply({ remembered: event.added });
            loadMemory();
          }
        },
        controller.signal,
      );
      setReply({ streaming: false, content: answer || '_(No answer came back. Try rephrasing the question.)_' });
    } catch (err) {
      if (err?.name === 'AbortError') {
        setMessages((m) => {
          const last = m[m.length - 1];
          const next = [...m];
          next[next.length - 1] = { ...last, streaming: false, content: last.content ? `${last.content}\n\n_(stopped)_` : '_(stopped)_' };
          return next;
        });
      } else {
        setReply({ streaming: false, error: true, content: err?.message || 'B-LO couldn’t answer. Try again in a moment.' });
      }
    } finally {
      abortRef.current = null;
      setThinking(false);
    }
  };

  const closeCallFor = (i) => (result?.closeCalls || []).find((c) => c.index === i);
  const schedules = result?.schedules || [];
  const remainingToAdd = schedules.filter((_, i) => !added[i]).length;

  return (
    <aside className="flex h-full min-h-0 w-80 flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" aria-label="B-LO, scheduling assistant">
      {/* Header + tabs */}
      <div className="flex-shrink-0 border-b border-gray-100 px-4 pt-3 dark:border-gray-700">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-blue-600 text-white">
            <AnimatedRobotHeadNoChatBubble className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-white">B-LO</p>
            <p className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">Your scheduling assistant</p>
          </div>
          <button type="button" onClick={onClose} title="Hide B-LO" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1" role="tablist">
          {[['suggest', 'Suggestions', Wand2], ['ask', 'Ask B-LO', MessageSquare]].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-2 pb-2 text-xs font-semibold transition-colors ${
                tab === id ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'suggest' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-3 text-xs text-gray-600 dark:text-gray-300">
            Finds the best times, teachers and rooms for the subjects not on the grid yet, working around everything already placed.
          </p>
          <button
            type="button"
            onClick={suggest}
            disabled={busy || disabled}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {busy ? 'Working it out…' : result ? 'Suggest again' : 'Suggest the rest'}
          </button>

          {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}

          {result && (
            <div className="mt-3 space-y-3">
              {schedules.length === 0 ? (
                <p className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                  <CheckCircle className="mr-1 inline h-3.5 w-3.5" />
                  {result.message || 'Every subject already has its classes. Nothing left to suggest.'}
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{schedules.length} suggested class{schedules.length === 1 ? '' : 'es'}</p>
                    {remainingToAdd > 0 && (
                      <button type="button" onClick={addAll} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                        Add all {remainingToAdd}
                      </button>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {schedules.map((s, i) => {
                      const cc = closeCallFor(i);
                      const options = cc ? [cc.chosen, ...cc.alternatives] : [];
                      return (
                        <li key={i} className={`rounded-xl border p-2.5 ${added[i] ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{s.metadata?.subjectCode}</p>
                              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{s.metadata?.subjectName}</p>
                            </div>
                            {added[i] ? (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle className="h-3.5 w-3.5" /> Added</span>
                            ) : (
                              <button type="button" onClick={() => add(s, i)} className="flex items-center gap-1 rounded-md border border-blue-300 px-2 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30">
                                <Plus className="h-3 w-3" /> Add
                              </button>
                            )}
                          </div>
                          <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-700 dark:text-gray-300">
                            {(s.timeSlots || []).map((t, k) => (
                              <li key={k}>{t.day.slice(0, 3)} {fmt(t.startTime)} – {fmt(t.endTime)}</li>
                            ))}
                          </ul>
                          <p className="mt-1 truncate text-[11px] text-gray-500 dark:text-gray-400">
                            {s.metadata?.roomName || 'Room TBA'}
                          </p>
                          {options.length > 1 && !added[i] ? (
                            <label className="mt-1.5 block">
                              <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">About as good a fit, your call:</span>
                              <select
                                value={teacherPick[i] || s.faculty}
                                onChange={(e) => setTeacherPick((p) => ({ ...p, [i]: e.target.value }))}
                                className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-1.5 py-1 text-[11px] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                              >
                                {options.map((o) => (
                                  <option key={o.facultyId} value={o.facultyId}>
                                    {o.name} · experience {o.experience}{o.qualified ? ' · qualified' : ''}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <p className="mt-0.5 truncate text-[11px] font-medium text-gray-700 dark:text-gray-200">
                              {facultyName(teacherPick[i] || s.faculty) || s.metadata?.facultyName || 'No teacher'}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {result.failed?.length > 0 && (
                <p className="rounded-lg bg-orange-50 p-2.5 text-xs text-orange-800 dark:bg-orange-900/20 dark:text-orange-200">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  Couldn&apos;t place: {result.failed.map((f) => f.subjectCode).join(', ')}
                </p>
              )}

              {result.tradeoffs?.notes?.length > 0 && schedules.length > 0 && (
                <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-900/40">
                  <p className="mb-1 text-[11px] font-semibold text-gray-800 dark:text-gray-200">What this plan gives up</p>
                  <ul className="space-y-0.5">
                    {result.tradeoffs.notes.map((n, i) => <li key={i} className="text-[11px] text-gray-600 dark:text-gray-300">• {n}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Memory + clear */}
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-1.5 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowMemory((v) => !v)}
              aria-pressed={showMemory}
              title="What B-LO remembers about you"
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                showMemory ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {showMemory ? <ArrowLeft className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
              {showMemory ? 'Back to chat' : `Memory${notes.length ? ` (${notes.length})` : ''}`}
            </button>
            {!showMemory && messages.length > 0 && (
              <button type="button" onClick={clearChat} disabled={thinking} title="Clear this conversation" className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700">
                <Trash2 className="h-3.5 w-3.5" /> Clear chat
              </button>
            )}
          </div>

          {showMemory ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p className="mb-3 text-xs text-gray-600 dark:text-gray-300">
                Things you&apos;ve told B-LO that it keeps in mind in every section: preferences, rules and decisions. Say
                {' '}<em>&ldquo;remember that…&rdquo;</em> to add one, or <em>&ldquo;forget…&rdquo;</em> to drop one.
              </p>
              {notes.length === 0 ? (
                <p className="rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">B-LO doesn&apos;t remember anything yet.</p>
              ) : (
                <>
                  <ul className="space-y-1.5">
                    {notes.map((n) => (
                      <li key={n._id} className="group flex items-start gap-2 rounded-lg border border-gray-200 px-2.5 py-2 dark:border-gray-700">
                        <Brain className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-gray-800 dark:text-gray-100">{n.text}</span>
                          {n.source && <span className="block text-[10px] text-gray-400">from {n.source}</span>}
                        </span>
                        <button type="button" onClick={() => forgetNote(n)} title="Forget this" aria-label={`Forget: ${n.text}`} className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={forgetAll} className="mt-3 text-[11px] font-medium text-red-600 hover:underline dark:text-red-400">
                    Forget everything
                  </button>
                </>
              )}
            </div>
          ) : (
          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {!historyLoaded && (
              <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your conversation…</p>
            )}
            {historyLoaded && messages.length === 0 && (
              <div>
                <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">
                  Hi! I&apos;m B-LO. Ask me about this section: I can see the grid, the subjects still missing and each teacher&apos;s load.
                </p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_QUESTIONS.map((q) => (
                    <button key={q} type="button" onClick={() => ask(q)} disabled={disabled} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-left text-xs text-gray-700 hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:bg-blue-900/10">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} className="ml-6 rounded-xl rounded-br-sm bg-blue-600 px-3 py-2 text-xs text-white">{m.content}</div>
              ) : (
                m.streaming && !m.content ? (
                  <p key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> B-LO is thinking…
                  </p>
                ) : (
                  <div key={i} className="mr-2">
                    <div
                      className={`ai-md rounded-xl rounded-bl-sm px-3 py-2 text-xs leading-relaxed ${m.streaming ? 'ai-streaming' : ''} ${m.error ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}
                      // renderMarkdown escapes HTML and only allows safe links
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                    />
                    {m.remembered?.length > 0 && (
                      <button type="button" onClick={() => setShowMemory(true)} className="mt-1 flex items-start gap-1 text-left text-[10px] text-blue-700 hover:underline dark:text-blue-300">
                        <Brain className="mt-px h-3 w-3 flex-shrink-0" />
                        <span>B-LO will remember: {m.remembered.join(' · ')}</span>
                      </button>
                    )}
                  </div>
                )
              )
            ))}
          </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); ask(); }}
            className="flex flex-shrink-0 items-end gap-2 border-t border-gray-100 p-2.5 dark:border-gray-700"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
              rows={2}
              maxLength={1000}
              placeholder="e.g. Where can CC 213 go on Tuesday?"
              aria-label="Ask B-LO"
              className="min-h-0 flex-1 resize-none rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            {thinking ? (
              <button type="button" onClick={() => abortRef.current?.abort()} title="Stop" className="rounded-lg bg-gray-700 p-2 text-white hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500">
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button type="submit" disabled={!draft.trim() || disabled} title="Send" className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      )}
    </aside>
  );
};

export default BuilderAssistant;
