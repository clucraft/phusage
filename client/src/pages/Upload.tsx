import { useState, useRef } from 'react';
import { uploadApi } from '../services/api';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
      setResult({
        success: true,
        message: `Successfully processed ${response.data.recordsProcessed} records.`,
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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Teams Report</h1>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="mt-1 text-sm text-gray-500">
              Supported formats: CSV, XLSX, XLS
            </p>
          </div>

          {file && (
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
              <span className="text-sm text-gray-700">{file.name}</span>
              <span className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Report'}
          </button>

          {result && (
            <div
              className={`p-4 rounded-md ${
                result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {result.message}
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Expected File Format</h3>
          <p className="text-sm text-gray-600 mb-2">
            The file should contain the following columns (headers can vary):
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>User / UserName / user_name - User's display name</li>
            <li>Email / UserEmail / user_email - User's email address</li>
            <li>Date / CallDate / call_date - Date of the call</li>
            <li>Duration / CallDuration / duration - Call duration in seconds</li>
            <li>Type / CallType / call_type - Type of call (e.g., domestic, international)</li>
            <li>Destination / ToNumber / destination - Called number (optional)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
