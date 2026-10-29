import React, { useState } from 'react';
import { studentAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Upload, Users, Info } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';
import { FileDropzone, ImportResults } from './modal/ImportParts';

const BulkImportModal = ({ onClose, onComplete }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleFile = (selectedFile) => {
    if (selectedFile && selectedFile.type !== 'text/csv' && !selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    setFile(selectedFile);
    setResults(null);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await studentAPI.bulkImport(formData);
      setResults(response.data.data);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (results?.success?.length > 0) {
      onComplete();
    } else {
      onClose();
    }
  };

  // Closing with the X after a successful import used to skip onComplete,
  // so the list didn't show the new students until a reload.
  const close = results ? handleComplete : onClose;
  const titleId = useModalTitleId();

  return (
    <ModalShell onClose={close} size="lg" labelledBy={titleId} busy={loading}>
      <ModalHeader id={titleId} icon={Users} title="Bulk import students" subtitle="Add many students at once from a CSV file" onClose={close} closeDisabled={loading} />

      <ModalBody className="space-y-5">
        {results ? (
          <ImportResults
            idLabel="Student ID"
            results={{
              ...results,
              // Generated passwords are only shown here, once
              success: (results.success || []).map((r) => (r.tempPassword ? { ...r, name: `${r.name} · password: ${r.tempPassword}` } : r)),
            }}
          />
        ) : (
          <>
            <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <ul className="list-disc space-y-1 pl-4">
                <li>Start from the <strong>Template</strong> button on the Student Management page.</li>
                <li>Required columns: studentId, email, firstName, lastName, program.</li>
                <li>Optional <code className="rounded bg-white/70 px-1 dark:bg-black/30">sectionCode</code> (e.g. BSIT-1A-D) places the student in that section.</li>
                <li>Leave <code className="rounded bg-white/70 px-1 dark:bg-black/30">password</code> empty to generate one; it is shown after the import so you can share it.</li>
              </ul>
            </div>
            <FileDropzone file={file} onFile={handleFile} accept=".csv" hint="CSV files only" disabled={loading} />
          </>
        )}
      </ModalBody>

      <ModalFooter>
        {results ? (
          <>
            <ModalButton variant="secondary" onClick={() => { setResults(null); setFile(null); }}>Import another file</ModalButton>
            <ModalButton onClick={handleComplete}>Done</ModalButton>
          </>
        ) : (
          <>
            <ModalButton variant="secondary" onClick={onClose} disabled={loading}>Cancel</ModalButton>
            <ModalButton onClick={handleUpload} disabled={!file} loading={loading} loadingText="Importing..." icon={Upload}>
              Import students
            </ModalButton>
          </>
        )}
      </ModalFooter>
    </ModalShell>
  );
};

export default BulkImportModal;
