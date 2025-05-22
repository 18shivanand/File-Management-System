import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '../services/fileService';
import { File as FileType } from '../types/file';
import { DocumentIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export const FileList: React.FC = () => {
  const queryClient = useQueryClient();

  // Filter and pagination states
  const [search, setSearch] = useState('');
  const [fileType, setFileType] = useState('');
  const [sizeMin, setSizeMin] = useState('');
  const [sizeMax, setSizeMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Query for paginated files
  const { data, isLoading, error } = useQuery<{
    results: FileType[];
    count: number;
  }>({
    queryKey: [
      'files',
      { search, fileType, sizeMin, sizeMax, dateFrom, dateTo, page, pageSize },
    ],
    queryFn: async (): Promise<{ results: FileType[]; count: number }> => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (fileType) params.append('file_type__icontains', fileType);
      if (sizeMin) params.append('size__gte', sizeMin);
      if (sizeMax) params.append('size__lte', sizeMax);
      if (dateFrom) params.append('uploaded_at__date__gte', dateFrom);
      if (dateTo) params.append('uploaded_at__date__lte', dateTo);
      params.append('page', String(page));
      params.append('page_size', String(pageSize));
      // Ensure getFiles returns { results, count }
      const response = await fileService.getFiles(params.toString());
      if (Array.isArray(response)) {
        // If the response is an array, wrap it
        return { results: response, count: response.length };
      }
      return response;
    },
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: fileService.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: ({ fileUrl, filename }: { fileUrl: string; filename: string }) =>
      fileService.downloadFile(fileUrl, filename),
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDownload = async (fileUrl: string, filename: string) => {
    try {
      await downloadMutation.mutateAsync({ fileUrl, filename });
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const files = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Uploaded Files</h2>
      {/* --- Search & Filter UI --- */}
      <div className="mb-6 flex flex-nowrap items-end gap-3">
        <input
          type="text"
          placeholder="Search filename"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border px-2 py-1 rounded w-40"
        />
        <input
          type="text"
          placeholder="File type"
          value={fileType}
          onChange={e => setFileType(e.target.value)}
          className="border px-2 py-1 rounded w-32"
        />
        <input
          type="number"
          placeholder="Min size (bytes)"
          value={sizeMin}
          onChange={e => setSizeMin(e.target.value)}
          className="border px-3 py-1 rounded w-48"
        />
        <input
          type="number"
          placeholder="Max size (bytes)"
          value={sizeMax}
          onChange={e => setSizeMax(e.target.value)}
          className="border px-3 py-1 rounded w-48"
        />
        <input
          type="date"
          placeholder="From date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <input
          type="date"
          placeholder="To date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <select
          value={pageSize}
          onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="border px-2 py-1 rounded"
        >
          {[5, 10, 15, 20, 50].map(size => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
      </div>
      {/* --- End Search & Filter UI --- */}

      {/* File List */}
      {!files || files.length === 0 ? (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by uploading a file
          </p>
        </div>
      ) : (
        <div className="mt-6 flow-root">
          <ul className="-my-5 divide-y divide-gray-200">
            {files.map((file: FileType) => (
              <li key={file.id} className="py-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <DocumentIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.original_filename}
                    </p>
                    <p className="text-sm text-gray-500">
                      {file.file_type} • {(file.size / 1024).toFixed(2)} KB
                    </p>
                    <p className="text-sm text-gray-500">
                      Uploaded {new Date(file.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDownload(file.file, file.original_filename)}
                      disabled={downloadMutation.isPending}
                      className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          >
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};