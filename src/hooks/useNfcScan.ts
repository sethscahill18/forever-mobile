import { useCallback, useEffect, useRef, useState } from 'react';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

export type NfcScanStatus = 'idle' | 'scanning' | 'success' | 'error';

export interface NfcScanData {
  uid: string;
  techTypes: string[];
  hasNdef: boolean;
  ndefTexts: string[];
}

export function useNfcScan() {
  const [status, setStatus] = useState<NfcScanStatus>('idle');
  const [data, setData]     = useState<NfcScanData | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    // NfcManager.start() must run once before any other call. Unlike BleManager's
    // constructor, this does NOT show any system UI — that only happens inside
    // requestTechnology() below. Mirrors useBLEMeasure's getManager()-on-mount pattern.
    NfcManager.start();
    return () => {
      if (scanningRef.current) NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  const scan = useCallback(async () => {
    setStatus('scanning');
    setData(null);
    setError(null);

    try {
      const supported = await NfcManager.isSupported();
      if (!supported) throw new Error('This device does not support NFC scanning.');

      scanningRef.current = true;
      // Shows Apple's system "Hold Near Reader" sheet; resolves on a successful
      // read, rejects on user-cancel or ~60s timeout.
      await NfcManager.requestTechnology(NfcTech.Ndef);

      const tag = await NfcManager.getTag();
      if (!tag) throw new Error('No tag data was returned.');

      const ndefTexts: string[] = [];
      if (tag.ndefMessage?.length) {
        for (const record of tag.ndefMessage) {
          try {
            const text = Ndef.text.decodePayload(Uint8Array.from(record.payload));
            if (text) ndefTexts.push(text);
          } catch {
            // Non-text record (URI/MIME/etc.) — out of scope for stage 1.
          }
        }
      }

      setData({
        uid: tag.id ?? 'unknown',
        techTypes: tag.techTypes ?? [],
        hasNdef: !!tag.ndefMessage?.length,
        ndefTexts,
      });
      setStatus('success');
    } catch (ex: any) {
      const message = ex?.message ?? String(ex);
      // iOS rejects with a "cancel"-flavoured message when the user dismisses
      // the system sheet — treat that as a silent reset, not an error.
      if (/cancel/i.test(message)) {
        setStatus('idle');
      } else {
        setError(message);
        setStatus('error');
      }
    } finally {
      scanningRef.current = false;
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }, []);

  return { status, data, error, scan };
}
