import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    } else if (error.response?.status === 403) {
      // Forbidden - log the error but don't redirect
      // Let individual pages handle 403 errors as needed
      console.warn('403 Forbidden:', {
        url: error.config?.url,
        method: error.config?.method,
        message: error.response?.data?.message || 'Access denied'
      });
      
      // Store error details in session storage for debugging
      const errorDetails = {
        url: error.config?.url,
        resourceType: error.response?.data?.resource?.type || null,
        resourceProgram: error.response?.data?.resource?.program || null,
        userProgram: error.response?.data?.userProgram || null,
        message: error.response?.data?.message || 'Access denied'
      };
      sessionStorage.setItem('lastAccessDeniedDetails', JSON.stringify(errorDetails));
      
      // DON'T automatically redirect - let the page handle it
      // Automatic redirects cause problems when pages make multiple API calls
    }
    return Promise.reject(error);
  }
);

// ============== AUTH ENDPOINTS ==============
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  getSettings: () => api.get('/auth/settings'),
  updateSettings: (data) => api.put('/auth/settings', data),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (token, data) => api.post(`/auth/reset-password/${token}`, data)
};

// ============== USER ENDPOINTS ==============
export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getByRole: (role) => api.get(`/users/role/${role}`),
  changePassword: (id, data) => api.put(`/users/${id}/password`, data),
  uploadAvatar: (id, formData) => api.post(`/users/${id}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteAvatar: (id) => api.delete(`/users/${id}/avatar`)
};

// ============== STUDENT ENDPOINTS ==============
export const studentAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  getStats: () => api.get('/students/stats'),
  bulkImport: (formData) => api.post('/students/bulk-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  assignSectionCode: (id, data) => api.put(`/students/${id}/assign-section`, data)
};

// ============== ACTIVITY LOG ENDPOINTS ==============
export const activityLogAPI = {
  getAll: (params) => api.get('/activity-logs', { params }),
  getStats: (params) => api.get('/activity-logs/stats', { params }),
  getUserSummary: (userId) => api.get(`/activity-logs/user/${userId}`),
  cleanup: (data) => api.delete('/activity-logs/cleanup', { data })
};

// ============== FACULTY ENDPOINTS ==============
export const facultyAPI = {
  getAll: (params) => api.get('/faculty', { params }),
  getById: (id) => api.get(`/faculty/${id}`),
  create: (data) => api.post('/faculty', data),
  update: (id, data) => api.put(`/faculty/${id}`, data),
  delete: (id) => api.delete(`/faculty/${id}`),
  addQualification: (id, data) => api.post(`/faculty/${id}/qualifications`, data),
  addTeachingHistory: (id, data) => api.post(`/faculty/${id}/teaching-history`, data),
  getWorkload: (id) => api.get(`/faculty/${id}/workload`),
  getBySpecialization: (specialization) => api.get(`/faculty/specialization/${specialization}`),
  getAvailable: (params) => api.get('/faculty/available', { params }),
  updateLoad: (id, data) => api.put(`/faculty/${id}/load`, data)
};

// ============== SUBJECT ENDPOINTS ==============
export const subjectAPI = {
  getAll: (params) => api.get('/subjects', { params }),
  getById: (id) => api.get(`/subjects/${id}`),
  create: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`),
  getByProgramAndYear: (program, year) => api.get(`/subjects/program/${program}/year/${year}`),
  getStats: () => api.get('/subjects/stats'),
  bulkImport: (data) => api.post('/subjects/bulk-import', data),
  getByQualification: (qualification) => api.get(`/subjects/qualification/${qualification}`)
};

// ============== ROOM ENDPOINTS ==============
export const roomAPI = {
  getAll: (params) => api.get('/rooms', { params }),
  getById: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  getByType: (type) => api.get(`/rooms/type/${type}`),
  getAvailable: (params) => api.get('/rooms/available', { params }),
  getStats: () => api.get('/rooms/stats')
};

// ============== PROGRAM ENDPOINTS ==============
export const programAPI = {
  getAll: (params) => api.get('/programs', { params }),
  getById: (id) => api.get(`/programs/${id}`),
  create: (data) => api.post('/programs', data),
  update: (id, data) => api.put(`/programs/${id}`, data),
  delete: (id) => api.delete(`/programs/${id}`)
};

/**
 * Client timeout for a solver-backed request: the solver's own budget plus
 * headroom for data loading, the Python process and JSON transfer.
 */
const solverTimeout = (data) => {
  const limit = Number(data?.timeLimit) || 60;
  return (limit + 45) * 1000;
};

// ============== SCHEDULE ENDPOINTS ==============
export const scheduleAPI = {
  getAll: (params) => api.get('/schedules', { params }),
  getById: (id) => api.get(`/schedules/${id}`),
  create: (data) => api.post('/schedules', data),
  // Validates the whole batch and writes all-or-nothing, so a partial failure
  // can't leave some rows saved while the client still holds them as pending.
  bulkCreate: (schedules) => api.post('/schedules/bulk', { schedules }),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id) => api.delete(`/schedules/${id}`),
  batchDelete: (ids) => api.post('/schedules/batch-delete', { ids }),
  getByProgramAndYear: (program, year, params) => 
    api.get(`/schedules/program/${program}/year/${year}`, { params }),
  getFacultySchedule: (facultyId, params) => 
    api.get(`/schedules/faculty/${facultyId}`, { params }),
  checkConflicts: (data) => api.post('/schedules/check-conflicts', data),
  publish: (data) => api.post('/schedules/publish', data),
  // Schedule generation runs a constraint solver server-side for up to
  // `timeLimit` seconds, so the client has to wait longer than the 30s default
  // or the request is aborted before the solver can possibly answer
  // ("timeout of 30000ms exceeded" with the default 60s limit).
  generate: (data) => api.post('/schedules/generate', data, { timeout: solverTimeout(data) }),
  preview: (data) => api.post('/schedules/preview', data, { timeout: solverTimeout(data) }),
  savePreview: (data) => api.post('/schedules/save-preview', data),
  checkORToolsStatus: () => api.get('/schedules/ortools-status')
};

// ============== AI ENDPOINTS ==============
export const aiAPI = {
  recommendInstructor: (data) => api.post('/ai/recommend-instructor', data),
  recommendCurriculum: (data) => api.post('/ai/recommend-curriculum', data),
  analyzeWorkload: (data) => api.post('/ai/analyze-workload', data),
  predictScheduleQuality: (data) => api.post('/ai/predict-schedule-quality', data),
  getInsights: (params) => api.get('/ai/insights', { params })
};

// ============== AI CHAT ENDPOINTS ==============
export const aiChatAPI = {
  sendMessage: (data) => api.post('/ai/chat', data),
  getRecommendation: (data) => api.post('/ai/recommend', data),
  recommendFaculty: (data) => api.post('/ai/recommend-faculty', data),
  getStats: () => api.get('/ai/stats'),
  getQuickHelp: () => api.get('/ai/help')
};

// ============== IMPORT ENDPOINTS ==============
export const importAPI = {
  importData: (type, formData) => api.post(`/import/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  downloadTemplate: (type) => api.get(`/import/template/${type}`, {
    responseType: 'blob'
  })
};

// ============== CLASS SPACE ENDPOINTS ==============
export const classSpaceAPI = {
  getAll: (params) => api.get('/classSpaces', { params }),
  getById: (id) => api.get(`/classSpaces/${id}`),
  getMyClasses: () => api.get('/classSpaces/my-classes'),
  create: (data) => api.post('/classSpaces', data),
  update: (id, data) => api.put(`/classSpaces/${id}`, data),
  delete: (id) => api.delete(`/classSpaces/${id}`),
  regenerateClassCode: (id) => api.put(`/classSpaces/${id}/regenerate-code`),

  // Announcements
  postAnnouncement: (id, data) => api.post(`/classSpaces/${id}/announcements`, data),
  updateAnnouncement: (id, announcementId, data) =>
    api.put(`/classSpaces/${id}/announcements/${announcementId}`, data),
  deleteAnnouncement: (id, announcementId) =>
    api.delete(`/classSpaces/${id}/announcements/${announcementId}`),

  // Materials
  uploadMaterial: (id, formData) =>
    api.post(`/classSpaces/${id}/materials`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  deleteMaterial: (id, materialId) =>
    api.delete(`/classSpaces/${id}/materials/${materialId}`),

  // Enrollment.
  // Regular students pass a SECTION enrollment code; irregular students pass a
  // SUBJECT class code. The backend routes on the student's studentType.
  join: (code) => api.post('/classSpaces/join', { code }),
  leave: (id) => api.post(`/classSpaces/${id}/leave`)
};

/** Absolute URL for an uploaded material. */
export const resolveUploadUrl = (fileUrl) => {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  // API_URL ends with /api; uploads are served from the server root.
  return `${API_URL.replace(/\/api\/?$/, '')}${fileUrl}`;
};

// ============== SECTION ENDPOINTS ==============
export const sectionAPI = {
  getAll: (params) => api.get('/sections', { params }),
  getById: (id) => api.get(`/sections/${id}`),
  create: (data) => api.post('/sections', data),
  update: (id, data) => api.put(`/sections/${id}`, data),
  delete: (id) => api.delete(`/sections/${id}`),
  getByProgramAndYear: (program, year, params) => 
    api.get(`/sections/program/${program}/year/${year}`, { params }),
  getStats: () => api.get('/sections/stats'),
  regenerateEnrollmentCode: (id) => api.put(`/sections/${id}/regenerate-code`)
};

export default api;
