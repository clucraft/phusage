import { useState, useEffect } from 'react';
import { ratesApi } from '../services/api';

interface Rate {
  id: number;
  callType: string;
  ratePerMinute: number;
  description: string | null;
}

export default function Rates() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRate, setNewRate] = useState({ callType: '', ratePerMinute: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await ratesApi.getRates();
      setRates(response.data);
    } catch (error) {
      console.error('Failed to fetch rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRate.callType || !newRate.ratePerMinute) return;

    setSaving(true);
    setError('');

    try {
      await ratesApi.saveRate(
        newRate.callType,
        parseFloat(newRate.ratePerMinute),
        newRate.description || undefined
      );
      setNewRate({ callType: '', ratePerMinute: '', description: '' });
      fetchRates();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save rate');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRate = async (callType: string) => {
    if (!confirm(`Delete rate for "${callType}"?`)) return;

    try {
      await ratesApi.deleteRate(callType);
      fetchRates();
    } catch (error) {
      console.error('Failed to delete rate:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Rate Matrix</h1>

      {/* Add New Rate Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add / Update Rate</h2>
        <form onSubmit={handleAddRate} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Call Type</label>
            <input
              type="text"
              placeholder="e.g., domestic"
              value={newRate.callType}
              onChange={(e) => setNewRate({ ...newRate, callType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate/Min ($)</label>
            <input
              type="number"
              step="0.0001"
              placeholder="0.00"
              value={newRate.ratePerMinute}
              onChange={(e) => setNewRate({ ...newRate, ratePerMinute: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="Optional description"
              value={newRate.description}
              onChange={(e) => setNewRate({ ...newRate, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Rate'}
            </button>
          </div>
        </form>
        {error && (
          <div className="mt-4 text-red-600 text-sm">{error}</div>
        )}
      </div>

      {/* Rates Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Current Rates</h2>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : rates.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No rates configured. Add rates above to calculate usage costs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate per Minute</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {rate.callType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${Number(rate.ratePerMinute).toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rate.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleDeleteRate(rate.callType)}
                        className="text-red-600 hover:text-red-900"
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
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Verizon Rate Matrix</h3>
        <p className="text-sm text-blue-700">
          Enter the rates provided by Verizon for different call types. The call type should match
          the "Type" column in your Teams reports. Common types include:
        </p>
        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
          <li><strong>domestic</strong> - US domestic calls</li>
          <li><strong>international</strong> - International calls</li>
          <li><strong>tollfree</strong> - Toll-free numbers</li>
          <li><strong>default</strong> - Fallback rate for unmatched types</li>
        </ul>
      </div>
    </div>
  );
}
