import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 60000, // Increased to 60 seconds for Render free tier spin-up
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
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/signup', '/auth/faculty-signup',
  '/auth/forgot-password', '/auth/reset-password', '/auth/verify-email', '/auth/resend-verification'];

const STATUS_MESSAGES = {
  0: 'Cannot reach the server. Check your connection and try again.',
  408: 'The server took too long to respond. Please try again.',
  413: 'That upload is too large.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again.',
  502: 'The server is restarting or unavailable. Please try again in a moment.',
  503: 'The server is temporarily unavailable. Please try again in a moment.',
  504: 'The server took too long to respond. Please try again.',
};

/**
 * The one message to show for a failed request. Pages read
 * error.response.data.message, so every failure - including a dead server,
 * a timeout or an HTML error page from a proxy - is given one.
 */
export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  const data = error?.response?.data;
  if (data && typeof data === 'object' && data.message) return data.message;
  return error?.userMessage || fallback;
};

let sessionExpiredHandled = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Cancelled on purpose (AbortController) - nothing to report
    if (axios.isCancel(error)) return Promise.reject(error);

    const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';

    if (!error.response) {
      // No response at all: offline, server down, CORS, or timeout. Give it a
      // response-shaped body so `error.response?.data?.message` works everywhere.
      error.isNetworkError = !timedOut;
      error.userMessage = timedOut ? STATUS_MESSAGES[408] : STATUS_MESSAGES[0];
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        error.userMessage = 'You are offline. Reconnect and try again.';
      }
      error.response = {
        status: 0,
        data: { success: false, code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', message: error.userMessage },
        headers: {},
        config: error.config,
      };
      return Promise.reject(error);
    }

    const { status } = error.response;

    // Proxies and crashes can answer with HTML or an empty body
    if (!error.response.data || typeof error.response.data !== 'object' || !error.response.data.message) {
      const base = error.response.data && typeof error.response.data === 'object' ? error.response.data : {};
      error.response.data = {
        ...base,
        success: false,
        message: STATUS_MESSAGES[status] || (status >= 500 ? STATUS_MESSAGES[500] : `Request failed (${status}).`),
      };
    }
    error.userMessage = error.response.data.message;
    error.requestId = error.response.data.requestId || error.response.headers?.['x-request-id'];

    if (status >= 500) {
      console.error(`API ${status} on ${error.config?.method?.toUpperCase()} ${error.config?.url}`
        + (error.requestId ? ` (request ${error.requestId})` : ''), error.response.data);
    }

    if (status === 401) {
      // Wrong password etc. on the auth pages is handled by the page itself.
      // Anywhere else a 401 means the saved session is no longer valid.
      const url = error.config?.url || '';
      const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => url.includes(p));

      if (!isAuthEndpoint && localStorage.getItem('token') && !sessionExpiredHandled) {
        sessionExpiredHandled = true;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        try {
          sessionStorage.setItem('authNotice', error.response.data.code === 'TOKEN_EXPIRED' || /expired/i.test(error.response.data.message)
            ? 'Your session has expired. Please sign in again.'
            : 'Please sign in again to continue.');
        } catch (_) { /* storage blocked */ }
        window.location.href = '/login';
      }
    } else if (status === 403) {
      // Let individual pages handle 403s; keep details for the access-denied page
      console.warn('403 Forbidden:', {
        url: error.config?.url,
        method: error.config?.method,
        message: error.response.data.message
      });
      try {
        sessionStorage.setItem('lastAccessDeniedDetails', JSON.stringify({
          url: error.config?.url,
          resourceType: error.response.data.resource?.type || null,
          resourceProgram: error.response.data.resource?.program || null,
          userProgram: error.response.data.userProgram || null,
          message: error.response.data.message
        }));
      } catch (_) { /* storage blocked */ }
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
  resetPassword: (token, data) => api.post(`/auth/reset-password/${token}`, data),
  createFacultyInvite: (hours) => api.post('/auth/faculty-invite', { hours }),
  checkFacultyInvite: (token) => api.get(`/auth/faculty-invite/${encodeURIComponent(token)}`),
  acceptTerms: (version) => api.post('/auth/accept-terms', { version })
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
  getMyProfile: () => api.get('/students/profile'), // Get current student's profile
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
  updateLoad: (id, data) => api.put(`/faculty/${id}/load`, data),
  getBackgroundSummary: (id) => api.get(`/faculty/${id}/background-summary`),
  analyzeSubjectCompatibility: (id, data) => api.post(`/faculty/${id}/analyze-subject-compatibility`, data)
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
  getByQualification: (qualification) => api.get(`/subjects/qualification/${qualification}`),
  generateCode: () => api.post('/subjects/generate-code'),
  regenerateSubjectCode: (id) => api.put(`/subjects/${id}/regenerate-code`)
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
  checkORToolsStatus: () => api.get('/schedules/ortools-status'),
  getConflicts: (summary = false) => api.get(`/schedules/conflicts${summary ? '?summary=true' : ''}`)
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
  leave: (id) => api.post(`/classSpaces/${id}/leave`),
  
  // Self-enrollment with class code (for irregular students)
  enrollByCode: (classCode) => api.post('/classSpaces/enroll-by-code', { classCode }),
  unenroll: (id) => api.delete(`/classSpaces/${id}/unenroll`)
};

/** Absolute URL for an uploaded material. */
export const resolveUploadUrl = (fileUrl) => {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  // API_URL ends with /api; uploads are served from the server root.
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  return `${apiUrl.replace(/\/api\/?$/, '')}${fileUrl}`;
};

// ============== SECTION ENDPOINTS ==============
export const sectionAPI = {
  getAll: (params) => api.get('/sections', { params }),
  getAllLightweight: () => api.get('/sections', { params: { lightweight: 'true' } }), // Fast, minimal data
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


// ============== NOTIFICATION ENDPOINTS ==============
export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  delete: (id) => api.delete(`/notifications/${id}`),
  clearRead: () => api.delete('/notifications/read'),
};


// ============== DASHBOARD ENDPOINTS ==============
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats')
};
