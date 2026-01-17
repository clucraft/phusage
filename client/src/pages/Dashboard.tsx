import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usageApi, exportApi } from '../services/api';

interface UserUsage {
  userName: string;
  userEmail: string;
  totalMinutes: number;
  totalCalls?: number;
  totalCost: number;
}

export default function Dashboard() {
  const [top10, setTop10] = useState<UserUsage[]>([]);
  const [summary, setSummary] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [top10Res, summaryRes] = await Promise.all([
        usageApi.getTop10(month, year),
        usageApi.getSummary(month, year),
      ]);
      setTop10(top10Res.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (format: 'csv' | 'pdf') => {
    try {
      const response = format === 'csv'
        ? await exportApi.downloadCsv(month, year)
        : await exportApi.downloadPdf(month, year);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `usage-report-${year}-${month}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const totalCost = summary.reduce((sum, u) => sum + u.totalCost, 0);
  const totalMinutes = summary.reduce((sum, u) => sum + u.totalMinutes, 0);
  const totalUsers = summary.length;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => downloadReport('csv')}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => downloadReport('pdf')}
            className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Cost</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Minutes</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{totalMinutes.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{totalUsers}</p>
        </div>
      </div>

      {/* Top 10 Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Users by Cost</h2>
        {loading ? (
          <div className="h-80 flex items-center justify-center text-gray-500">Loading...</div>
        ) : top10.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500">
            No data available. Upload a Teams report to get started.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top10} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `$${value}`} />
              <YAxis type="category" dataKey="userName" width={100} />
              <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']} />
              <Bar dataKey="totalCost" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Usage Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Minutes</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summary.sort((a, b) => b.totalCost - a.totalCost).map((user, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.userName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.userEmail}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{user.totalMinutes.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{user.totalCalls?.toLocaleString() || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${user.totalCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
