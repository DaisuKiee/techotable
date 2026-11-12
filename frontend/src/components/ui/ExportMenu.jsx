import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

/**
 * The Export button on My Schedule, for students and faculty alike.
 *
 * Both choices produce the same campus form: one opens it ready to print or
 * save as PDF, the other downloads it as a workbook that can still be edited.
 * Kept here so the two pages can never drift apart.
 */
export function ExportMenu({ onPrint, onExcel, label = 'Export', title = 'Export my schedule on the CTU form' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (run) => () => { setOpen(false); run(); };

  const items = [
    { key: 'print', Icon: FileText, label: 'Printable form (PDF)', hint: 'Opens a print view', run: onPrint },
    { key: 'excel', Icon: FileSpreadsheet, label: 'Excel workbook (.xlsx)', hint: 'Downloads an editable file', run: onExcel },
  ];

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-20"
        >
          {items.map(({ key, Icon, label: text, hint, run }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={choose(run)}
              className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                <span className="block">{text}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
