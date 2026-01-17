import { useState, useEffect, useRef } from 'react';
import { ratesApi, uploadApi } from '../services/api';

interface Rate {
  id: number;
  originCountry: string;
  destination: string;
  destCountry: string;
  callType: string;
  pricePerMinute: number;
}

interface RateStats {
  totalRates: number;
  originCountries: number;
  destinationCountries: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function Rates() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 100, total: 0, pages: 0 });
  const [stats, setStats] = useState<RateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search inputs
  const [originSearch, setOriginSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [debouncedOriginSearch, setDebouncedOriginSearch] = useState('');
  const [debouncedDestSearch, setDebouncedDestSearch] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [clearExisting, setClearExisting] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual rate add
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRate, setNewRate] = useState({
    originCountry: '',
    destination: '',
    pricePerMinute: '',
    callType: 'Outbound',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  // Debounce search inputs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOriginSearch(originSearch);
      setPagination(p => ({ ...p, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [originSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDestSearch(destSearch);
      setPagination(p => ({ ...p, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [destSearch]);

  useEffect(() => {
    fetchRates();
  }, [debouncedOriginSearch, debouncedDestSearch, pagination.page]);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (debouncedOriginSearch) params.originSearch = debouncedOriginSearch;
      if (debouncedDestSearch) params.destSearch = debouncedDestSearch;

      const response = await ratesApi.getRates(params);
      setRates(response.data.rates);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Failed to fetch rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await ratesApi.getStats();
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);
    setError('');

    try {
      const response = await uploadApi.uploadVerizonRates(file, clearExisting);
      setUploadResult({
        message: `Imported ${response.data.recordsProcessed} rates${response.data.recordsSkipped ? ` (${response.data.recordsSkipped} skipped)` : ''}`,
        type: 'success',
      });
      fetchRates();
      fetchStats();
    } catch (err: any) {
      setUploadResult({
        message: err.response?.data?.error || 'Failed to upload rate file',
        type: 'error',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRate.originCountry || !newRate.destination || !newRate.pricePerMinute) return;

    setSaving(true);
    setError('');

    try {
      await ratesApi.saveRate(
        newRate.originCountry,
        newRate.destination,
        parseFloat(newRate.pricePerMinute),
        newRate.callType
      );
      setNewRate({ originCountry: '', destination: '', pricePerMinute: '', callType: 'Outbound' });
      setShowAddForm(false);
      fetchRates();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save rate');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRate = async (id: number) => {
    if (!confirm('Delete this rate?')) return;

    try {
      await ratesApi.deleteRate(id);
      fetchRates();
      fetchStats();
    } catch (err) {
      console.error('Failed to delete rate:', err);
    }
  };

  const handleClearAllRates = async () => {
    if (!confirm('Are you sure you want to delete ALL rates? This cannot be undone.')) return;

    try {
      await ratesApi.clearAllRates();
      fetchRates();
      fetchStats();
      setUploadResult({ message: 'All rates cleared', type: 'success' });
    } catch (err) {
      console.error('Failed to clear rates:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rate Matrix</h1>
        {stats && (
          <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span><strong>{stats.totalRates.toLocaleString()}</strong> rates</span>
            <span><strong>{stats.originCountries}</strong> origins</span>
            <span><strong>{stats.destinationCountries}</strong> destinations</span>
          </div>
        )}
      </div>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Import Verizon Rate Matrix</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Upload the Verizon VoIP Usage Rates Excel file (.xlsx). The system will parse the "Usage Geographic Termination" sheet
          and import rates with origin country, destination, and price per minute.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={clearExisting}
              onChange={(e) => setClearExisting(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Clear existing rates before import
          </label>
          <label className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 cursor-pointer transition-colors">
            {uploading ? 'Uploading...' : 'Choose File'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
          <button
            onClick={handleClearAllRates}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm transition-colors"
          >
            Clear All Rates
          </button>
        </div>
        {uploadResult && (
          <div className={`mt-4 p-3 rounded-md text-sm ${
            uploadResult.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {uploadResult.message}
          </div>
        )}
      </div>

      {/* Search Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow transition-colors">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-56">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Origin Country
            </label>
            <input
              type="text"
              placeholder="e.g., USA, UK, Germany..."
              value={originSearch}
              onChange={(e) => setOriginSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <div className="w-56">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Destination
            </label>
            <input
              type="text"
              placeholder="e.g., Afghanistan, Mobile..."
              value={destSearch}
              onChange={(e) => setDestSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>
          {(originSearch || destSearch) && (
            <button
              onClick={() => {
                setOriginSearch('');
                setDestSearch('');
              }}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
            >
              Clear Search
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm transition-colors"
          >
            {showAddForm ? 'Cancel' : 'Add Rate Manually'}
          </button>
        </div>
      </div>

      {/* Manual Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add / Update Rate</h2>
          <form onSubmit={handleAddRate} className="flex flex-wrap gap-4">
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origin Country</label>
              <input
                type="text"
                placeholder="e.g., USA"
                value={newRate.originCountry}
                onChange={(e) => setNewRate({ ...newRate, originCountry: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destination</label>
              <input
                type="text"
                placeholder="e.g., Afghanistan-Mobile"
                value={newRate.destination}
                onChange={(e) => setNewRate({ ...newRate, destination: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Call Type</label>
              <select
                value={newRate.callType}
                onChange={(e) => setNewRate({ ...newRate, callType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <option value="Outbound">Outbound</option>
                <option value="Inbound">Inbound</option>
              </select>
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price/Min ($)</label>
              <input
                type="number"
                step="0.0001"
                placeholder="0.0000"
                value={newRate.pricePerMinute}
                onChange={(e) => setNewRate({ ...newRate, pricePerMinute: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Rate'}
              </button>
            </div>
          </form>
          {error && (
            <div className="mt-4 text-red-600 dark:text-red-400 text-sm">{error}</div>
          )}
        </div>
      )}

      {/* Rates Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Rates {pagination.total > 0 && `(${pagination.total.toLocaleString()} total)`}
          </h2>
          {pagination.pages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : rates.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No rates found. Upload a Verizon rate file or add rates manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Origin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Destination</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Call Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price/Min</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {rate.originCountry}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {rate.destination}
                      {rate.destination !== rate.destCountry && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({rate.destCountry})</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {rate.callType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-mono">
                      ${Number(rate.pricePerMinute).toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleDeleteRate(rate.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-lg transition-colors">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Verizon Geographic Rates</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          The rate matrix uses geographic pricing based on origin and destination countries.
          When calculating usage costs, the system:
        </p>
        <ul className="mt-2 text-sm text-blue-700 dark:text-blue-400 list-disc list-inside">
          <li>Determines origin country from the source phone number's country code</li>
          <li>Determines destination country from the called number's country code</li>
          <li>Looks up the rate based on origin + destination + call type</li>
          <li>Falls back to base country rates if specific destination (e.g., Mobile) not found</li>
        </ul>
      </div>
    </div>
  );
}
