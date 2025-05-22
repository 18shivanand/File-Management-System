import React, { useState, useEffect } from 'react';
import { fileService } from '../services/fileService';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<'success' | 'error' | null>(null);
  const queryClient = useQueryClient();

  // Show notification for 5 seconds
  useEffect(() => {
    if (notificationMessage) {
      setShowNotification(true);
      const timer = setTimeout(() => {
        setShowNotification(false);
        setNotificationMessage(null);
        setNotificationType(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notificationMessage]);

  const uploadMutation = useMutation({
    mutationFn: fileService.uploadFile,
    onSuccess: (data: any) => {
      if (data.duplicate && data.message) {
        setServerMessage(data.message);
        setNotificationMessage('File is already uploaded');
        setNotificationType('error');
      } else {
        setServerMessage(null);
        setNotificationMessage('File uploaded successfully!');
        setNotificationType('success');
      }
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setSelectedFile(null);
      onUploadSuccess();
    },
    onError: (error: any) => {
      // Check for backend duplicate error in 400 response
      const duplicate =
        error?.response?.data?.duplicate ||
        (error?.response?.data?.message &&
          error?.response?.data?.message.toLowerCase().includes('duplicate'));
      if (duplicate) {
        setError(null); // Clear generic error
        setServerMessage(null); // Don't show blue message for error
        setNotificationMessage(
          error?.response?.data?.message || 'File is already uploaded'
        );
        setNotificationType('error');
      } else {
        setError('Failed to upload file. Please try again.');
        setServerMessage(null);
        setNotificationMessage('Failed to upload file. Please try again.');
        setNotificationType('error');
      }
      console.error('Upload error:', error);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > MAX_FILE_SIZE) {
        setError('File size should not exceed 10MB');
        setNotificationMessage('File size should not exceed 10MB');
        setNotificationType('error');
        setSelectedFile(null);
        setServerMessage(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
      setServerMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      setNotificationMessage('Please select a file');
      setNotificationType('error');
      return;
    }

    try {
      setError(null);
      setServerMessage(null);
      await uploadMutation.mutateAsync(selectedFile);
    } catch (err) {
      // Error handling is done in onError callback
    }
  };

  return (
    <div className="p-6">
      {/* Notification */}
      {showNotification && notificationMessage && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-2 rounded shadow-lg transition-all
            ${notificationType === 'success' ? 'bg-green-600 text-white' : ''}
            ${notificationType === 'error' ? 'bg-red-600 text-white' : ''}
          `}
        >
          {notificationMessage}
        </div>
      )}
      <div className="flex items-center mb-4">
        <CloudArrowUpIcon className="h-6 w-6 text-primary-600 mr-2" />
        <h2 className="text-xl font-semibold text-gray-900">Upload File</h2>
      </div>
      <div className="mt-4 space-y-4">
        <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
          <div className="space-y-1 text-center">
            <div className="flex text-sm text-gray-600">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
              >
                <span>Upload a file</span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleFileSelect}
                  disabled={uploadMutation.isPending}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">Any file up to 10MB</p>
          </div>
        </div>
        {selectedFile && (
          <div className="text-sm text-gray-600">
            Selected: {selectedFile.name}
          </div>
        )}
        {serverMessage && (
          <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
            {serverMessage}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploadMutation.isPending}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            !selectedFile || uploadMutation.isPending
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
          }`}
        >
          {uploadMutation.isPending ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Uploading...
            </>
          ) : (
            'Upload'
          )}
        </button>
      </div>
    </div>
  );
};