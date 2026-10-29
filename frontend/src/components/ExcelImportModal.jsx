import React, { useState } from 'react';
import { importAPI, getErrorMessage } from '../services/api';
import toast from 'react-hot-toast';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';
import { FileDropzone, ImportResults } from './modal/ImportParts';

// Numbered step (module scope so React doesn't remount its children each render)
const Step = ({ n, title, children }) => (
  <li className="flex gap-3">
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{n}</span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
      {children}
    </div>
  </li>
);

const ExcelImportModal = ({ type = 'students', onClose, onComplete }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const typeConfig = {
    students: {
      title: 'Import Students from Excel',
      endpoint: 'students',
      templateType: 'students',
      instructions: [
        'Download the Excel template using the button below',
        'Fill in student data: studentId, email, firstName, lastName, program, yearLevel, section',
        'Required columns: studentId, email, firstName, lastName, program',
        'Default password is "student123" if not specified',
        'Upload the completed Excel file (.xlsx or .xls)'
      ]
    },
    faculty: {
      title: 'Import Faculty from Excel',
      endpoint: 'faculty',
      templateType: 'faculty',
      instructions: [
        'Download the Excel template using the button below',
        'Fill in faculty data: employeeId, email, firstName, lastName, department, position',
        'Required columns: employeeId, email, firstName, lastName',
        'Default password is "faculty123" if not specified',
        'Specializations should be comma-separated (e.g., "Programming, Database")',
        'Upload the completed Excel file (.xlsx or .xls)'
      ]
    },
    subjects: {
      title: 'Import Subjects from Excel',
      endpoint: 'subjects',
      templateType: 'subjects',
      instructions: [
        'Download the Excel template using the button below',
        'Fill in subject data: subjectCode, subjectName, program, yearLevel, semester',
        'Required columns: subjectCode, subjectName, program, yearLevel',
        'Required qualifications should be comma-separated',
        'Upload the completed Excel file (.xlsx or .xls)'
      ]
    }
  };

  const config = typeConfig[type];

  const handleFile = (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];
    if (!validTypes.includes(selectedFile.type) && !/\.xlsx?$/i.test(selectedFile.name)) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }
    setFile(selectedFile);
    setResults(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await importAPI.downloadTemplate(config.templateType);
      
      // Create blob and download
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${config.templateType}_template.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to download template'));
      console.error('Download error:', error);
    }
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
      const response = await importAPI.importData(config.endpoint, formData);
      setResults(response.data.data);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Import failed');
      console.error('Import error:', error);
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

  // Same fix as the CSV import: closing after a successful import must
  // refresh the list, not just close.
  const close = results ? handleComplete : onClose;
  const titleId = useModalTitleId();
  const idLabel = type === 'students' ? 'Student ID' : type === 'faculty' ? 'Employee ID' : 'Subject Code';
  // "Download the template" and "Upload the file" are the steps' own controls now
  const notes = config.instructions.filter((line) => !/template/i.test(line) && !/^Upload the completed/i.test(line));

  return (
    <ModalShell onClose={close} size="lg" labelledBy={titleId} busy={loading}>
      <ModalHeader id={titleId} icon={FileSpreadsheet} tone="emerald" title={config.title} subtitle="Fill in the template, then upload it here" onClose={close} closeDisabled={loading} />

      <ModalBody className="space-y-5">
        {results ? (
          <ImportResults results={results} idLabel={idLabel} />
        ) : (
          <ol className="space-y-4">
            <Step n={1} title="Get the template">
              <button type="button" onClick={handleDownloadTemplate} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-gray-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20">
                <Download className="h-4 w-4" /> Download Excel template
              </button>
            </Step>
            <Step n={2} title="Fill it in">
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-gray-600 dark:text-gray-300">
                {notes.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </Step>
            <Step n={3} title="Upload it">
              <div className="mt-2">
                <FileDropzone file={file} onFile={handleFile} accept=".xlsx,.xls" hint="Excel files (.xlsx or .xls)" disabled={loading} />
              </div>
            </Step>
          </ol>
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
            <ModalButton variant="success" onClick={handleUpload} disabled={!file} loading={loading} loadingText="Importing..." icon={Upload}>
              Import
            </ModalButton>
          </>
        )}
      </ModalFooter>
    </ModalShell>
  );
};

export default ExcelImportModal;
