import { useRef, useState, useEffect, useCallback } from 'react';
import { BleManager, Device, Subscription, State } from 'react-native-ble-plx';
import { Platform } from 'react-native';

const NUS_SERVICE = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const NUS_TX      = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
const DEVICE_NAME = 'ForeverMeasure';

// Singleton — created once for the app lifetime so CoreBluetooth has time to
// initialise (and show the iOS permission dialog) before the user taps the FAB.
let _manager: BleManager | null = null;
function getManager(): BleManager {
  if (!_manager) _manager = new BleManager();
  return _manager;
}

export type BLEStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

export function useBLEMeasure() {
  const deviceRef       = useRef<Device | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const stateSubRef     = useRef<Subscription | null>(null);
  const timeoutRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status,          setStatus]          = useState<BLEStatus>('idle');
  const [valueCm,         setValueCm]         = useState<number | null>(null);
  const [saveRequestedCm, setSaveRequestedCm] = useState<number | null>(null);
  const [error,           setError]           = useState<string | null>(null);

  // Ref so the onNotify closure (created once in doScan) can always read the
  // latest live reading without the stale-closure problem.
  const valueCmRef = useRef<number | null>(null);
  useEffect(() => { valueCmRef.current = valueCm; }, [valueCm]);

  useEffect(() => {
    // Ensure the manager (and CBCentralManager underneath) is created at mount
    // time so it is ready well before the user taps.
    getManager();
    return () => {
      cancelWait();
      cleanUp();
    };
  }, []);

  function cancelWait() {
    stateSubRef.current?.remove();
    stateSubRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function cleanUp() {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    deviceRef.current?.cancelConnection().catch(() => {});
    deviceRef.current = null;
  }

  function doScan(manager: BleManager) {
    manager.startDeviceScan(
      [NUS_SERVICE],
      { allowDuplicates: false },
      (err, device) => {
        if (err) {
          setError(err.message);
          setStatus('error');
          return;
        }
        if (!device || device.name !== DEVICE_NAME) return;

        manager.stopDeviceScan();
        setStatus('connecting');

        device
          .connect()
          .then((d) => d.discoverAllServicesAndCharacteristics())
          .then((d) => {
            deviceRef.current = d;
            setStatus('connected');

            subscriptionRef.current = d.monitorCharacteristicForService(
              NUS_SERVICE,
              NUS_TX,
              (charErr, char) => {
                if (charErr) {
                  setError(charErr.message);
                  setStatus('error');
                  return;
                }
                if (!char?.value) return;
                // BLE data arrives as base64; decode → parse
                const raw     = Platform.OS === 'ios'
                  ? atob(char.value)
                  : Buffer.from(char.value, 'base64').toString('utf8');
                const trimmed = raw.trim();

                if (trimmed.startsWith('SAVE')) {
                  // Any SAVE variant — "SAVED", "SAVE", "SAVE,", "SAVE,142.3"
                  // Try to extract an embedded value first; fall back to the ref.
                  const afterComma = trimmed.includes(',') ? trimmed.slice(trimmed.indexOf(',') + 1) : '';
                  const embedded   = parseFloat(afterComma);
                  const cm         = !isNaN(embedded) ? embedded : valueCmRef.current;
                  if (cm !== null) setSaveRequestedCm(cm);
                } else {
                  // Plain live reading
                  const parsed = parseFloat(trimmed);
                  if (!isNaN(parsed)) setValueCm(parsed);
                }
              },
            );
          })
          .catch((connErr) => {
            setError(connErr.message);
            setStatus('error');
            deviceRef.current = null;
          });
      },
    );
  }

  const startScan = useCallback(() => {
    const manager = getManager();

    setStatus('scanning');
    setValueCm(null);
    setError(null);
    cancelWait();

    function handleState(state: State) {
      switch (state) {
        case State.PoweredOn:
          cancelWait();
          doScan(manager);
          break;
        case State.PoweredOff:
          cancelWait();
          setError('Bluetooth is turned off. Please enable it and try again.');
          setStatus('error');
          break;
        case State.Unauthorized:
          cancelWait();
          setError('Bluetooth permission denied. Please allow it in Settings → Privacy & Security → Bluetooth.');
          setStatus('error');
          break;
        // Unknown / Resetting — keep waiting
      }
    }

    // onStateChange(cb, emitCurrentValue=true) fires immediately with the current
    // state then again on every transition. iOS shows the permission dialog when
    // CBCentralManager is first accessed; once the user taps Allow the state
    // transitions Unknown → PoweredOn and the scan begins automatically.
    stateSubRef.current = manager.onStateChange(handleState, true);

    // Safety timeout: if we're still waiting after 15 s something is wrong
    timeoutRef.current = setTimeout(() => {
      cancelWait();
      setError('Bluetooth did not respond. Make sure Bluetooth is on and try again.');
      setStatus('error');
    }, 15000);
  }, []);

  const clearSaveRequest = useCallback(() => setSaveRequestedCm(null), []);

  const disconnect = useCallback(() => {
    cancelWait();
    getManager().stopDeviceScan();
    cleanUp();
    setStatus('idle');
    setValueCm(null);
    setSaveRequestedCm(null);
    setError(null);
  }, []);

  return { status, valueCm, saveRequestedCm, clearSaveRequest, error, startScan, disconnect };
}
