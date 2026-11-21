import { useEffect, useRef } from 'react';

interface UseBarcodeWedgeOptions {
  enabled?: boolean;
  onScan: (barcode: string) => void;
  minLength?: number;
  maxIntervalMs?: number;
}

/**
 * Listens for rapid HID keyboard bursts from USB or Bluetooth barcode scanners
 * terminating with Enter or Tab, ignoring regular human typing in form inputs.
 */
export function useBarcodeWedge({
  enabled = true,
  onScan,
  minLength = 4,
  maxIntervalMs = 65,
}: UseBarcodeWedgeOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isBarcodeDesignatedInput = target?.dataset?.barcodeInput === 'true';

      // Ignore regular form typing unless the input explicitly wants wedge capture
      if (
        (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) &&
        !isBarcodeDesignatedInput
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;

      if (e.key === 'Enter' || e.key === 'Tab') {
        const scanned = bufferRef.current.trim();
        if (scanned.length >= minLength && diff < 250) {
          e.preventDefault();
          bufferRef.current = '';
          onScanRef.current(scanned);
          return;
        }
        bufferRef.current = '';
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (diff > maxIntervalMs) {
          bufferRef.current = e.key;
        } else {
          bufferRef.current += e.key;
        }
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, minLength, maxIntervalMs]);
}
