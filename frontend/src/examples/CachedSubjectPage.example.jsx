import { useState } from 'react';
import Layout from '../components/Layout';
import { subjectAPI } from '../services/api';
import toast from 'react-hot-toast';
import useCachedData from '../hooks/useCachedData';
import { useCache } from '../context/CacheContext';
import SubjectModal from '../components/SubjectModal';

/**
 * EXAMPLE: SubjectPage with Smart Caching
 * 
 * This demonstrates how to implement client-side caching
 * that loads instantly from cache and refreshes in background
 */
const CachedSubjectPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const { invalidateCache } = useCache();

  // Use the smart caching hook
  const { 
    data: subjects, 
    loading, 
    error, 
    refetch,
    isFromCache 
  } = useCachedData(
    // API function to call
    () => subjectAPI.getAll(),
    
    // Unique cache key
    'subjects-list',
    
    // Options
    {
      cacheDuration: 5 * 60 * 1000, // Cache for 5 minutes
      enabled: true,
      onSuccess: (data) => {
        console.log('Subjects loaded:', data?.length);
      },
      onError: (err) => {
        toast.error('Failed to load subjects');
      }
    }
  );

  const handleCreateSubject = () => {
    setSelectedSubject(null);
    setShowModal(true);
  };

  const handleEditSubject = (subject) => {
    setSelectedSubject(subject);
    setShowModal(true);
  };

  const handleModalClose = (shouldRefresh) => {
    setShowModal(false);
    setSelectedSubject(null);
    
    if (shouldRefresh) {
      // Invalidate cache and refetch
      invalidateCache('subjects-list');
      refetch();
      toast.success('Subjects updated');
    }
  };

  const handleDeleteSubject = async (id) => {
    try {
      await subjectAPI.delete(id);
      
      // Invalidate cache and refetch
      invalidateCache('subjects-list');
      refetch();
      
      toast.success('Subject deleted');
    } catch (err) {
      toast.error('Failed to delete subject');
    }
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header with cache indicator */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Subjects</h1>
            {isFromCache && (
              <p className="text-sm text-gray-500">
                ⚡ Loaded from cache (refreshing in background...)
              </p>
            )}
          </div>
          
          <button
            onClick={handleCreateSubject}
            className="btn btn-primary"
          >
            Add Subject
          </button>
        </div>

        {/* Loading state (only shows when no cache) */}
        {loading && !isFromCache && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading subjects...</p>
          </div>
        )}

        {/* Error state */}
        {error && !subjects && (
          <div className="text-center py-12">
            <p className="text-red-600">Failed to load subjects</p>
            <button onClick={refetch} className="btn btn-secondary mt-4">
              Retry
            </button>
          </div>
        )}

        {/* Subjects list */}
        {subjects && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map(subject => (
              <div 
                key={subject._id}
                className="bg-white p-4 rounded-lg shadow"
              >
                <h3 className="font-bold">{subject.subjectCode}</h3>
                <p className="text-gray-600">{subject.subjectName}</p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEditSubject(subject)}
                    className="btn btn-sm btn-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSubject(subject._id)}
                    className="btn btn-sm btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <SubjectModal
            mode={selectedSubject ? 'edit' : 'create'}
            subject={selectedSubject}
            onClose={handleModalClose}
          />
        )}
      </div>
    </Layout>
  );
};

export default CachedSubjectPage;
