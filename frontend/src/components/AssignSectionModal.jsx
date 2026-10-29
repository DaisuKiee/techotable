import React, { useState } from 'react';
import { Users, BookOpen } from 'lucide-react';
import { studentAPI } from '../services/api';
import toast from 'react-hot-toast';
import { usePrograms } from '../hooks/usePrograms';
import AnimatedCheckIcon from './AnimatedCheckIcon';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';

const AssignSectionModal = ({ student, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    program: student.program || '',
    yearLevel: '',
    sectionLetter: '',
    studentType: student.studentType || 'regular'
  });
  const [loading, setLoading] = useState(false);

  const { programCodes: programs } = usePrograms();
  const yearLevels = [1, 2, 3, 4];
  const sectionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  // The code follows from the three choices, so it's shown as soon as they're
  // made. There used to be a separate "Generate Section Code" step that had to
  // be pressed (and pressed again after any change) before Assign unlocked.
  const { program, yearLevel, sectionLetter } = formData;
  const sectionCode = program && yearLevel && sectionLetter ? `${program}-${yearLevel}${sectionLetter}` : '';
  const unchanged = sectionCode && sectionCode === student.sectionCode && formData.studentType === (student.studentType || 'regular');

  const handleAssign = async () => {
    if (!sectionCode) return;

    try {
      setLoading(true);
      await studentAPI.assignSectionCode(student._id, {
        sectionCode,
        studentType: formData.studentType
      });

      toast.success(`Assigned to ${sectionCode}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Assign section error:', error);
      toast.error(error.response?.data?.message || 'Failed to assign section code');
    } finally {
      setLoading(false);
    }
  };

  const titleId = useModalTitleId();
  const selectClass = 'w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm';
  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });

  return (
    <ModalShell onClose={onClose} size="sm" labelledBy={titleId} busy={loading}>
      <ModalHeader
        id={titleId}
        icon={Users}
        title="Assign section"
        subtitle={`${student.user?.firstName || ''} ${student.user?.lastName || ''} · ${student.studentId}`}
        onClose={onClose}
        closeDisabled={loading}
      />

      <ModalBody className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm dark:bg-gray-700/50">
          <span className="text-gray-600 dark:text-gray-400">Current section</span>
          <span className={`font-semibold ${student.sectionCode ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400'}`}>
            {student.sectionCode || 'None'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Program</label>
            <select value={program} onChange={set('program')} className={selectClass}>
              <option value="">Select program</option>
              {programs.map(prog => (
                <option key={prog} value={prog}>{prog}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Year level</label>
            <select value={yearLevel} onChange={set('yearLevel')} className={selectClass}>
              <option value="">Year</option>
              {yearLevels.map(year => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Section</label>
            <select value={sectionLetter} onChange={set('sectionLetter')} className={selectClass}>
              <option value="">Letter</option>
              {sectionLetters.map(letter => (
                <option key={letter} value={letter}>Section {letter}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Student type</label>
            <select value={formData.studentType} onChange={set('studentType')} className={selectClass}>
              <option value="regular">Regular</option>
              <option value="irregular">Irregular</option>
            </select>
          </div>
        </div>

        {/* Live result */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${
            sectionCode
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
              : 'border-dashed border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
          }`}
          aria-live="polite"
        >
          {sectionCode ? (
            <AnimatedCheckIcon key={sectionCode} className="h-6 w-6 flex-shrink-0" color="#16a34a" />
          ) : (
            <BookOpen className="h-6 w-6 flex-shrink-0 text-gray-400" />
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Section code</p>
            <p className={`text-lg font-bold ${sectionCode ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-400'}`}>
              {sectionCode || 'Choose program, year and section'}
            </p>
          </div>
        </div>
      </ModalBody>

      <ModalFooter info={unchanged ? 'This is already their section.' : null}>
        <ModalButton variant="secondary" onClick={onClose} disabled={loading}>Cancel</ModalButton>
        <ModalButton onClick={handleAssign} loading={loading} loadingText="Assigning…" disabled={!sectionCode || unchanged}>
          Assign {sectionCode || 'section'}
        </ModalButton>
      </ModalFooter>
    </ModalShell>
  );
};

export default AssignSectionModal;
