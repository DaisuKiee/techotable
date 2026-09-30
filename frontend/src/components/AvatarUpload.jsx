import React, { useState } from 'react';
import { userAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiCamera, FiTrash2, FiUpload } from 'react-icons/fi';

const AvatarUpload = ({ user, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null);

  const getAvatarUrl = () => {
    if (preview) return preview;
    if (user?.profilePicture) {
      return `${process.env.REACT_APP_API_URL?.replace('/api', '')}${user.profilePicture}`;
    }
    return null;
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return '??';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('Selected file:', file.name, file.type, file.size);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    console.log('Uploading to user ID:', user._id);

    try {
      const response = await userAPI.uploadAvatar(user._id, formData);
      console.log('Upload response:', response.data);
      toast.success('Avatar uploaded successfully');
      if (onUpdate) onUpdate(response.data.data);
      setPreview(null); // Clear preview after successful upload
    } catch (error) {
      console.error('Upload error:', error);
      console.error('Error response:', error.response);
      toast.error(error.response?.data?.message || 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete your avatar?')) return;

    setDeleting(true);
    try {
      const response = await userAPI.deleteAvatar(user._id);
      toast.success('Avatar deleted successfully');
      setPreview(null);
      if (onUpdate) onUpdate(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const avatarUrl = getAvatarUrl();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar Display */}
      <div className="relative group">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
              <span className="text-4xl font-bold text-white">{getInitials()}</span>
            </div>
          )}
        </div>

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <label
            htmlFor="avatar-upload"
            className="cursor-pointer text-white hover:text-gray-200 transition-colors"
          >
            <FiCamera className="w-8 h-8" />
          </label>
        </div>

        {/* Loading overlay */}
        {(uploading || deleting) && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        id="avatar-upload"
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading || deleting}
      />

      {/* Action Buttons */}
      <div className="flex gap-2">
        <label
          htmlFor="avatar-upload"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiUpload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Upload Photo'}
        </label>

        {user?.profilePicture && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <FiTrash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Remove'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AvatarUpload;
