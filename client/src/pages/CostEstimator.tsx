import { useState, useEffect, useMemo } from 'react';
import { estimatorApi } from '../services/api';
import { useCurrency } from '../hooks/useCurrency';

interface Template {
  country: string;
  userCount: number;
  callCount: number;
  year: number;
}

interface TemplateData {
  originCountry: string;
  year: number;
  userCount: number;
  totalCalls: number;
  avgCallsPerUserPerMonth: number;
  avgMinutesPerCall: number;
  destinations: Array<{
    country: string;
    calls: number;
    percentage: number;
    avgMinutes: number;
  }>;
}

interface Destination {
  country: string;
  percentage: number;
}

interface EstimateResult {
  summary: {
    originCountry: string;
    userCount: number;
    callsPerUserPerMonth: number;
    avgMinutesPerCall: number;
    totalMonthlyCalls: number;
    totalMonthlyMinutes: number;
    monthlyCost: number;
    yearlyCost: number;
    costPerUser: number;
  };
  breakdown: Array<{
    country: string;
    percentage: number;
    calls: number;
    minutes: number;
    ratePerMinute: number;
    monthlyCost: number;
    rateFound: boolean;
  }>;
}

export default function CostEstimator() {
  // Form state
  const [originCountry, setOriginCountry] = useState('');
  const [userCount, setUserCount] = useState<number>(10);
  const [callsPerUserPerMonth, setCallsPerUserPerMonth] = useState<number>(20);
  const [avgMinutesPerCall, setAvgMinutesPerCall] = useState<number>(5);
  const [destinations, setDestinations] = useState<Destination[]>([]);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateYear, setTemplateYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Options state
  const [originOptions, setOriginOptions] = useState<string[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<EstimateResult | null>(null);

  // New destination input
  const [newDestination, setNewDestination] = useState('');

  const { formatCurrency } = useCurrency();

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load templates when year changes
  useEffect(() => {
    loadTemplates();
  }, [templateYear]);

  const loadInitialData = async () => {
    try {
      const [yearsRes, originsRes, destsRes] = await Promise.all([
        estimatorApi.getYears(),
        estimatorApi.getOrigins(),
        estimatorApi.getDestinations(),
      ]);

      setAvailableYears(yearsRes.data);
      setOriginOptions(originsRes.data);
      setDestinationOptions(destsRes.data);

      if (yearsRes.data.length > 0) {
        setTemplateYear(yearsRes.data[0]);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await estimatorApi.getTemplates(templateYear);
      setTemplates(response.data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const applyTemplate = async () => {
    if (!selectedTemplate) return;

    setLoadingTemplate(true);
    setError('');

    try {
      const response = await estimatorApi.getTemplateData(selectedTemplate, templateYear);
      const data: TemplateData = response.data;

      setCallsPerUserPerMonth(data.avgCallsPerUserPerMonth);
      setAvgMinutesPerCall(data.avgMinutesPerCall);
      setDestinations(
        data.destinations.map(d => ({
          country: d.country,
          percentage: d.percentage,
        }))
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load template');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const addDestination = () => {
    if (!newDestination || destinations.some(d => d.country === newDestination)) {
      return;
    }

    setDestinations([...destinations, { country: newDestination, percentage: 0 }]);
    setNewDestination('');
  };

  const removeDestination = (country: string) => {
    setDestinations(destinations.filter(d => d.country !== country));
  };

  const updateDestinationPercentage = (country: string, percentage: number) => {
    setDestinations(
      destinations.map(d =>
        d.country === country ? { ...d, percentage: Math.max(0, Math.min(100, percentage)) } : d
      )
    );
  };

  const totalPercentage = useMemo(() => {
    return destinations.reduce((sum, d) => sum + d.percentage, 0);
  }, [destinations]);

  const calculateEstimate = async () => {
    if (!originCountry) {
      setError('Please select a new site country');
      return;
    }

    if (destinations.length === 0) {
      setError('Please add at least one destination');
      return;
    }

    if (totalPercentage !== 100) {
      setError(`Destination percentages must sum to 100% (currently ${totalPercentage}%)`);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await estimatorApi.calculate({
        originCountry,
        userCount,
        callsPerUserPerMonth,
        avgMinutesPerCall,
        destinations,
      });

      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to calculate estimate');
    } finally {
      setLoading(false);
    }
  };

  const distributeEvenly = () => {
    if (destinations.length === 0) return;

    const evenPercentage = Math.floor(100 / destinations.length);
    const remainder = 100 - evenPercentage * destinations.length;

    setDestinations(
      destinations.map((d, i) => ({
        ...d,
        percentage: evenPercentage + (i === 0 ? remainder : 0),
      }))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cost Estimator</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Input Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Site Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Site Country
                </label>
                <select
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select country...</option>
                  {originOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expected Users
                </label>
                <input
                  type="number"
                  min="1"
                  value={userCount}
                  onChange={(e) => setUserCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Calls/User/Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={callsPerUserPerMonth}
                    onChange={(e) => setCallsPerUserPerMonth(Math.max(0.1, parseFloat(e.target.value) || 1))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Avg Minutes/Call
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={avgMinutesPerCall}
                    onChange={(e) => setAvgMinutesPerCall(Math.max(0.1, parseFloat(e.target.value) || 1))}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Template Loader */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Load from Template</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Pre-fill call patterns from an existing site's historical data
            </p>
            <div className="flex flex-wrap gap-3">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="flex-1 min-w-[150px] border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Select template...</option>
                {templates.map((t) => (
                  <option key={t.country} value={t.country}>
                    {t.country} ({t.userCount} users, {t.callCount.toLocaleString()} calls)
                  </option>
                ))}
              </select>
              <select
                value={templateYear}
                onChange={(e) => setTemplateYear(parseInt(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                onClick={applyTemplate}
                disabled={!selectedTemplate || loadingTemplate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {loadingTemplate ? 'Loading...' : 'Apply'}
              </button>
            </div>
          </div>

          {/* Destination Distribution */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Call Distribution</h2>
              <button
                onClick={distributeEvenly}
                disabled={destinations.length === 0}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
              >
                Distribute Evenly
              </button>
            </div>

            {/* Add destination */}
            <div className="flex gap-2 mb-4">
              <select
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Add destination...</option>
                {destinationOptions
                  .filter((d) => !destinations.some((dest) => dest.country === d))
                  .map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
              </select>
              <button
                onClick={addDestination}
                disabled={!newDestination}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                Add
              </button>
            </div>

            {/* Destination list */}
            {destinations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No destinations added. Add destinations or load from a template.
              </p>
            ) : (
              <div className="space-y-2">
                {destinations.map((dest) => (
                  <div
                    key={dest.country}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-md"
                  >
                    <span className="flex-1 text-sm text-gray-900 dark:text-white">{dest.country}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={dest.percentage}
                        onChange={(e) =>
                          updateDestinationPercentage(dest.country, parseInt(e.target.value) || 0)
                        }
                        className="w-16 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-right"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400">%</span>
                    </div>
                    <button
                      onClick={() => removeDestination(dest.country)}
                      className="text-red-500 hover:text-red-700 text-lg px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div
                  className={`text-sm font-medium text-right mt-2 ${
                    totalPercentage === 100
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  Total: {totalPercentage}%{' '}
                  {totalPercentage !== 100 && `(${totalPercentage < 100 ? 'need' : 'over by'} ${Math.abs(100 - totalPercentage)}%)`}
                </div>
              </div>
            )}
          </div>

          {/* Calculate Button */}
          <button
            onClick={calculateEstimate}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Calculating...' : 'Calculate Estimate'}
          </button>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 p-4 rounded-md">
              {error}
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {!result ? (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow text-center transition-colors">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Estimate Yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure your new site details and click "Calculate Estimate" to see projected costs.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-lg shadow">
                  <h3 className="text-xs font-medium text-indigo-100 uppercase">Monthly Cost</h3>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatCurrency(result.summary.monthlyCost)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-lg shadow">
                  <h3 className="text-xs font-medium text-purple-100 uppercase">Yearly Cost</h3>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatCurrency(result.summary.yearlyCost)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-4 rounded-lg shadow">
                  <h3 className="text-xs font-medium text-pink-100 uppercase">Per User/Month</h3>
                  <p className="text-2xl font-bold text-white mt-1">
                    {formatCurrency(result.summary.costPerUser)}
                  </p>
                </div>
              </div>

              {/* Summary Details */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Estimate Summary
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Origin Country</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {result.summary.originCountry}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Users</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {result.summary.userCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Calls/User/Month</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {result.summary.callsPerUserPerMonth}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Avg Min/Call</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {result.summary.avgMinutesPerCall}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Total Monthly Calls</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {result.summary.totalMonthlyCalls.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Total Monthly Minutes</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {result.summary.totalMonthlyMinutes.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden transition-colors">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Cost Breakdown by Destination
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Destination
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          %
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Minutes
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Rate/Min
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                          Monthly Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {result.breakdown.map((item, i) => (
                        <tr
                          key={item.country}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                                  i === 0
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : i === 1
                                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                                    : i === 2
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                    : 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}
                              >
                                {i + 1}
                              </span>
                              <span className="text-gray-900 dark:text-white">{item.country}</span>
                              {!item.rateFound && (
                                <span className="text-xs text-amber-600 dark:text-amber-400">
                                  (no rate)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right">
                            {item.percentage}%
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                            {item.minutes.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right font-mono">
                            {item.ratePerMinute > 0 ? `$${item.ratePerMinute.toFixed(4)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right font-semibold">
                            {formatCurrency(item.monthlyCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right"
                        >
                          Total Monthly Cost
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white text-right">
                          {formatCurrency(result.summary.monthlyCost)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Warning for missing rates */}
              {result.breakdown.some((b) => !b.rateFound) && (
                <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 p-4 rounded-md text-sm">
                  <strong>Note:</strong> Some destinations don't have rates configured for{' '}
                  {result.summary.originCountry}. These are shown with $0 cost. Upload rates for more
                  accurate estimates.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
