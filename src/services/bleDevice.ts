import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { Rgb, rgbCommand } from '../constants/deviceLedColours';

export const NUS_SERVICE = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
export const NUS_RX      = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'; // phone → device (write)
export const NUS_TX      = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'; // device → phone (notify)
export const DEVICE_NAME = 'ForeverMeasure';

const SEND_TIMEOUT_MS = 10000;

// Singleton — created once for the app lifetime so CoreBluetooth has time to
// initialise (and show the iOS permission dialog) before the user needs it.
// react-native-ble-plx expects a single BleManager instance app-wide.
let _manager: BleManager | null = null;
export function getManager(): BleManager {
  if (!_manager) _manager = new BleManager();
  return _manager;
}

export type SendResult = {
  /** The command that was written, e.g. "rgb 255 80 0". */
  command: string;
  /** Text the device replied with (e.g. "RGB_OK,255,80,0"), or null if it didn't reply. */
  reply: string | null;
};

// How long to wait for an optional reply line after the write succeeds.
const REPLY_WAIT_MS = 2000;

/**
 * Writes `rgb R G B\n` to the measurement device's UART RX characteristic so
 * its firmware can set the button LED. Reuses an existing connection if one is
 * open (and leaves it open); otherwise scans, connects, writes, and
 * disconnects. After the write it waits briefly for a reply line starting
 * `RGB_OK` — firmware that doesn't reply still counts as success.
 * Rejects after SEND_TIMEOUT_MS if the device can't be reached.
 */
export function sendRgbToDevice(rgb: Rgb): Promise<SendResult> {
  const manager = getManager();
  const command = rgbCommand(rgb);
  const payload = btoa(`${command}\n`);

  let stateSub: Subscription | null = null;
  let monitorSub: Subscription | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let replyTimer: ReturnType<typeof setTimeout> | null = null;
  let openedDevice: Device | null = null;
  let settled = false;

  const cleanUp = () => {
    stateSub?.remove();
    stateSub = null;
    monitorSub?.remove();
    monitorSub = null;
    if (timeout) clearTimeout(timeout);
    if (replyTimer) clearTimeout(replyTimer);
    timeout = null;
    replyTimer = null;
    manager.stopDeviceScan();
    if (openedDevice) {
      openedDevice.cancelConnection().catch(() => {});
      openedDevice = null;
    }
  };

  return new Promise<SendResult>((resolve, reject) => {
    const finish = (err?: Error, reply: string | null = null) => {
      if (settled) return;
      settled = true;
      cleanUp();
      if (err) reject(err);
      else resolve({ command, reply });
    };

    const write = (device: Device) => {
      // Listen for the device's optional reply before writing so it can't be missed.
      let incoming = '';
      monitorSub = device.monitorCharacteristicForService(NUS_SERVICE, NUS_TX, (err, char) => {
        if (err || !char?.value) return;
        incoming += atob(char.value);
        const match = incoming.match(/RGB_OK[^\r\n]*/);
        if (match) finish(undefined, match[0]);
      });

      return device
        .writeCharacteristicWithResponseForService(NUS_SERVICE, NUS_RX, payload)
        .then(() => {
          if (settled) return;
          replyTimer = setTimeout(() => finish(), REPLY_WAIT_MS);
        })
        .catch((e: Error) => finish(e));
    };

    const connectAndWrite = async () => {
      const already = await manager.connectedDevices([NUS_SERVICE]);
      const existing = already.find((d) => d.name === DEVICE_NAME) ?? already[0];
      if (existing) {
        await existing.discoverAllServicesAndCharacteristics();
        return write(existing);
      }

      manager.startDeviceScan([NUS_SERVICE], { allowDuplicates: false }, (err, device) => {
        if (err) return finish(err);
        if (!device || device.name !== DEVICE_NAME) return;
        manager.stopDeviceScan();
        device
          .connect()
          .then((d) => {
            if (settled) {
              // Timed out while connecting — don't leave this connection open.
              d.cancelConnection().catch(() => {});
              throw new Error('Timed out');
            }
            openedDevice = d;
            return d.discoverAllServicesAndCharacteristics();
          })
          .then((d) => write(d))
          .catch((e: Error) => finish(e));
      });
    };

    timeout = setTimeout(
      () => finish(new Error('Could not reach the measurement device.')),
      SEND_TIMEOUT_MS,
    );

    stateSub = manager.onStateChange((state) => {
      switch (state) {
        case State.PoweredOn:
          stateSub?.remove();
          stateSub = null;
          connectAndWrite().catch((e: Error) => finish(e));
          break;
        case State.PoweredOff:
          finish(new Error('Bluetooth is turned off.'));
          break;
        case State.Unauthorized:
          finish(new Error('Bluetooth permission denied.'));
          break;
        // Unknown / Resetting — keep waiting until the timeout
      }
    }, true);
  });
}
