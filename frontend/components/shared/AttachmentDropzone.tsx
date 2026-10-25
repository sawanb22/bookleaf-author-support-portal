'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, Info, FileText, X, AlertCircle } from 'lucide-react';

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export interface AttachmentDropzoneProps {
  files: AttachmentFile[];
  onFilesChange: (files: AttachmentFile[]) => void;
  className?: string;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  allowedExtensions?: string[];
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentDropzone({
  files,
  onFilesChange,
  className = '',
  error: externalError,
  onErrorChange,
  maxFiles = 3,
  maxSizeMB = 5,
  allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'],
}: AttachmentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEnabled = process.env.NEXT_PUBLIC_ATTACHMENTS_ENABLED === 'true';

  const setError = useCallback(
    (msg: string | null) => {
      setInternalError(msg);
      if (onErrorChange) onErrorChange(msg);
    },
    [onErrorChange]
  );

  const error = externalError !== undefined ? externalError : internalError;

  const validateAndAddFiles = (newFiles: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(newFiles);

    if (files.length + fileArray.length > maxFiles) {
      setError(`You can attach up to ${maxFiles} files.`);
      return;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const validated: AttachmentFile[] = [];

    for (const file of fileArray) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const isAllowedExt = allowedExtensions.includes(ext);
      const isAllowedMime =
        file.type === 'image/jpeg' ||
        file.type === 'image/png' ||
        file.type === 'application/pdf';

      if (!isAllowedExt && !isAllowedMime) {
        setError(`${file.name} isn’t supported. Use JPG, PNG or PDF.`);
        return;
      }

      if (file.size > maxSizeBytes) {
        setError(`${file.name} is larger than ${maxSizeMB} MB.`);
        return;
      }

      validated.push({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      });
    }

    onFilesChange([...files, ...validated]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemove = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
    setError(null);
  };

  return (
    <div className={`space-y-2 pt-1 ${className}`}>
      <label htmlFor="attachment-file-input" className="block font-label text-label text-text font-medium">
        Attachments <span className="text-text-muted font-normal text-caption">(optional)</span>
      </label>

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        className="sr-only"
        id="attachment-file-input"
        onChange={handleInputChange}
      />

      {/* 104px Dropzone Container */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`min-h-[104px] border border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group ${
          isDragging
            ? 'border-primary bg-primary-tint/30'
            : 'border-border-strong bg-surface hover:bg-surface-sunken/40'
        } focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
        aria-label="Upload attachments dropzone"
      >
        <div className="flex items-center space-x-2 text-text">
          <Paperclip
            className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors"
            aria-hidden="true"
          />
          <span className="font-label text-label text-primary font-medium group-hover:underline">
            Choose files
          </span>
          <span className="font-body text-body text-text-muted">or drop them here</span>
        </div>
        <p className="font-caption text-caption text-text-muted mt-1.5">
          JPG, PNG or PDF, up to 5 MB each, maximum 3.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <p className="flex items-center gap-1.5 text-caption text-danger" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {/* Selected Files List */}
      {files.length > 0 && (
        <ul className="mt-3 space-y-2 w-full" aria-label="Selected attachments">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between p-2.5 bg-surface-sunken border border-border rounded-lg text-caption font-body"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <FileText className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
                <span className="truncate font-medium text-text">{file.name}</span>
                <span className="text-text-subtle tabular-nums">
                  ({formatFileSize(file.size)})
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(file.id);
                }}
                aria-label={`Remove ${file.name}`}
                className="p-1 text-text-muted hover:text-danger rounded hover:bg-surface transition-colors focus:outline-none focus:ring-2 focus:ring-danger"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Demo Disclaimer Note (Controlled by NEXT_PUBLIC_ATTACHMENTS_ENABLED) */}
      {!isEnabled && (
        <div className="flex items-start space-x-1.5 text-text-muted pt-0.5">
          <Info className="w-4 h-4 text-text-subtle shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-caption text-caption text-text-subtle">
            File upload isn’t switched on in this demo. Mention any files in your description.
          </p>
        </div>
      )}
    </div>
  );
}
