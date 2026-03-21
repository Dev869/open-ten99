import type { Receipt } from '../../lib/types';
import ReceiptCard from './ReceiptCard';
import ReceiptUploader from './ReceiptUploader';

interface ReceiptGridProps {
  receipts: Receipt[];
  onReceiptClick: (receipt: Receipt) => void;
  onUploadComplete?: (receiptId: string) => void;
  onUploadError?: (message: string) => void;
}

export default function ReceiptGrid({ receipts, onReceiptClick, onUploadComplete, onUploadError }: ReceiptGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <ReceiptUploader onUploadComplete={onUploadComplete} onError={onUploadError} />
      {receipts.map((receipt) => (
        <ReceiptCard key={receipt.id} receipt={receipt} onClick={onReceiptClick} />
      ))}
    </div>
  );
}
