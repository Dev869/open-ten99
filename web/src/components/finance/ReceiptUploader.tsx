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
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-card)] p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Uploading...</p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer ${
        dragActive
          ? 'border-[var(--accent)] bg-[var(--accent)]/10'
          : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/50'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
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

      <p className="text-2xl">+</p>
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Upload Receipt</p>
      <p className="text-xs text-[var(--text-secondary)]">Drop files or click to browse</p>

      {/* Mobile: show scan button */}
      <button
        className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white sm:hidden"
        onClick={(e) => {
          e.stopPropagation();
          scanInputRef.current?.click();
        }}
      >
        Scan Receipt
      </button>
    </div>
  );
}
