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
  getSummary: (month?: number, year?: number) =>
    api.get('/usage/summary', { params: { month, year } }),
  getTop10: (month?: number, year?: number) =>
    api.get('/usage/top10', { params: { month, year } }),
  searchUser: (email: string, month?: number, year?: number) =>
    api.get(`/usage/user/${encodeURIComponent(email)}`, { params: { month, year } }),
  getUserTrend: (email: string) =>
    api.get(`/usage/user/${encodeURIComponent(email)}/trend`),
  getMonthlyCosts: (year?: number) =>
    api.get('/usage/monthly-costs', { params: { year } }),
  getDashboardStats: (month?: number, year?: number) =>
    api.get('/usage/dashboard-stats', { params: { month, year } }),
  getTopDestinations: (month?: number, year?: number, limit?: number) =>
    api.get('/usage/top-destinations', { params: { month, year, limit } }),
  getLocations: (month?: number, year?: number) =>
    api.get('/usage/locations', { params: { month, year } }),
};

export const uploadApi = {
  uploadTeamsReport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/teams-report', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadVerizonRates: (file: File, clearExisting: boolean = true) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clearExisting', String(clearExisting));
    return api.post('/upload/verizon-rates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  clearCallRecords: () => api.delete('/upload/call-records'),
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
  downloadCsv: (month?: number, year?: number) =>
    api.get('/export/csv', { params: { month, year }, responseType: 'blob' }),
  downloadPdf: (month?: number, year?: number) =>
    api.get('/export/pdf', { params: { month, year }, responseType: 'blob' }),
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
