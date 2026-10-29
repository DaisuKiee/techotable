import React, { useState } from 'react';
import { classSpaceAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Upload, FolderUp } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';
import { FileDropzone } from './modal/ImportParts';

const UploadMaterialModal = ({ classSpaceId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  // The picker filtered by type but drag-and-drop accepted anything
  const ACCEPT = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const validateAndSetFile = (file) => {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    if (!ACCEPT.includes(ext)) {
      toast.error(`That file type isn't supported. Use ${ACCEPT.join(', ')}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);

    // Auto-fill title if empty
    if (!formData.title) {
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      setFormData(prev => ({ ...prev, title: fileName }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('file', selectedFile);
      formDataToSend.append('title', formData.title);
      if (formData.description) {
        formDataToSend.append('description', formData.description);
      }

      await classSpaceAPI.uploadMaterial(classSpaceId, formDataToSend);
      toast.success('Material uploaded successfully');
      onClose(true);
    } catch (error) {
      console.error('Upload material error:', error);
      const message = error.response?.data?.message || 'Upload failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const titleId = useModalTitleId();

  return (
    <ModalShell onClose={() => onClose(false)} size="md" labelledBy={titleId} busy={loading}>
      <ModalHeader
        id={titleId}
        icon={FolderUp}
        tone="emerald"
        title="Upload material"
        subtitle="Students in this class space can download it"
        onClose={() => onClose(false)}
        closeDisabled={loading}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          <FileDropzone
            file={selectedFile}
            onFile={validateAndSetFile}
            accept={ACCEPT.join(',')}
            hint="PDF, Word, PowerPoint, Excel or ZIP - up to 10 MB"
            disabled={loading}
          />

          <div>
            <label htmlFor="mat-title" className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Title</span>
              {selectedFile && <span className="text-xs font-normal text-gray-400">Filled in from the file name</span>}
            </label>
            <input
              id="mat-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={200}
              placeholder="e.g. Lecture 5 - Data Structures"
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="mat-desc" className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Description <span className="font-normal text-gray-400">(optional)</span></span>
            </label>
            <textarea
              id="mat-desc"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="What is it, and when should students use it?"
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white resize-y"
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <ModalButton variant="secondary" onClick={() => onClose(false)} disabled={loading}>Cancel</ModalButton>
          <ModalButton type="submit" variant="success" loading={loading} loadingText="Uploading..." disabled={!selectedFile || !formData.title.trim()} icon={Upload}>
            Upload material
          </ModalButton>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};

export default UploadMaterialModal;
