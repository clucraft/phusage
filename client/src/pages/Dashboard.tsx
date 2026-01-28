import { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import { usageApi, exportApi, carrierApi } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from '../hooks/useCurrency';

interface Carrier {
  id: number;
  name: string;
}

interface UserUsage {
  userName: string;
  userEmail: string;
  totalMinutes: number;
  totalCalls?: number;
  totalCost: number;
}

interface MonthlyCost {
  month: number;
  monthName: string;
  cost: number;
  calls: number;
}

interface DashboardStats {
  totalCost: number;
  totalCalls: number;
  totalMinutes: number;
  uniqueUsers: number;
  avgCostPerUser: number;
  avgCostPerCall: number;
}

interface TopDestination {
  country: string;
  calls: number;
  cost: number;
  minutes: number;
}

type DatePreset = 'previousYear' | 'previousMonth' | 'thisMonth' | 'thisYear' | 'last30Days' | 'last90Days' | 'custom';

// Helper to format date as YYYY-MM-DD
const formatDateForApi = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Get date range for a preset
const getPresetDateRange = (preset: DatePreset): { start: Date; end: Date } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'previousYear': {
      const lastYear = now.getFullYear() - 1;
      return {
        start: new Date(lastYear, 0, 1),
        end: new Date(lastYear, 11, 31),
      };
    }
    case 'previousMonth': {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: prevMonth,
        end: lastDayPrevMonth,
      };
    }
    case 'thisMonth': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: firstOfMonth,
        end: today,
      };
    }
    case 'thisYear': {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      return {
        start: firstOfYear,
        end: today,
      };
    }
    case 'last30Days': {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        start: thirtyDaysAgo,
        end: today,
      };
    }
    case 'last90Days': {
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return {
        start: ninetyDaysAgo,
        end: today,
      };
    }
    case 'custom':
    default:
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: today,
      };
  }
};

const presetLabels: Record<DatePreset, string> = {
  previousYear: 'Previous Year',
  previousMonth: 'Previous Month',
  thisMonth: 'This Month',
  thisYear: 'This Year',
  last30Days: 'Last 30 Days',
  last90Days: 'Last 90 Days',
  custom: 'Custom Range',
};

export default function Dashboard() {
  const [top10, setTop10] = useState<UserUsage[]>([]);
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCost[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topDestinations, setTopDestinations] = useState<TopDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  // Date range state
  const [preset, setPreset] = useState<DatePreset>(() => {
    return (sessionStorage.getItem('dashboard_preset') as DatePreset) || 'thisMonth';
  });
  const [startDate, setStartDate] = useState<Date>(() => {
    const saved = sessionStorage.getItem('dashboard_startDate');
    if (saved) return new Date(saved);
    return getPresetDateRange('thisMonth').start;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const saved = sessionStorage.getItem('dashboard_endDate');
    if (saved) return new Date(saved);
    return getPresetDateRange('thisMonth').end;
  });
  const [carrierId, setCarrierId] = useState<number | undefined>(() => {
    const saved = sessionStorage.getItem('dashboard_carrierId');
    return saved ? parseInt(saved, 10) : undefined;
  });

  // Year for the monthly chart (derived from endDate or current year)
  const chartYear = endDate.getFullYear();

  const { theme } = useTheme();
  const { formatCurrency, convertAmount, currency } = useCurrency();

  // Load carriers on mount
  useEffect(() => {
    const loadCarriers = async () => {
      try {
        const response = await carrierApi.getAll();
        setCarriers(response.data);
      } catch (error) {
        console.error('Failed to load carriers:', error);
      }
    };
    loadCarriers();
  }, []);

  // Persist filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('dashboard_preset', preset);
  }, [preset]);

  useEffect(() => {
    sessionStorage.setItem('dashboard_startDate', startDate.toISOString());
  }, [startDate]);

  useEffect(() => {
    sessionStorage.setItem('dashboard_endDate', endDate.toISOString());
  }, [endDate]);

  useEffect(() => {
    if (carrierId !== undefined) {
      sessionStorage.setItem('dashboard_carrierId', String(carrierId));
    } else {
      sessionStorage.removeItem('dashboard_carrierId');
    }
  }, [carrierId]);

  // Handle preset change
  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const { start, end } = getPresetDateRange(newPreset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // Handle manual date changes (switches to custom)
  const handleStartDateChange = (date: Date | null) => {
    if (date) {
      setStartDate(date);
      setPreset('custom');
    }
  };

  const handleEndDateChange = (date: Date | null) => {
    if (date) {
      setEndDate(date);
      setPreset('custom');
    }
  };

  // Convert monthly costs for chart
  const convertedMonthlyCosts = useMemo(() => {
    return monthlyCosts.map(m => ({
      ...m,
      cost: convertAmount(m.cost),
    }));
  }, [monthlyCosts, convertAmount]);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, carrierId]);

  useEffect(() => {
    fetchYearlyData();
  }, [chartYear, carrierId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: formatDateForApi(startDate),
        endDate: formatDateForApi(endDate),
        carrierId,
      };
      const [top10Res, statsRes, destRes] = await Promise.all([
        usageApi.getTop10(params),
        usageApi.getDashboardStats(params),
        usageApi.getTopDestinations({ ...params, limit: 5 }),
      ]);
      setTop10(top10Res.data);
      setStats(statsRes.data);
      setTopDestinations(destRes.data.combined);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlyData = async () => {
    try {
      const monthlyRes = await usageApi.getMonthlyCosts(chartYear, carrierId);
      setMonthlyCosts(monthlyRes.data);
    } catch (error) {
      console.error('Failed to fetch monthly costs:', error);
    }
  };

  const downloadReport = async (format: 'csv' | 'pdf') => {
    try {
      // For export, use month/year from the current date range for file naming
      const month = endDate.getMonth() + 1;
      const year = endDate.getFullYear();
      const response = format === 'csv'
        ? await exportApi.downloadCsv(month, year, carrierId)
        : await exportApi.downloadPdf(month, year, carrierId);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const dateStr = `${formatDateForApi(startDate)}_to_${formatDateForApi(endDate)}`;
      link.setAttribute('download', `usage-report-${dateStr}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const chartColors = {
    bar: theme === 'dark' ? '#818cf8' : '#4f46e5',
    text: theme === 'dark' ? '#9ca3af' : '#6b7280',
    grid: theme === 'dark' ? '#374151' : '#e5e7eb',
    areaStroke: theme === 'dark' ? '#a78bfa' : '#7c3aed',
    areaFill: theme === 'dark' ? 'url(#colorCostDark)' : 'url(#colorCost)',
  };

  // Find max cost for progress bar calculation
  const maxCost = topDestinations.length > 0 ? Math.max(...topDestinations.map(d => d.cost)) : 0;

  // Format date range for display
  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          {carriers.length > 0 && (
            <select
              value={carrierId || ''}
              onChange={(e) => setCarrierId(e.target.value ? Number(e.target.value) : undefined)}
              className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Carriers</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          {/* Date Range Preset Dropdown */}
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {Object.entries(presetLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Date Pickers */}
          <div className="flex items-center gap-2">
            <DatePicker
              selected={startDate}
              onChange={handleStartDateChange}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              maxDate={endDate}
              dateFormat="MMM d, yyyy"
              className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-32"
            />
            <span className="text-gray-500 dark:text-gray-400">to</span>
            <DatePicker
              selected={endDate}
              onChange={handleEndDateChange}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              maxDate={new Date()}
              dateFormat="MMM d, yyyy"
              className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-32"
            />
          </div>

          <button
            onClick={() => downloadReport('csv')}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => downloadReport('pdf')}
            className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Date Range Display */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Showing data from <span className="font-medium text-gray-700 dark:text-gray-300">{formatDateDisplay(startDate)}</span> to <span className="font-medium text-gray-700 dark:text-gray-300">{formatDateDisplay(endDate)}</span>
      </div>

      {/* Summary Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Cost</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.totalCost || 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Calls</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {stats?.totalCalls.toLocaleString() || '0'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Minutes</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {stats?.totalMinutes.toLocaleString() || '0'}
          </p>
        </div>
      </div>

      {/* Summary Cards - Row 2 (Averages) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Users with Calls</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {stats?.uniqueUsers || '0'}
          </p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-indigo-100">Avg Cost per User</h3>
          <p className="mt-2 text-3xl font-bold text-white">
            {formatCurrency(stats?.avgCostPerUser || 0)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-violet-100">Avg Cost per Call</h3>
          <p className="mt-2 text-3xl font-bold text-white">
            {formatCurrency(stats?.avgCostPerCall || 0)}
          </p>
        </div>
      </div>

      {/* Monthly Costs Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {chartYear} Monthly Costs Overview
        </h2>
        {convertedMonthlyCosts.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-gray-500 dark:text-gray-400">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={convertedMonthlyCosts} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="colorCostDark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
              <XAxis
                dataKey="monthName"
                stroke={chartColors.text}
                tick={{ fill: chartColors.text, fontSize: 12 }}
                axisLine={{ stroke: chartColors.grid }}
              />
              <YAxis
                tickFormatter={(value) => `${currency === 'CHF' ? 'CHF ' : '$'}${value}`}
                stroke={chartColors.text}
                tick={{ fill: chartColors.text, fontSize: 12 }}
                axisLine={{ stroke: chartColors.grid }}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Cost']}
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                  borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelStyle={{ color: theme === 'dark' ? '#f3f4f6' : '#111827', fontWeight: 600 }}
                itemStyle={{ color: theme === 'dark' ? '#c4b5fd' : '#7c3aed' }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke={chartColors.areaStroke}
                strokeWidth={3}
                fill={chartColors.areaFill}
                dot={{ fill: chartColors.areaStroke, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: chartColors.areaStroke, strokeWidth: 2, fill: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Destinations Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top 5 Destinations</h2>
        </div>
        {topDestinations.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No destination data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-48">
                    Cost Distribution
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {topDestinations.map((dest, i) => (
                  <tr key={dest.country} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${
                          i === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          i === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200' :
                          i === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{dest.country}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {dest.calls.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                      {formatCurrency(dest.cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${maxCost > 0 ? (dest.cost / maxCost) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top 10 Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top 10 Users by Cost</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : top10.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No data available. Upload a Teams report to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Minutes
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-48">
                    Cost Distribution
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {top10.map((user, i) => (
                  <tr key={user.userEmail} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 ${
                          i === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          i === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200' :
                          i === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {i + 1}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{user.userName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.userEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {user.totalCalls?.toLocaleString() || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {user.totalMinutes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                      {formatCurrency(user.totalCost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${top10[0]?.totalCost > 0 ? (user.totalCost / top10[0].totalCost) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
