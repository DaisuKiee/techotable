import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Users, LogIn, Wand2, Move, Clock, GraduationCap,
  MessageSquare, FileSpreadsheet, ShieldCheck, HelpCircle, Search, Info, AlertTriangle,
} from 'lucide-react';
import PublicShell from '../components/public/PublicShell';
import usePageMeta from '../hooks/usePageMeta';
import { DOCS } from '../content/docs';

/*
 * Public documentation. One page rather than a tree of them: there is not
 * enough here to justify making someone navigate, and a single page can be
 * searched with the browser, printed, and read straight through.
 */

const ICONS = {
  BookOpen, Users, LogIn, Wand2, Move, Clock,
  GraduationCap, MessageSquare, FileSpreadsheet, ShieldCheck, HelpCircle,
};

/** Renders **bold** runs without pulling in a markdown dependency. */
const RichText = ({ text }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    )}
  </>
);

const NOTE_TONE = {
  info: { wrap: 'border-blue-500/30 bg-blue-500/10', icon: 'text-blue-400', Icon: Info },
  warn: { wrap: 'border-orange-500/30 bg-orange-500/10', icon: 'text-orange-400', Icon: AlertTriangle },
};

const Block = ({ block }) => {
  switch (block.type) {
    case 'p':
      return (
        <p className="leading-relaxed text-gray-300">
          <RichText text={block.text} />
        </p>
      );

    case 'list':
      return (
        <ul className="space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-gray-300">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400/70" />
              <span><RichText text={item} /></span>
            </li>
          ))}
        </ul>
      );

    case 'steps':
      return (
        <ol className="space-y-3">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3.5 leading-relaxed text-gray-300">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-blue-950">
                {i + 1}
              </span>
              <span className="pt-0.5"><RichText text={item} /></span>
            </li>
          ))}
        </ol>
      );

    case 'note': {
      const tone = NOTE_TONE[block.tone] ?? NOTE_TONE.info;
      const { Icon } = tone;
      return (
        <div className={`flex gap-3 rounded-xl border p-4 ${tone.wrap}`}>
          <Icon className={`h-5 w-5 flex-shrink-0 ${tone.icon}`} aria-hidden="true" />
          <p className="text-sm leading-relaxed text-gray-200">
            <RichText text={block.text} />
          </p>
        </div>
      );
    }

    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white/5">
                {block.head.map((cell) => (
                  <th key={cell} className="px-4 py-3 font-semibold text-white">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-white/10">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-4 py-3 align-top ${j === 0 ? 'font-medium text-white' : 'text-gray-300'}`}
                    >
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
};

/** Every word in a section, so the search box can match body text too. */
const sectionText = (section) =>
  [
    section.title,
    ...section.blocks.flatMap((b) => {
      if (b.type === 'p' || b.type === 'note') return [b.text];
      if (b.type === 'list' || b.type === 'steps') return b.items;
      if (b.type === 'table') return [...b.head, ...b.rows.flat()];
      return [];
    }),
  ]
    .join(' ')
    .toLowerCase();

const DocsPage = () => {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(DOCS[0]?.id);
  const contentRef = useRef(null);

  usePageMeta({
    title: 'Documentation',
    description:
      'How the CTU Daanbantayan Smart Timetabling System works: roles and permissions, how timetables are generated, the drag-and-drop builder, shifts, class spaces, imports and exports.',
    path: '/docs',
  });

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOCS;
    return DOCS.filter((section) => sectionText(section).includes(q));
  }, [query]);

  // Highlights the contents entry for whichever section is in view. Rebuilt
  // when the visible set changes, since searching removes sections entirely.
  useEffect(() => {
    const nodes = sections
      .map((section) => document.getElementById(section.id))
      .filter(Boolean);
    if (nodes.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <PublicShell
      eyebrow="Documentation"
      title="How it works"
      lead="What the system does, who can do what, and how a timetable goes from an empty week to something students can read."
    >
      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        {/* Contents */}
        <aside className="mb-10 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <label className="relative mb-5 block">
              <span className="sr-only">Search the documentation</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:border-yellow-400/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
              />
            </label>

            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">On this page</p>
            <nav aria-label="Table of contents">
              <ul className="space-y-0.5 border-l border-white/10">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={activeId === section.id ? 'true' : undefined}
                      className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors ${
                        activeId === section.id
                          ? 'border-yellow-400 font-medium text-yellow-300'
                          : 'border-transparent text-gray-400 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Sections */}
        <div ref={contentRef} className="min-w-0">
          {sections.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center text-gray-400">
              Nothing matches “{query}”. Try a different word.
            </p>
          ) : (
            <div className="space-y-14">
              {sections.map((section) => {
                const Icon = ICONS[section.icon] ?? BookOpen;
                return (
                  <section key={section.id} id={section.id} className="scroll-mt-24">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400 ring-1 ring-inset ring-yellow-400/20">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h2 className="text-2xl font-bold tracking-tight text-white">{section.title}</h2>
                    </div>
                    <div className="space-y-5">
                      {section.blocks.map((block, i) => (
                        <Block key={i} block={block} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          <p className="mt-16 border-t border-white/10 pt-8 text-sm text-gray-500">
            Want to know when something changed? See the{' '}
            <a href="/updates" className="font-medium text-yellow-400 underline-offset-4 hover:underline">
              release notes
            </a>
            .
          </p>
        </div>
      </div>
    </PublicShell>
  );
};

export default DocsPage;
