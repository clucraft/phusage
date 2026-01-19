import { useState, useMemo, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { usageApi, carrierApi } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from 'recharts';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from '../hooks/useCurrency';

interface Carrier {
  id: number;
  name: string;
}

interface UserCall {
  date: string;
  duration: number;
  type: string;
  sourceNumber: string;
  destination: string;
  originCountry: string | null;
  destCountry: string | null;
  rate: number;
  cost: number;
}

interface UserData {
  userName: string;
  userEmail: string;
  totalMinutes: number;
  totalCalls: number;
  totalCost: number;
  calls: UserCall[];
}

interface TrendMonth {
  month: number;
  year: number;
  monthName: string;
  label: string;
  cost: number;
  calls: number;
  minutes: number;
}

interface TrendData {
  monthlyTrend: TrendMonth[];
  rangeTotal: {
    startDate: string;
    endDate: string;
    totalCost: number;
    totalCalls: number;
    totalMinutes: number;
  };
}

type SortField = 'date' | 'duration' | 'cost' | 'destination' | 'destCountry';
type SortDirection = 'asc' | 'desc';
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

export default function UserSearch() {
  const [searchTerm, setSearchTerm] = useState(() => {
    return sessionStorage.getItem('usersearch_term') || '';
  });
  const [preset, setPreset] = useState<DatePreset>(() => {
    return (sessionStorage.getItem('usersearch_preset') as DatePreset) || 'thisMonth';
  });
  const [startDate, setStartDate] = useState<Date>(() => {
    const saved = sessionStorage.getItem('usersearch_startDate');
    if (saved) return new Date(saved);
    return getPresetDateRange('thisMonth').start;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const saved = sessionStorage.getItem('usersearch_endDate');
    if (saved) return new Date(saved);
    return getPresetDateRange('thisMonth').end;
  });
  const [carrierId, setCarrierId] = useState<number | undefined>(() => {
    const saved = sessionStorage.getItem('usersearch_carrierId');
    return saved ? parseInt(saved, 10) : undefined;
  });
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [userData, setUserData] = useState<UserData | null>(() => {
    const saved = sessionStorage.getItem('usersearch_userData');
    return saved ? JSON.parse(saved) : null;
  });
  const [trendData, setTrendData] = useState<TrendData | null>(() => {
    const saved = sessionStorage.getItem('usersearch_trendData');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
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

  // Persist filters and results to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('usersearch_term', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    sessionStorage.setItem('usersearch_preset', preset);
  }, [preset]);

  useEffect(() => {
    sessionStorage.setItem('usersearch_startDate', startDate.toISOString());
  }, [startDate]);

  useEffect(() => {
    sessionStorage.setItem('usersearch_endDate', endDate.toISOString());
  }, [endDate]);

  useEffect(() => {
    if (carrierId !== undefined) {
      sessionStorage.setItem('usersearch_carrierId', String(carrierId));
    } else {
      sessionStorage.removeItem('usersearch_carrierId');
    }
  }, [carrierId]);

  useEffect(() => {
    if (userData) {
      sessionStorage.setItem('usersearch_userData', JSON.stringify(userData));
    } else {
      sessionStorage.removeItem('usersearch_userData');
    }
  }, [userData]);

  useEffect(() => {
    if (trendData) {
      sessionStorage.setItem('usersearch_trendData', JSON.stringify(trendData));
    } else {
      sessionStorage.removeItem('usersearch_trendData');
    }
  }, [trendData]);

  // Handle preset change
  const handlePresetChange = (newPreset: DatePreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const range = getPresetDateRange(newPreset);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  // When dates are manually changed, switch to custom
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError('');
    setUserData(null);
    setTrendData(null);

    try {
      const startStr = formatDateForApi(startDate);
      const endStr = formatDateForApi(endDate);

      const [userResponse, trendResponse] = await Promise.all([
        usageApi.searchUser(searchTerm, startStr, endStr, carrierId),
        usageApi.getUserTrend(searchTerm, startStr, endStr, carrierId),
      ]);
      setUserData(userResponse.data);
      setTrendData(trendResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'User not found');
    } finally {
      setLoading(false);
    }
  };

  // Sort calls
  const sortedCalls = useMemo(() => {
    if (!userData) return [];
    return [...userData.calls].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'date':
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case 'duration':
          aVal = a.duration;
          bVal = b.duration;
          break;
        case 'cost':
          aVal = a.cost;
          bVal = b.cost;
          break;
        case 'destination':
          aVal = a.destination || '';
          bVal = b.destination || '';
          break;
        case 'destCountry':
          aVal = a.destCountry || '';
          bVal = b.destCountry || '';
          break;
        default:
          return 0;
      }
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }, [userData, sortField, sortDirection]);

  // Calculate cost by destination (converted)
  const costByDestination = useMemo(() => {
    if (!userData) return [];
    const destCosts: Record<string, number> = {};
    for (const call of userData.calls) {
      const dest = call.destCountry || 'Unknown';
      destCosts[dest] = (destCosts[dest] || 0) + call.cost;
    }
    return Object.entries(destCosts)
      .map(([country, cost]) => ({ country, cost: Math.round(convertAmount(cost) * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);
  }, [userData, convertAmount]);

  // Calculate top 5 numbers called (by frequency)
  const topNumbersCalled = useMemo(() => {
    if (!userData) return [];
    const numberCounts: Record<string, { count: number; cost: number; country: string | null }> = {};
    for (const call of userData.calls) {
      const num = call.destination || 'Unknown';
      if (!numberCounts[num]) {
        numberCounts[num] = { count: 0, cost: 0, country: call.destCountry };
      }
      numberCounts[num].count += 1;
      numberCounts[num].cost += call.cost;
    }
    return Object.entries(numberCounts)
      .map(([number, data]) => ({ number, ...data, cost: Math.round(data.cost * 100) / 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [userData]);

  // Calculate costliest numbers (converted)
  const costliestNumbers = useMemo(() => {
    if (!userData) return [];
    const numberCosts: Record<string, { cost: number; count: number; country: string | null }> = {};
    for (const call of userData.calls) {
      const num = call.destination || 'Unknown';
      if (!numberCosts[num]) {
        numberCosts[num] = { cost: 0, count: 0, country: call.destCountry };
      }
      numberCosts[num].cost += call.cost;
      numberCosts[num].count += 1;
    }
    return Object.entries(numberCosts)
      .map(([number, data]) => ({ number, ...data, cost: Math.round(convertAmount(data.cost) * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
  }, [userData, convertAmount]);

  // Convert trend data for chart
  const convertedTrendData = useMemo(() => {
    if (!trendData) return null;
    return {
      ...trendData,
      monthlyTrend: trendData.monthlyTrend.map(m => ({
        ...m,
        cost: convertAmount(m.cost),
      })),
    };
  }, [trendData, convertAmount]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400 ml-1">↕</span>;
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // Format the date range for display
  const formatDateRange = (): string => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  const exportToCSV = () => {
    if (!userData) return;

    const headers = ['Date', 'From', 'Origin Country', 'To', 'Destination Country', 'Duration (min)', 'Rate', `Cost (${currency})`];
    const rows = userData.calls.map(call => [
      new Date(call.date).toLocaleDateString(),
      call.sourceNumber || '',
      call.originCountry || '',
      call.destination || '',
      call.destCountry || '',
      Math.round(call.duration / 60),
      convertAmount(call.rate).toFixed(4),
      convertAmount(call.cost).toFixed(2),
    ]);

    const csvContent = [
      `User: ${userData.userName} (${userData.userEmail})`,
      `Period: ${formatDateRange()}`,
      `Currency: ${currency}`,
      `Total: ${userData.totalCalls} calls, ${userData.totalMinutes} min, ${formatCurrency(userData.totalCost)}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${userData.userEmail}-${formatDateForApi(startDate)}-to-${formatDateForApi(endDate)}-${currency}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Search</h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Carrier and Date Range Controls */}
          <div className="flex flex-wrap items-center gap-4">
            {carriers.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Carrier:</label>
                <select
                  value={carrierId || ''}
                  onChange={(e) => setCarrierId(e.target.value ? Number(e.target.value) : undefined)}
                  className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
                >
                  <option value="">All Carriers</option>
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</label>
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm"
              >
                {Object.entries(presetLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <DatePicker
                selected={startDate}
                onChange={handleStartDateChange}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                maxDate={endDate}
                dateFormat="MMM d, yyyy"
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm w-36"
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
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors text-sm w-36"
              />
            </div>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-4 rounded-md transition-colors">
          {error}
        </div>
      )}

      {userData && (
        <>
          {/* User Summary + Range Total + Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Summary */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {userData.userName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{userData.userEmail}</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total Minutes</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {userData.totalMinutes.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total Calls</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {userData.totalCalls.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total Cost</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(userData.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Range Totals */}
            {trendData && (
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-lg shadow">
                <h2 className="text-sm font-medium text-indigo-100 mb-1">
                  Range Total
                </h2>
                <p className="text-3xl font-bold text-white mb-4">
                  {formatCurrency(trendData.rangeTotal.totalCost)}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-indigo-200">Calls</p>
                    <p className="text-lg font-semibold text-white">{trendData.rangeTotal.totalCalls.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-200">Minutes</p>
                    <p className="text-lg font-semibold text-white">{trendData.rangeTotal.totalMinutes.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost Trend */}
            {convertedTrendData && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Monthly Cost Trend</h2>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={convertedTrendData.monthlyTrend}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Cost']}
                      contentStyle={{
                        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                        borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Cost by Destination + Top Numbers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cost by Destination Pie Chart */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cost by Destination</h2>
              {costByDestination.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No data available
                </div>
              ) : (
                <div className="flex items-center">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie
                        data={costByDestination}
                        dataKey="cost"
                        nameKey="country"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {costByDestination.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                          borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-1/2 space-y-1">
                    {costByDestination.slice(0, 5).map((item, index) => (
                      <div key={item.country} className="flex items-center text-xs">
                        <span
                          className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{item.country}</span>
                        <span className="text-gray-900 dark:text-white font-medium ml-1">{currency === 'CHF' ? `CHF ${item.cost.toFixed(2)}` : `$${item.cost.toFixed(2)}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top 5 Numbers Called */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Most Called Numbers</h2>
              {topNumbersCalled.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-sm">No data available</div>
              ) : (
                <div className="space-y-3">
                  {topNumbersCalled.map((item, index) => (
                    <div key={item.number} className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs flex items-center justify-center mr-2 flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-mono text-gray-900 dark:text-white truncate">{item.number}</p>
                          {item.country && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.country}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 ml-2">
                        {item.count} calls
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Costliest Numbers */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Costliest Numbers</h2>
              {costliestNumbers.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400 text-sm">No data available</div>
              ) : (
                <div className="space-y-3">
                  {costliestNumbers.map((item, index) => (
                    <div key={item.number} className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 text-xs flex items-center justify-center mr-2 flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-mono text-gray-900 dark:text-white truncate">{item.number}</p>
                          {item.country && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.country}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400 ml-2">
                        {currency === 'CHF' ? `CHF ${item.cost.toFixed(2)}` : `$${item.cost.toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Call History */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Call History</h2>
              <button
                onClick={exportToCSV}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('date')}
                    >
                      Date <SortIcon field="date" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">From</th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('destination')}
                    >
                      To <SortIcon field="destination" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('destCountry')}
                    >
                      Route <SortIcon field="destCountry" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('duration')}
                    >
                      Duration <SortIcon field="duration" />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rate</th>
                    <th
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleSort('cost')}
                    >
                      Cost <SortIcon field="cost" />
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedCalls.map((call, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {new Date(call.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="font-mono text-xs">{call.sourceNumber || '-'}</div>
                        {call.originCountry && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{call.originCountry}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="font-mono text-xs">{call.destination || '-'}</div>
                        {call.destCountry && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{call.destCountry}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {call.originCountry && call.destCountry ? (
                          <span>{call.originCountry} → {call.destCountry}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                        {Math.round(call.duration / 60)} min
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right font-mono">
                        {call.rate > 0 ? (currency === 'CHF' ? `CHF ${convertAmount(call.rate).toFixed(4)}` : `$${call.rate.toFixed(4)}`) : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-semibold">
                        {formatCurrency(call.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
