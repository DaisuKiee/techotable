import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { X, Send, Square, Copy, Check, RotateCcw, ArrowDown, MessageSquarePlus } from 'lucide-react';
import AnimatedRobotHead from './AnimatedRobotHead';
import AnimatedRobotHeadNoChatBubble from './AnimatedRobotHeadNoChatBubble';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Final size of the chat window (same value is used for the content layer so
// the content never reflows while the window is growing/shrinking). On phones
// it fills almost the whole screen.
const CHAT_W = 'min(26rem, calc(100vw - 1rem))';
const CHAT_H = 'min(38rem, calc(100dvh - 1rem))';
const EDGE = 'clamp(0.5rem, 2vw, 1.5rem)';
const OPEN_MS = 650;
const CLOSE_MS = 850;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_CLOSE = 'cubic-bezier(0.65, 0, 0.35, 1)';
// While closing, the head turns into the bubble icon between these points of the flight (0 to 1)
const MORPH_START = 0.2;
const MORPH_END = 0.7;

// How many earlier messages go with each question, so follow-ups ("what
// about Tuesday?") make sense. Nothing was sent before, so every message was
// answered as if it were the first.
const HISTORY_LIMIT = 12;
// The conversation lives in sessionStorage: the bubble is rendered by
// Layout, which every page mounts separately, so navigating used to wipe it.
// Per user: with one shared key, a student signing in on the same tab after
// a staff member saw that staff conversation (and the data in it).
const STORE_KEY = 'blo.chat.v1';
const storeKey = (userId) => `${STORE_KEY}.${userId || 'anon'}`;
const STAFF = ['admin', 'scheduling_officer', 'program_manager'];

/* ─── Markdown ──────────────────────────────────────────────────────────── */

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Only web, in-app and mail links. A model-written [x](javascript:...) used
// to be rendered as a live link.
const safeHref = (url) => (/^(https?:\/\/|\/|#|mailto:)/i.test(url) ? url : null);

const inline = (raw) => {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const href = safeHref(url.replace(/&amp;/g, '&'));
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>` : text;
  });
  return s;
};

/**
 * Block-level markdown: paragraphs, headings, bullet and numbered lists, code
 * fences. The old renderer turned every newline into <br/> and emitted bare
 * <li> elements with no list around them, so lists rendered with stray gaps
 * and numbered lists didn't render at all.
 */
const renderMarkdown = (text) => {
  if (!text) return '';
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  let list = null; // { type: 'ul'|'ol', items: [], start }
  let code = null;

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br/>')}</p>`);
    para = [];
  };
  const flushList = () => {
    // Numbered lists keep the number the text used, so "1. ... (bullets) 2. ..."
    // reads 1, 2 instead of restarting at 1 after each run of bullets
    const start = list && list.type === 'ol' && list.start > 1 ? ` start="${list.start}"` : '';
    if (list) out.push(`<${list.type}${start}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (const line of lines) {
    if (code) {
      if (/^```/.test(line.trim())) {
        out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (/^```/.test(line.trim())) { flushPara(); flushList(); code = []; continue; }

    const h = line.match(/^(#{1,3})\s+(.+)$/);
    const ul = line.match(/^\s*[-*•]\s+(.+)$/);
    const ol = line.match(/^\s*(\d+)[.)]\s+(.+)$/);

    if (h) { flushPara(); flushList(); out.push(`<h4>${inline(h[2])}</h4>`); }
    else if (ul || ol) {
      flushPara();
      const type = ul ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [], start: ol ? parseInt(ol[1], 10) : 1 };
      list.items.push(ul ? ul[1] : ol[2]);
    } else if (!line.trim()) { flushPara(); flushList(); }
    else { flushList(); para.push(line); }
  }
  if (code) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  flushPara();
  flushList();
  return out.join('');
};

/* ─── Conversation helpers ──────────────────────────────────────────────── */

const greeting = (name, role) => ({
  id: 'greeting',
  role: 'assistant',
  content: STAFF.includes(role) || !role
    ? `Hi${name ? ` ${name}` : ''}! I'm **B-LO**, your scheduling assistant. Ask me about schedules, faculty, rooms or subjects - or pick a question below.`
    : `Hi${name ? ` ${name}` : ''}! I'm **B-LO**, your guide to the CoTE Timetabling System. Ask me what the system is for or how to do something in it.`,
  timestamp: Date.now(),
  greeting: true,
});

// Starter questions for the people who'll actually use them
const SUGGESTIONS = {
  manager: [
    'Which faculty are close to their maximum load?',
    'Who is best suited to teach CC 112?',
    'How does automatic schedule generation work?',
    'Which rooms are free on Monday morning?',
  ],
  faculty: [
    'What can I do in this system?',
    'How do I post materials to my class?',
    'Where do I see my teaching load?',
  ],
  // Help-desk questions only: B-LO has no access to records in this mode
  student: [
    'What is this system for?',
    'How do I join my section?',
    'Where can I see my weekly schedule?',
    'How do notifications work?',
  ],
};

const suggestionsFor = (role) => {
  if (role === 'faculty') return SUGGESTIONS.faculty;
  if (role === 'student') return SUGGESTIONS.student;
  return SUGGESTIONS.manager;
};

/**
 * Turn the visible conversation into the history the API expects. Gemini
 * requires history to start with a user turn, and errors / the greeting are
 * UI only, so those are dropped.
 */
const toHistory = (messages) => {
  const turns = messages.filter((m) => !m.greeting && !m.isError && m.content && !m.streaming);
  const recent = turns.slice(-HISTORY_LIMIT);
  while (recent.length && recent[0].role !== 'user') recent.shift();
  return recent.map(({ role, content }) => ({ role, content }));
};

const loadStored = (userId) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storeKey(userId)) || 'null');
    if (Array.isArray(saved) && saved.length) {
      // A reply that was mid-stream when the page changed can't resume
      return saved.map((m) => (m.streaming ? { ...m, streaming: false, content: m.content || '_(interrupted)_' } : m));
    }
  } catch {
    /* storage unavailable */
  }
  return null;
};

const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ─── Component ─────────────────────────────────────────────────────────── */

const AIChatBubble = () => {
  const { user } = useAuth();
  // 'closed' | 'opening' | 'open' | 'closing'
  const [phase, setPhase] = useState('closed');
  const [messages, setMessages] = useState(() => loadStored(user?._id) || [greeting(user?.firstName, user?.role)]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Refs/state for the bubble -> chat window morph and the flying robot head
  const fabRef = useRef(null);         // floating bubble button (fixed size)
  const flyHeadRef = useRef(null);     // flying layer 1: robot head without bubble
  const flyBubbleRef = useRef(null);   // flying layer 2: full bubble icon (fades in mid-flight when closing)
  const shellRef = useRef(null);       // the window that grows out of the bubble
  const innerRef = useRef(null);       // chat content (fixed final size, clipped by the shell)
  const headerIconRef = useRef(null);  // header icon slot (where the head lands)
  const flyerRef = useRef(null);       // the flying robot head
  const [flight, setFlight] = useState(null);

  const isMounted = phase !== 'closed';
  const fabVisible = phase === 'closed';

  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey(user?._id), JSON.stringify(messages.slice(-60)));
    } catch {
      /* storage unavailable */
    }
  }, [messages]);

  // Follow new text only while the reader is already at the bottom. It used
  // to scroll on every streamed chunk, yanking you away from anything you
  // were reading further up.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom, phase]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  const jumpToLatest = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setAtBottom(true);
  };

  useEffect(() => {
    if (phase === 'open' && inputRef.current) inputRef.current.focus();
  }, [phase]);

  // The text box grows with its content, up to a few lines
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [input, phase]);

  // Measure everything once the window is mounted (it is still at its final size here)
  const measure = () => {
    const fab = fabRef.current?.getBoundingClientRect();
    const head = headerIconRef.current?.getBoundingClientRect();
    const shell = shellRef.current?.getBoundingClientRect();
    if (!fab || !head || !shell) return null;
    return {
      fx: fab.left + fab.width / 2,
      fy: fab.top + fab.height / 2,
      fw: fab.width,
      fabW: fab.width,
      fabH: fab.height,
      tx: head.left + head.width / 2,
      ty: head.top + head.height / 2,
      tw: head.width,
      sw: shell.width,
      sh: shell.height,
    };
  };

  // OPEN: runs right after the window mounts, before the browser paints
  useLayoutEffect(() => {
    if (phase !== 'opening') return;
    const m = measure();
    if (!m) {
      setPhase('open');
      return;
    }
    setFlight({ dir: 'open', ...m });
  }, [phase]);

  // Runs the animations for both directions:
  //  - the bubble grows into the chat window (or shrinks back into the bubble)
  //  - the robot head flies header <-> bubble
  useLayoutEffect(() => {
    if (!flight || !flyerRef.current || !shellRef.current || !innerRef.current) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isOpen = flight.dir === 'open';
    const duration = reduce ? 1 : isOpen ? OPEN_MS : CLOSE_MS;
    const opts = { duration, easing: isOpen ? EASE : EASE_CLOSE, fill: 'forwards' };

    // 1) Window shell: bubble-sized circle <-> full chat window
    const small = {
      width: `${flight.fabW}px`,
      height: `${flight.fabH}px`,
      borderRadius: `${flight.fabH / 2}px`,
    };
    const full = {
      width: `${flight.sw}px`,
      height: `${flight.sh}px`,
      borderRadius: '18px',
    };
    const shellAnim = shellRef.current.animate(
      isOpen
        ? [
            { ...small, opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { ...full, opacity: 1 },
          ]
        : [
            { ...full, opacity: 1 },
            { ...small, opacity: 1, offset: 0.6 },
            { ...small, opacity: 0, offset: 0.75 }, // gone before the bubble pops back
            { ...small, opacity: 0 },
          ],
      opts
    );

    // 2) Chat content fades in after the window has started growing / fades out first when closing
    const innerAnim = innerRef.current.animate(
      isOpen
        ? [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0, offset: 0.25 }, { opacity: 0 }],
      { duration, easing: 'linear', fill: 'forwards' }
    );

    // 3) Robot head (no bubble) flying between the bubble and the header
    const dx = flight.fx - flight.tx;
    const dy = flight.fy - flight.ty;
    const scale = flight.fw / flight.tw;
    const atButton = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(-20deg)`;
    const atHeader = 'translate(0, 0) scale(1) rotate(0deg)';

    // Closing path: a curved arc that lands upright, exactly where the bubble icon is
    const midClose = `translate(${dx * 0.62}px, ${dy * 0.3}px) scale(${(1 + scale) / 2 + 0.1}) rotate(-14deg)`;
    const landClose = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`;

    const flyAnim = flyerRef.current.animate(
      isOpen
        ? [{ transform: atButton }, { transform: atHeader }]
        : [
            { transform: atHeader },
            { transform: midClose, offset: 0.5 },
            { transform: landClose, offset: 0.85 },
            { transform: landClose },
          ],
      opts
    );

    // 4) While flying back, the head slowly turns into the bubble icon (cross-fade),
    //    so it arrives as the bubble icon itself and the real button takes over seamlessly
    const morphAnims = [];
    if (!isOpen && flyHeadRef.current && flyBubbleRef.current) {
      const morphOpts = { duration, easing: 'ease-in-out', fill: 'forwards' };
      morphAnims.push(
        flyHeadRef.current.animate(
          [
            { opacity: 1 },
            { opacity: 1, offset: MORPH_START },
            { opacity: 0, offset: MORPH_END },
            { opacity: 0 },
          ],
          morphOpts
        ),
        flyBubbleRef.current.animate(
          [
            { opacity: 0 },
            { opacity: 0, offset: MORPH_START },
            { opacity: 1, offset: MORPH_END },
            { opacity: 1 },
          ],
          morphOpts
        )
      );
    }

    flyAnim.onfinish = () => {
      setPhase(isOpen ? 'open' : 'closed');
      setFlight(null);
    };

    return () => {
      shellAnim.cancel();
      innerAnim.cancel();
      flyAnim.cancel();
      morphAnims.forEach((m) => m.cancel());
    };
  }, [flight]);

  /* ── Sending ── */

  const ask = async (text, base) => {
    const question = text.trim();
    if (!question || loading) return;

    const history = toHistory(base);
    const userMessage = { id: `u${Date.now()}`, role: 'user', content: question, timestamp: Date.now() };
    const aiId = `a${Date.now()}`;
    setMessages([...base, userMessage, { id: aiId, role: 'assistant', content: '', timestamp: Date.now(), streaming: true }]);
    setLoading(true);
    setAtBottom(true);

    const patch = (fields) => setMessages((prev) => prev.map((m) => (m.id === aiId ? { ...m, ...fields } : m)));
    const controller = new AbortController();
    abortRef.current = controller;
    let fullText = '';

    try {
      const response = await fetch(`${API_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ message: question, conversationHistory: history }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired. Log in again.' : 'B-LO could not be reached.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      // Network reads don't line up with SSE events: a JSON line can arrive
      // in two pieces. Each read used to be parsed on its own and the broken
      // halves were silently dropped, losing words from the reply.
      let buffer = '';
      let serverError = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (data.type === 'chunk') {
            fullText += data.content;
            patch({ content: fullText });
          } else if (data.type === 'error') {
            // This used to be thrown inside the JSON try/catch and swallowed,
            // leaving the reply stuck "typing" forever.
            serverError = data.message || 'B-LO ran into a problem.';
          }
        }
      }

      if (serverError && !fullText) throw new Error(serverError);
      patch({ streaming: false, content: fullText || '_(No answer came back. Try rephrasing the question.)_' });
    } catch (error) {
      if (error.name === 'AbortError') {
        patch({ streaming: false, content: fullText ? `${fullText}\n\n_(stopped)_` : '_(stopped)_', stopped: true });
      } else {
        console.error('Chat error:', error);
        patch({
          streaming: false,
          isError: true,
          content: error.message || 'Something went wrong. Please try again.',
          retry: question,
        });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    ask(text, messages);
  };

  const stop = () => abortRef.current?.abort();

  const retry = (msg) => {
    // Drop the failed reply and the question before it, then ask again
    const idx = messages.findIndex((m) => m.id === msg.id);
    const base = messages.slice(0, Math.max(0, idx - 1));
    ask(msg.retry, base);
  };

  const copy = async (msg) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId((id) => (id === msg.id ? null : id)), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const newChat = () => {
    stop();
    setMessages([greeting(user?.firstName, user?.role)]);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChat = useCallback(() => {
    // Ignore clicks while an animation is running
    if (phase === 'opening' || phase === 'closing') return;

    if (phase === 'closed') {
      setPhase('opening');
      return;
    }

    // Closing: chat shrinks back into the bubble, head flies back to the bubble icon
    const m = measure();
    if (!m) {
      setPhase('closed');
      return;
    }
    setPhase('closing');
    setFlight({ dir: 'close', ...m });
  }, [phase]);

  // Escape closes the chat (unless a modal on top is handling it)
  useEffect(() => {
    if (phase !== 'open') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) toggleChat();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, toggleChat]);

  const onlyGreeting = messages.length === 1 && messages[0].greeting;

  return (
    <>
      {/* Chat window: grows out of the bubble and shrinks back into it */}
      {isMounted && (
        <div
          ref={shellRef}
          role="dialog"
          aria-label="B-LO assistant"
          className="fixed overflow-hidden bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700 z-[99999]"
          style={{ right: EDGE, bottom: EDGE, width: CHAT_W, height: CHAT_H, borderRadius: '18px' }}
        >
          {/* Content layer keeps its final size and is clipped by the shell, so nothing reflows mid-animation */}
          <div
            ref={innerRef}
            className="absolute bottom-0 right-0 flex flex-col"
            style={{ width: CHAT_W, height: CHAT_H }}
          >
            {/* Header */}
            <div className="relative flex flex-shrink-0 items-center justify-between overflow-hidden border-b border-gray-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-4 py-3 dark:border-gray-800 dark:from-blue-950/60 dark:via-gray-900 dark:to-indigo-950/60">
              <div className="relative z-10 flex items-center gap-2.5">
                <div
                  ref={headerIconRef}
                  className="relative h-10 w-10"
                  style={{ visibility: flight ? 'hidden' : 'visible' }}
                >
                  <AnimatedRobotHeadNoChatBubble className="h-10 w-10" />
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-400 dark:border-gray-900" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight text-gray-900 dark:text-white">B-LO</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {loading ? 'Thinking...' : 'Scheduling assistant · online'}
                  </p>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-1">
                <button
                  onClick={newChat}
                  disabled={onlyGreeting}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-blue-600 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                  title="New chat"
                  aria-label="Start a new chat"
                >
                  <MessageSquarePlus size={17} />
                </button>
                <button
                  onClick={toggleChat}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800"
                  title="Close (Esc)"
                  aria-label="Close chat"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="relative min-h-0 flex-1">
              <div
                ref={listRef}
                onScroll={onScroll}
                className="h-full space-y-4 overflow-y-auto bg-gray-50 px-4 py-4 dark:bg-gray-950/40"
                aria-live="polite"
              >
                {messages.map((message) => {
                  const mine = message.role === 'user';
                  return (
                    <div key={message.id} className={`blo-in group flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                      {!mine && (
                        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/50" aria-hidden="true">
                          <AnimatedRobotHeadNoChatBubble className="h-6 w-6" />
                        </span>
                      )}
                      <div className={`min-w-0 max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            mine
                              ? 'rounded-br-md bg-blue-600 text-white'
                              : message.isError
                              ? 'rounded-bl-md border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                              : 'rounded-bl-md border border-gray-200 bg-white text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                          }`}
                        >
                          {message.streaming && !message.content ? (
                            <span className="flex items-center gap-1 py-1" aria-label="B-LO is typing">
                              {[0, 150, 300].map((d) => (
                                <span key={d} className="blo-dot h-1.5 w-1.5 rounded-full bg-blue-500" style={{ animationDelay: `${d}ms` }} />
                              ))}
                            </span>
                          ) : mine ? (
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          ) : (
                            <div
                              className={`blo-md ${message.streaming ? 'blo-streaming' : ''}`}
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                            />
                          )}
                        </div>

                        {/* Meta row: time, and actions on B-LO's replies */}
                        {!message.streaming && (
                          <div className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-gray-400 ${mine ? 'justify-end' : ''}`}>
                            <span>{timeOf(message.timestamp)}</span>
                            {!mine && !message.greeting && !message.isError && (
                              <button
                                onClick={() => copy(message)}
                                className="flex items-center gap-1 rounded px-1 opacity-0 transition-opacity hover:text-blue-600 focus:opacity-100 group-hover:opacity-100"
                                aria-label="Copy answer"
                              >
                                {copiedId === message.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                              </button>
                            )}
                            {message.isError && message.retry && (
                              <button
                                onClick={() => retry(message)}
                                disabled={loading}
                                className="flex items-center gap-1 rounded px-1 font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                              >
                                <RotateCcw size={12} /> Retry
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Starter questions until the conversation begins */}
                {onlyGreeting && (
                  <div className="blo-in flex flex-col items-start gap-2 pl-9">
                    {suggestionsFor(user?.role).map((q) => (
                      <button
                        key={q}
                        onClick={() => ask(q, messages)}
                        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-left text-sm text-blue-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-blue-900 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950/50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!atBottom && (
                <button
                  onClick={jumpToLatest}
                  className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gray-900/85 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-gray-900 dark:bg-white/90 dark:text-gray-900"
                >
                  <ArrowDown size={13} /> {loading ? 'New reply' : 'Jump to latest'}
                </button>
              )}
            </div>

            {/* Composer */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-end gap-2 rounded-2xl border border-gray-300 bg-white px-3 py-1.5 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={loading ? 'B-LO is answering...' : 'Ask B-LO anything...'}
                  aria-label="Message B-LO"
                  className="max-h-[132px] flex-1 resize-none border-0 bg-transparent dark:bg-transparent py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 dark:text-white"
                />
                {loading ? (
                  <button
                    onClick={stop}
                    className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900"
                    title="Stop answering"
                    aria-label="Stop answering"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700"
                    title="Send (Enter)"
                    aria-label="Send message"
                  >
                    <Send size={15} />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-center text-[11px] text-gray-400">
                Enter to send · Shift + Enter for a new line · B-LO can make mistakes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Flying robot head (bubble <-> header) */}
      {flight && (
        <div
          ref={flyerRef}
          className="fixed pointer-events-none z-[100000]"
          style={{
            left: flight.tx - flight.tw / 2,
            top: flight.ty - flight.tw / 2,
            width: flight.tw,
            height: flight.tw,
          }}
        >
          {/* Layer 1: robot head */}
          <div ref={flyHeadRef} className="absolute inset-0">
            <AnimatedRobotHeadNoChatBubble className="w-full h-full drop-shadow-lg" />
          </div>
          {/* Layer 2: full bubble icon, same look as the floating button (hidden until closing morphs into it) */}
          <div ref={flyBubbleRef} className="absolute inset-0" style={{ opacity: 0 }}>
            <AnimatedRobotHead className="w-full h-full drop-shadow-lg" />
            <span
              className="absolute top-0 right-0 bg-green-400 rounded-full"
              style={{ width: '20%', height: '20%', border: '1px solid white' }}
            ></span>
          </div>
        </div>
      )}

      {/* Floating bubble button. The button itself never scales, so measurements stay exact. */}
      <button
        ref={fabRef}
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-20 h-20 rounded-full flex items-center justify-center z-[99998] group bg-transparent"
        style={{
          opacity: fabVisible ? 1 : 0,
          // fades out quickly when opening; on close it stays hidden until the flying icon lands on it
          transition: phase === 'opening' ? 'opacity 200ms' : 'none',
          pointerEvents: phase === 'closed' ? 'auto' : 'none',
        }}
        title="Ask B-LO"
        aria-label="Open the B-LO assistant"
      >
        <div className="relative transition-transform duration-300 group-hover:scale-110 group-active:scale-95 group-active:rotate-12">
          <AnimatedRobotHead className="w-20 h-20 drop-shadow-lg" />
          <span className="absolute top-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
        </div>
      </button>

      <style>{`
        @keyframes blo-dot { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        @keyframes blo-in  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes blo-caret { 50% { opacity: 0; } }
        .blo-dot { animation: blo-dot 1.3s ease-in-out infinite; }
        .blo-in  { animation: blo-in .22s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .blo-dot, .blo-in { animation: none; } }

        .blo-md { overflow-wrap: anywhere; }
        .blo-md > * + * { margin-top: .5rem; }
        .blo-md h4 { font-weight: 600; font-size: .95em; }
        .blo-md ul, .blo-md ol { padding-left: 1.15rem; }
        .blo-md ul { list-style: disc; }
        .blo-md ol { list-style: decimal; }
        .blo-md li + li { margin-top: .2rem; }
        .blo-md strong { font-weight: 600; }
        .blo-md em { font-style: italic; }
        .blo-md a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; }
        .dark .blo-md a { color: #93c5fd; }
        .blo-md code { background: rgba(100, 116, 139, .15); padding: .05rem .3rem; border-radius: .3rem; font-size: .85em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .blo-md pre { background: #0f172a; color: #e2e8f0; padding: .6rem .75rem; border-radius: .5rem; overflow-x: auto; font-size: .8em; }
        .blo-md pre code { background: none; padding: 0; }
        /* Blinking caret at the end of a reply that's still arriving */
        .blo-streaming > :last-child::after { content: ''; display: inline-block; width: 2px; height: 1em; margin-left: 2px; vertical-align: -2px; background: #2563eb; animation: blo-caret 1s steps(1) infinite; }
      `}</style>
    </>
  );
};

export default AIChatBubble;
