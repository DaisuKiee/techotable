import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, X, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Pieces shared by the CSV and Excel import modals: a drop zone that also
 * works as a click-to-browse button, and the success / failure report.
 * Both modals used a bare <input type="file"> next to an Upload button.
 */

const formatSize = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export const FileDropzone = ({ file, onFile, accept, hint, disabled }) => {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const pick = (list) => {
    const f = list?.[0];
    if (f) onFile(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300">
          <FileSpreadsheet className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{file.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatSize(file.size)} · ready to import</p>
        </div>
        <button
          type="button"
          onClick={() => onFile(null)}
          disabled={disabled}
          aria-label="Remove file"
          className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        over
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700/50'
      }`}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform ${over ? 'scale-110 bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'}`}>
        <UploadCloud className="h-6 w-6" />
      </span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">
        {over ? 'Drop to add the file' : 'Drag a file here, or click to browse'}
      </span>
      {hint && <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        data-modal-ignore-dirty
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }}
      />
    </button>
  );
};

const ResultTable = ({ rows, idLabel, lastLabel, lastKey, tone }) => (
  <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table className="min-w-full text-sm">
      <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-semibold">Row</th>
          <th className="px-3 py-2 text-left font-semibold">{idLabel}</th>
          <th className="px-3 py-2 text-left font-semibold">{lastLabel}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map((item) => (
          <tr key={item.row} className="bg-white dark:bg-gray-800">
            <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{item.row}</td>
            <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{item.studentId || item.employeeId || item.subjectCode}</td>
            <td className={`px-3 py-2 ${tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{item[lastKey]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Summary tiles plus the imported / failed rows. Failures are shown first. */
export const ImportResults = ({ results, idLabel }) => {
  const ok = results?.success || [];
  const failed = results?.failed || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" /> Imported
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{ok.length}</p>
        </div>
        <div className={`rounded-xl border p-4 ${failed.length ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40'}`}>
          <p className={`flex items-center gap-1.5 text-sm font-medium ${failed.length ? 'text-red-800 dark:text-red-200' : 'text-gray-500 dark:text-gray-400'}`}>
            <XCircle className="h-4 w-4" /> Failed
          </p>
          <p className={`mt-1 text-2xl font-bold ${failed.length ? 'text-red-900 dark:text-red-100' : 'text-gray-400'}`}>{failed.length}</p>
        </div>
      </div>

      {/* Failures first: they're what needs acting on */}
      {failed.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Rows that need fixing</p>
          <ResultTable rows={failed} idLabel={idLabel} lastLabel="Problem" lastKey="error" tone="error" />
        </div>
      )}
      {ok.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Imported</p>
          <ResultTable rows={ok} idLabel={idLabel} lastLabel="Name" lastKey="name" />
        </div>
      )}
    </div>
  );
};
