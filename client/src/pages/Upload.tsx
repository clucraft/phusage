import { useState, useRef } from 'react';
import { uploadApi } from '../services/api';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const response = await uploadApi.uploadTeamsReport(file);
      const skippedMsg = response.data.recordsSkipped
        ? ` (${response.data.recordsSkipped} skipped - failed/zero duration)`
        : '';
      setResult({
        success: true,
        message: `Successfully processed ${response.data.recordsProcessed} records${skippedMsg}.`,
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.error || 'Failed to upload file',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClearRecords = async () => {
    if (!confirm('Are you sure you want to delete ALL call records? This cannot be undone.')) return;

    setClearing(true);
    setResult(null);

    try {
      const response = await uploadApi.clearCallRecords();
      setResult({
        success: true,
        message: response.data.message,
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.error || 'Failed to clear records',
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Upload Teams Report</h1>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-800 transition-colors"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Supported formats: CSV, XLSX, XLS
            </p>
          </div>

          {file && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-3 rounded-md transition-colors">
              <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload Report'}
          </button>

          {result && (
            <div
              className={`p-4 rounded-md ${
                result.success
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
              } transition-colors`}
            >
              {result.message}
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Expected File Format</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Teams PSTN Usage Report columns (exported from Teams Admin Center):
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Display Name</code> - User's display name</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">UPN</code> - User's email address</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Start time</code> - Call start timestamp</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Duration (seconds)</code> - Call duration</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Caller Number</code> - Source phone number</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Callee Number</code> - Destination phone number</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Call Direction</code> - Inbound/Outbound</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">User country</code> - Origin country</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">External Country</code> - Destination country</li>
            <li><code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Success</code> - Failed calls are skipped</li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Manage Data</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Clear all existing call records before re-importing data.
          </p>
          <button
            onClick={handleClearRecords}
            disabled={clearing}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {clearing ? 'Clearing...' : 'Clear All Call Records'}
          </button>
        </div>
      </div>
    </div>
  );
}
