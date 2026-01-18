import { useState, useEffect, useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { usageApi } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from '../hooks/useCurrency';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ISO 3166-1 numeric to alpha-3 mapping for countries we track
const numericToAlpha3: Record<string, string> = {
  '840': 'USA', '826': 'GBR', '276': 'DEU', '250': 'FRA', '380': 'ITA',
  '724': 'ESP', '528': 'NLD', '056': 'BEL', '756': 'CHE', '040': 'AUT',
  '752': 'SWE', '578': 'NOR', '208': 'DNK', '246': 'FIN', '372': 'IRL',
  '620': 'PRT', '616': 'POL', '203': 'CZE', '348': 'HUN', '642': 'ROU',
  '100': 'BGR', '300': 'GRC', '792': 'TUR', '643': 'RUS', '804': 'UKR',
  '124': 'CAN', '484': 'MEX', '076': 'BRA', '032': 'ARG', '152': 'CHL',
  '170': 'COL', '604': 'PER', '862': 'VEN', '156': 'CHN', '392': 'JPN',
  '410': 'KOR', '356': 'IND', '036': 'AUS', '554': 'NZL', '702': 'SGP',
  '344': 'HKG', '158': 'TWN', '764': 'THA', '458': 'MYS', '360': 'IDN',
  '608': 'PHL', '704': 'VNM', '376': 'ISR', '682': 'SAU', '784': 'ARE',
  '710': 'ZAF', '818': 'EGY', '566': 'NGA', '404': 'KEN', '504': 'MAR',
};

interface LocationData {
  country: string;
  countryCode: string;
  calls: number;
  cost: number;
  minutes: number;
  users: number;
}

type SortField = 'country' | 'calls' | 'cost' | 'minutes' | 'users';
type SortDirection = 'asc' | 'desc';

export default function Locations() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<number>(() => {
    const saved = sessionStorage.getItem('locations_month');
    return saved ? parseInt(saved, 10) : new Date().getMonth() + 1;
  });
  const [year, setYear] = useState<number>(() => {
    const saved = sessionStorage.getItem('locations_year');
    return saved ? parseInt(saved, 10) : new Date().getFullYear();
  });
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { theme } = useTheme();
  const { formatCurrency } = useCurrency();

  // Persist filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('locations_month', String(month));
  }, [month]);

  useEffect(() => {
    sessionStorage.setItem('locations_year', String(year));
  }, [year]);

  useEffect(() => {
    fetchLocations();
  }, [month, year]);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const response = await usageApi.getLocations(month, year);
      setLocations(response.data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create a map of country codes to location data for the choropleth
  const locationMap = useMemo(() => {
    const map: Record<string, LocationData> = {};
    for (const loc of locations) {
      if (loc.countryCode) {
        map[loc.countryCode] = loc;
      }
    }
    return map;
  }, [locations]);

  // Calculate max cost for color scaling
  const maxCost = useMemo(() => {
    if (locations.length === 0) return 0;
    return Math.max(...locations.map(l => l.cost));
  }, [locations]);

  // Get color based on cost (choropleth)
  const getCountryColor = (countryCode: string) => {
    const location = locationMap[countryCode];
    if (!location || maxCost === 0) {
      return theme === 'dark' ? '#374151' : '#e5e7eb'; // Gray for no data
    }

    const intensity = location.cost / maxCost;

    if (theme === 'dark') {
      // Dark mode: purple gradient
      const r = Math.round(88 + (167 - 88) * intensity);
      const g = Math.round(28 + (56 - 28) * intensity);
      const b = Math.round(135 + (239 - 135) * intensity);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Light mode: indigo gradient
      const r = Math.round(224 + (79 - 224) * intensity);
      const g = Math.round(231 + (70 - 231) * intensity);
      const b = Math.round(255 + (229 - 255) * intensity);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Sort locations
  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'country':
          aVal = a.country;
          bVal = b.country;
          break;
        case 'calls':
          aVal = a.calls;
          bVal = b.calls;
          break;
        case 'cost':
          aVal = a.cost;
          bVal = b.cost;
          break;
        case 'minutes':
          aVal = a.minutes;
          bVal = b.minutes;
          break;
        case 'users':
          aVal = a.users;
          bVal = b.users;
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
  }, [locations, sortField, sortDirection]);

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

  const handleMouseEnter = (geo: { properties?: { name?: string }; id?: string }, countryCode: string, evt: React.MouseEvent) => {
    const location = locationMap[countryCode];

    if (location) {
      setTooltipContent(
        `${location.country}: ${location.calls.toLocaleString()} calls, ${formatCurrency(location.cost)}`
      );
    } else {
      const countryName = geo.properties?.name || 'Unknown';
      setTooltipContent(`${countryName}: No data`);
    }

    setTooltipPosition({ x: evt.clientX, y: evt.clientY });
  };

  const handleMouseLeave = () => {
    setTooltipContent('');
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calculate totals
  const totals = useMemo(() => {
    return locations.reduce(
      (acc, loc) => ({
        calls: acc.calls + loc.calls,
        cost: acc.cost + loc.cost,
        minutes: acc.minutes + loc.minutes,
        users: acc.users + loc.users,
      }),
      { calls: 0, cost: 0, minutes: 0, users: 0 }
    );
  }, [locations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Locations</h1>
        <div className="flex items-center gap-4">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow transition-colors">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Locations</h3>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{locations.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow transition-colors">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Calls</h3>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totals.calls.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow transition-colors">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Minutes</h3>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totals.minutes.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-lg shadow">
          <h3 className="text-xs font-medium text-indigo-100 uppercase">Total Cost</h3>
          <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(totals.cost)}</p>
        </div>
      </div>

      {/* World Map */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cost by Origin Location</h2>
        {loading ? (
          <div className="h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading map...
          </div>
        ) : (
          <div className="relative">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 120,
                center: [0, 30],
              }}
              style={{ width: '100%', height: 'auto' }}
            >
              <ZoomableGroup>
                <Geographies geography={geoUrl}>
                  {({ geographies }: { geographies: Array<{ rsmKey: string; properties?: { ISO_A3?: string; name?: string }; id?: string }> }) =>
                    geographies.map((geo: { rsmKey: string; properties?: { ISO_A3?: string; name?: string }; id?: string }) => {
                      // Convert numeric ISO code to alpha-3 code
                      const numericId = geo.id || '';
                      const countryCode = numericToAlpha3[numericId] || geo.properties?.ISO_A3 || '';
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onMouseEnter={(evt: React.MouseEvent<SVGPathElement>) => handleMouseEnter(geo as any, countryCode, evt)}
                          onMouseLeave={handleMouseLeave}
                          style={{
                            default: {
                              fill: getCountryColor(countryCode),
                              stroke: theme === 'dark' ? '#1f2937' : '#ffffff',
                              strokeWidth: 0.5,
                              outline: 'none',
                            },
                            hover: {
                              fill: theme === 'dark' ? '#a78bfa' : '#6366f1',
                              stroke: theme === 'dark' ? '#1f2937' : '#ffffff',
                              strokeWidth: 0.5,
                              outline: 'none',
                              cursor: 'pointer',
                            },
                            pressed: {
                              fill: theme === 'dark' ? '#8b5cf6' : '#4f46e5',
                              outline: 'none',
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>

            {/* Tooltip */}
            {tooltipContent && (
              <div
                className="fixed z-50 px-3 py-2 text-sm bg-gray-900 dark:bg-gray-700 text-white rounded-lg shadow-lg pointer-events-none"
                style={{
                  left: tooltipPosition.x + 10,
                  top: tooltipPosition.y - 10,
                }}
              >
                {tooltipContent}
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-700 p-3 rounded-lg shadow-lg">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Cost Intensity</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: theme === 'dark' ? '#581c87' : '#e0e7ff' }}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">Low</span>
                <div
                  className="w-16 h-4 rounded"
                  style={{
                    background: theme === 'dark'
                      ? 'linear-gradient(to right, #581c87, #a78bfa)'
                      : 'linear-gradient(to right, #e0e7ff, #4f46e5)',
                  }}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">High</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Location Details Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Location Details</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : locations.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No location data available for the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('country')}
                  >
                    Location <SortIcon field="country" />
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('users')}
                  >
                    Users <SortIcon field="users" />
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('calls')}
                  >
                    Calls <SortIcon field="calls" />
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('minutes')}
                  >
                    Minutes <SortIcon field="minutes" />
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('cost')}
                  >
                    Cost <SortIcon field="cost" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-48">
                    Cost Distribution
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedLocations.map((location, i) => (
                  <tr key={location.country} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
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
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{location.country}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {location.users.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {location.calls.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {location.minutes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                      {formatCurrency(location.cost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${maxCost > 0 ? (location.cost / maxCost) * 100 : 0}%` }}
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
