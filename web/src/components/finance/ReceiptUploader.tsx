import { useState, useRef, useCallback } from 'react';
import { uploadReceiptFile } from '../../services/firestore';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'];

interface ReceiptUploaderProps {
  onUploadComplete?: (receiptId: string) => void;
  onError?: (message: string) => void;
}

export default function ReceiptUploader({ onUploadComplete, onError }: ReceiptUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) return 'File must be under 10MB';
    if (!ACCEPTED_TYPES.some((t) => file.type.startsWith(t.split('/')[0]) || file.type === t)) {
      return 'Only images and PDFs are accepted';
    }
    return null;
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setUploading(true);

    try {
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          onError?.(error);
          continue;
        }
        const { receiptId } = await uploadReceiptFile(file);
        onUploadComplete?.(receiptId);
      }
    } catch {
      onError?.('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete, onError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  if (uploading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-4 min-h-[160px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <p className="mt-2 text-xs text-[var(--text-secondary)]">Uploading...</p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl p-4 min-h-[160px] transition-colors cursor-pointer ${
        dragActive
          ? 'border-2 border-[var(--accent)] bg-[var(--accent)]/10'
          : 'bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)]/50'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => {
        // On mobile, prefer camera; on desktop, file picker
        if ('ontouchstart' in window) {
          scanInputRef.current?.click();
        } else {
          fileInputRef.current?.click();
        }
      }}
    >
      <input
        ref={scanInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mb-2">
        <span className="text-lg text-[var(--accent)] font-bold">+</span>
      </div>
      <p className="text-xs font-semibold text-[var(--text-primary)]">Add Receipt</p>
      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Tap or drop file</p>
    </div>
  );
}
