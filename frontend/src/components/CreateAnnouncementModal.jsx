import React, { useState, useEffect } from 'react';
import { classSpaceAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Bell, Pin, Send } from 'lucide-react';
import { ModalShell, ModalHeader, ModalBody, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';

const CreateAnnouncementModal = ({ classSpaceId, announcement, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isPinned: false
  });

  const isEdit = !!announcement;

  useEffect(() => {
    if (announcement) {
      setFormData({
        title: announcement.title || '',
        content: announcement.content || '',
        isPinned: announcement.isPinned || false
      });
    }
  }, [announcement]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await classSpaceAPI.updateAnnouncement(classSpaceId, announcement._id, formData);
        toast.success('Announcement updated successfully');
      } else {
        await classSpaceAPI.postAnnouncement(classSpaceId, formData);
        toast.success('Announcement posted successfully');
      }
      onClose(true);
    } catch (error) {
      console.error('Submit announcement error:', error);
      const message = error.response?.data?.message || 'Operation failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const titleId = useModalTitleId();
  const canSubmit = formData.title.trim() && formData.content.trim();

  return (
    <ModalShell onClose={() => onClose(false)} size="md" labelledBy={titleId} busy={loading}>
      <ModalHeader
        id={titleId}
        icon={Bell}
        title={isEdit ? 'Edit announcement' : 'New announcement'}
        subtitle="Everyone in this class space will see it"
        onClose={() => onClose(false)}
        closeDisabled={loading}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          <div>
            <label htmlFor="ann-title" className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Title</span>
              <span className="text-xs font-normal text-gray-400">{formData.title.length}/200</span>
            </label>
            <input
              id="ann-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={200}
              placeholder="e.g. Quiz moved to Friday"
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="ann-content" className="mb-1.5 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>Message</span>
              <span className="text-xs font-normal text-gray-400">{formData.content.length} characters</span>
            </label>
            <textarea
              id="ann-content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows={7}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
              placeholder="Write your announcement here..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white resize-y"
            />
          </div>

          {/* Pin as a switch: one clear control instead of a checkbox inside a grey box */}
          <label htmlFor="isPinned" className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <span className="flex items-start gap-3">
              <Pin className="mt-0.5 h-4 w-4 text-amber-500" />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">Pin to top</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">Stays above newer posts until unpinned</span>
              </span>
            </span>
            <input
              type="checkbox"
              id="isPinned"
              name="isPinned"
              checked={formData.isPinned}
              onChange={handleChange}
              className="peer sr-only"
            />
            <span className="relative h-6 w-11 flex-shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-amber-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400 dark:bg-gray-600" aria-hidden="true" />
          </label>
        </ModalBody>

        <ModalFooter info={<span className="hidden sm:inline">Ctrl + Enter to post</span>}>
          <ModalButton variant="secondary" onClick={() => onClose(false)} disabled={loading}>Cancel</ModalButton>
          <ModalButton type="submit" loading={loading} loadingText="Saving..." disabled={!canSubmit} icon={Send}>
            {isEdit ? 'Save changes' : 'Post announcement'}
          </ModalButton>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};

export default CreateAnnouncementModal;
