import { useState, useRef, useEffect } from 'react';
import { uploadApi } from '../services/api';

interface UploadHistoryItem {
  id: number;
  fileName: string;
  fileType: string;
  recordCount: number;
  uploadedBy: string;
  uploadedAt: string;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
}

interface Gap {
  start: string;
  end: string;
}

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await uploadApi.getHistory();
      setHistory(response.data.history);
      setGaps(response.data.gaps);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

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
      // Reload history after successful upload
      loadHistory();
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

  const handleDeleteHistoryEntry = async (id: number) => {
    if (!confirm('Delete this history entry? (This does not delete the actual call records)')) return;

    try {
      await uploadApi.deleteHistoryEntry(id);
      loadHistory();
    } catch (error) {
      console.error('Failed to delete history entry:', error);
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter teams uploads for the history section
  const teamsUploads = history.filter(h => h.fileType === 'teams');
  const ratesUploads = history.filter(h => h.fileType === 'rates');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Teams Report</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Upload form */}
        <div className="space-y-6">
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

        {/* Right column - Upload History */}
        <div className="space-y-6">
          {/* Gap Warnings */}
          {gaps.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Data Gaps Detected
              </h3>
              <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                {gaps.map((gap, i) => (
                  <li key={i}>
                    {formatDate(gap.start)} to {formatDate(gap.end)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                Upload reports for these date ranges to ensure complete data coverage.
              </p>
            </div>
          )}

          {/* Teams Upload History */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow transition-colors">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Teams Report History
              </h2>
            </div>
            {loadingHistory ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                Loading...
              </div>
            ) : teamsUploads.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No uploads yet
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {teamsUploads.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.fileName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {item.recordCount.toLocaleString()} records • Uploaded {formatDateTime(item.uploadedAt)}
                        </p>
                        {item.dateRangeStart && item.dateRangeEnd && (
                          <p className="text-xs mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300">
                              {formatDate(item.dateRangeStart)} → {formatDate(item.dateRangeEnd)}
                            </span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteHistoryEntry(item.id)}
                        className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete history entry"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coverage Timeline */}
          {teamsUploads.length > 0 && teamsUploads.some(u => u.dateRangeStart && u.dateRangeEnd) && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Data Coverage
              </h2>
              <div className="space-y-2">
                {(() => {
                  // Sort uploads by start date
                  const sortedUploads = teamsUploads
                    .filter(u => u.dateRangeStart && u.dateRangeEnd)
                    .sort((a, b) => new Date(a.dateRangeStart!).getTime() - new Date(b.dateRangeStart!).getTime());

                  if (sortedUploads.length === 0) return null;

                  const minDate = new Date(sortedUploads[0].dateRangeStart!);
                  const maxDate = new Date(sortedUploads[sortedUploads.length - 1].dateRangeEnd!);
                  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>{formatDate(sortedUploads[0].dateRangeStart)}</span>
                        <span>{formatDate(sortedUploads[sortedUploads.length - 1].dateRangeEnd)}</span>
                      </div>
                      <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                        {sortedUploads.map((upload) => {
                          const start = new Date(upload.dateRangeStart!);
                          const end = new Date(upload.dateRangeEnd!);
                          const left = ((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100;
                          const width = Math.max(2, ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100);

                          return (
                            <div
                              key={upload.id}
                              className="absolute h-full bg-indigo-500 dark:bg-indigo-400"
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                              }}
                              title={`${upload.fileName}: ${formatDate(upload.dateRangeStart)} - ${formatDate(upload.dateRangeEnd)}`}
                            />
                          );
                        })}
                        {/* Show gaps */}
                        {gaps.map((gap, i) => {
                          const start = new Date(gap.start);
                          const end = new Date(gap.end);
                          const left = ((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100;
                          const width = Math.max(2, ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) / totalDays * 100);

                          return (
                            <div
                              key={`gap-${i}`}
                              className="absolute h-full bg-amber-400 dark:bg-amber-500 opacity-75"
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                              }}
                              title={`Gap: ${formatDate(gap.start)} - ${formatDate(gap.end)}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-indigo-500 dark:bg-indigo-400 rounded" />
                          <span className="text-gray-600 dark:text-gray-400">Data</span>
                        </div>
                        {gaps.length > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-amber-400 dark:bg-amber-500 rounded" />
                            <span className="text-gray-600 dark:text-gray-400">Gaps</span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Rates Upload History */}
          {ratesUploads.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow transition-colors">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Rate File History
                </h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {ratesUploads.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.fileName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {item.recordCount.toLocaleString()} rates • Uploaded {formatDateTime(item.uploadedAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteHistoryEntry(item.id)}
                        className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete history entry"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
