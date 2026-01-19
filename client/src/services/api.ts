import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),
  getRegistrationStatus: () =>
    api.get('/auth/registration-status'),
};

export const usageApi = {
  getSummary: (month?: number, year?: number, carrierId?: number) =>
    api.get('/usage/summary', { params: { month, year, carrierId } }),
  getTop10: (month?: number, year?: number, carrierId?: number) =>
    api.get('/usage/top10', { params: { month, year, carrierId } }),
  searchUser: (email: string, startDate?: string, endDate?: string, carrierId?: number) =>
    api.get(`/usage/user/${encodeURIComponent(email)}`, { params: { startDate, endDate, carrierId } }),
  getUserTrend: (email: string, startDate?: string, endDate?: string, carrierId?: number) =>
    api.get(`/usage/user/${encodeURIComponent(email)}/trend`, { params: { startDate, endDate, carrierId } }),
  getMonthlyCosts: (year?: number, carrierId?: number) =>
    api.get('/usage/monthly-costs', { params: { year, carrierId } }),
  getDashboardStats: (month?: number, year?: number, carrierId?: number) =>
    api.get('/usage/dashboard-stats', { params: { month, year, carrierId } }),
  getTopDestinations: (month?: number, year?: number, limit?: number, carrierId?: number) =>
    api.get('/usage/top-destinations', { params: { month, year, limit, carrierId } }),
  getLocations: (month?: number, year?: number, carrierId?: number) =>
    api.get('/usage/locations', { params: { month, year, carrierId } }),
};

export interface UploadProgress {
  id: string;
  status: 'parsing' | 'processing' | 'complete' | 'error';
  total: number;
  processed: number;
  skipped: number;
  error?: string;
  result?: {
    recordsProcessed: number;
    recordsSkipped: number;
  };
}

export const uploadApi = {
  uploadTeamsReport: (file: File, carrierId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('carrierId', String(carrierId));
    return api.post<{ jobId: string }>('/upload/teams-report', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  connectToProgress: (jobId: string, onProgress: (progress: UploadProgress) => void, onError: (error: string) => void) => {
    const token = localStorage.getItem('token');
    const eventSource = new EventSource(`/api/upload/progress/${jobId}?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data) as UploadProgress;
        onProgress(progress);
        if (progress.status === 'complete' || progress.status === 'error') {
          eventSource.close();
        }
      } catch (e) {
        console.error('Failed to parse progress:', e);
      }
    };

    eventSource.onerror = () => {
      onError('Connection lost');
      eventSource.close();
    };

    return eventSource;
  },
  uploadVerizonRates: (file: File, carrierName: string, clearExisting: boolean = true) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('carrierName', carrierName);
    formData.append('clearExisting', String(clearExisting));
    return api.post('/upload/verizon-rates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  clearCallRecords: () => api.delete('/upload/call-records'),
  getHistory: (fileType?: string) =>
    api.get('/upload/history', { params: { fileType } }),
  deleteHistoryEntry: (id: number) =>
    api.delete(`/upload/history/${id}`),
};

export const ratesApi = {
  getRates: (params?: { originCountry?: string; destCountry?: string; originSearch?: string; destSearch?: string; page?: number; limit?: number }) =>
    api.get('/rates', { params }),
  getOrigins: () => api.get('/rates/origins'),
  getDestinations: (originCountry?: string) =>
    api.get('/rates/destinations', { params: { originCountry } }),
  getStats: () => api.get('/rates/stats'),
  lookupRate: (originCountry: string, destCountry: string, callType?: string) =>
    api.get('/rates/lookup', { params: { originCountry, destCountry, callType } }),
  saveRate: (originCountry: string, destination: string, pricePerMinute: number, callType?: string) =>
    api.post('/rates', { originCountry, destination, pricePerMinute, callType }),
  deleteRate: (id: number) => api.delete(`/rates/${id}`),
  clearAllRates: () => api.delete('/rates'),
};

export const exportApi = {
  downloadCsv: (month?: number, year?: number, carrierId?: number) =>
    api.get('/export/csv', { params: { month, year, carrierId }, responseType: 'blob' }),
  downloadPdf: (month?: number, year?: number, carrierId?: number) =>
    api.get('/export/pdf', { params: { month, year, carrierId }, responseType: 'blob' }),
};

export const carrierApi = {
  getAll: () => api.get('/carriers'),
  getWithRates: () => api.get('/carriers/with-rates'),
};

export const estimatorApi = {
  getTemplates: (year?: number) =>
    api.get('/estimator/templates', { params: { year } }),
  getYears: () => api.get('/estimator/years'),
  getTemplateData: (country: string, year?: number) =>
    api.get(`/estimator/template/${encodeURIComponent(country)}`, { params: { year } }),
  getDestinations: () => api.get('/estimator/destinations'),
  getOrigins: () => api.get('/estimator/origins'),
  calculate: (data: {
    originCountry: string;
    userCount: number;
    callsPerUserPerMonth: number;
    avgMinutesPerCall: number;
    destinations: Array<{ country: string; percentage: number }>;
  }) => api.post('/estimator/calculate', data),
};

export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  createUser: (email: string, password: string, name: string, role: string) =>
    api.post('/admin/users', { email, password, name, role }),
  updateUserRole: (id: number, role: string) =>
    api.patch(`/admin/users/${id}/role`, { role }),
  resetUserPassword: (id: number, password: string) =>
    api.patch(`/admin/users/${id}/password`, { password }),
  deleteUser: (id: number) =>
    api.delete(`/admin/users/${id}`),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (settings: { allowRegistration?: boolean }) =>
    api.patch('/admin/settings', settings),
};

export default api;
