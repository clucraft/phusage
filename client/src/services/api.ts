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
    if (error.response?.status === 401 || error.response?.status === 403) {
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
};

export const usageApi = {
  getSummary: (month?: number, year?: number) =>
    api.get('/usage/summary', { params: { month, year } }),
  getTop10: (month?: number, year?: number) =>
    api.get('/usage/top10', { params: { month, year } }),
  searchUser: (email: string, month?: number, year?: number) =>
    api.get(`/usage/user/${encodeURIComponent(email)}`, { params: { month, year } }),
};

export const uploadApi = {
  uploadTeamsReport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/teams-report', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const ratesApi = {
  getRates: () => api.get('/rates'),
  saveRate: (callType: string, ratePerMinute: number, description?: string) =>
    api.post('/rates', { callType, ratePerMinute, description }),
  deleteRate: (callType: string) => api.delete(`/rates/${encodeURIComponent(callType)}`),
  bulkImport: (rates: Array<{ callType: string; ratePerMinute: number; description?: string }>) =>
    api.post('/rates/bulk', { rates }),
};

export const exportApi = {
  downloadCsv: (month?: number, year?: number) =>
    api.get('/export/csv', { params: { month, year }, responseType: 'blob' }),
  downloadPdf: (month?: number, year?: number) =>
    api.get('/export/pdf', { params: { month, year }, responseType: 'blob' }),
};

export default api;
