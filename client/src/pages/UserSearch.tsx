import { useState, useMemo, useEffect } from 'react';
import { usageApi } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from 'recharts';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from '../hooks/useCurrency';

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
  cost: number;
  calls: number;
  minutes: number;
}

interface TrendData {
  monthlyTrend: TrendMonth[];
  yearTotal: {
    year: number;
    totalCost: number;
    totalCalls: number;
    totalMinutes: number;
  };
}

type SortField = 'date' | 'duration' | 'cost' | 'destination' | 'destCountry';
type SortDirection = 'asc' | 'desc';

export default function UserSearch() {
  const [searchTerm, setSearchTerm] = useState(() => {
    return sessionStorage.getItem('usersearch_term') || '';
  });
  const [month, setMonth] = useState<number>(() => {
    const saved = sessionStorage.getItem('usersearch_month');
    return saved ? parseInt(saved, 10) : new Date().getMonth() + 1;
  });
  const [year, setYear] = useState<number>(() => {
    const saved = sessionStorage.getItem('usersearch_year');
    return saved ? parseInt(saved, 10) : new Date().getFullYear();
  });
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

  // Persist filters and results to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('usersearch_term', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    sessionStorage.setItem('usersearch_month', String(month));
  }, [month]);

  useEffect(() => {
    sessionStorage.setItem('usersearch_year', String(year));
  }, [year]);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError('');
    setUserData(null);
    setTrendData(null);

    try {
      const [userResponse, trendResponse] = await Promise.all([
        usageApi.searchUser(searchTerm, month, year),
        usageApi.getUserTrend(searchTerm, year),
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
      `Period: ${months[month - 1]} ${year}`,
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
    link.setAttribute('download', `${userData.userEmail}-${year}-${month}-${currency}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Search</h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
          >
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-4 rounded-md transition-colors">
          {error}
        </div>
      )}

      {userData && (
        <>
          {/* User Summary + YTD + Trend */}
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

            {/* Year Totals */}
            {trendData && (
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-lg shadow">
                <h2 className="text-sm font-medium text-indigo-100 mb-1">
                  {trendData.yearTotal.year} Year Total
                </h2>
                <p className="text-3xl font-bold text-white mb-4">
                  {formatCurrency(trendData.yearTotal.totalCost)}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-indigo-200">Calls</p>
                    <p className="text-lg font-semibold text-white">{trendData.yearTotal.totalCalls.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-indigo-200">Minutes</p>
                    <p className="text-lg font-semibold text-white">{trendData.yearTotal.totalMinutes.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Annual Cost Trend */}
            {convertedTrendData && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
                <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{year} Monthly Cost Trend</h2>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={convertedTrendData.monthlyTrend}>
                    <XAxis dataKey="monthName" tick={{ fontSize: 9, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} axisLine={false} tickLine={false} interval={0} />
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
