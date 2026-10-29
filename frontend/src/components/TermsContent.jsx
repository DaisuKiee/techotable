import React from 'react';
import TERMS from '../content/terms';

const Paragraphs = ({ items }) => (items || []).map((p) => (
  <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{p}</p>
));

const Bullets = ({ items }) => (items?.length ? (
  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 marker:text-gray-400 dark:text-gray-300">
    {items.map((li) => <li key={li.slice(0, 40)}>{li}</li>)}
  </ul>
) : null);

/** The Terms of Use and Privacy Notice, shared by the login gate and /terms. */
const TermsContent = ({ compact = false }) => (
  <div className="space-y-6">
    {!compact && (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {TERMS.system} · {TERMS.owner} · Last updated {TERMS.updated}
      </p>
    )}
    {TERMS.sections.map((s) => (
      <section key={s.id} id={s.id} className="space-y-2 scroll-mt-24">
        <h3 className="font-semibold text-gray-900 dark:text-white">{s.title}</h3>
        <Paragraphs items={s.body} />
        <Bullets items={s.list} />
        {(s.subsections || []).map((sub) => (
          <div key={sub.title} className="space-y-1.5 pt-1">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{sub.title}</h4>
            <Paragraphs items={sub.body} />
            <Bullets items={sub.list} />
          </div>
        ))}
      </section>
    ))}
  </div>
);

export default TermsContent;
