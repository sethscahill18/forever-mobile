# BLE Measurement Device Integration — Forever App

## Context

The user has an Adafruit Feather nRF52840 Express running `physical_device/Basic_Bluetooth.ino`. It uses a rotary encoder + tape to measure height/length in centimetres and streams the value over BLE every 200 ms. Already verified with the Bluefruit Connect app. Goal: add a FAB "Add" button on the Measurements screen that connects to the device and shows the cm value updating live.

## What the device sends

- **BLE name:** `"ForeverMeasure"`
- **Protocol:** Nordic UART Service (NUS) via Adafruit `BLEUart`
- **Data:** `bleuart.println(latestHeightCm, 1)` → e.g. `"17.5\r\n"` every 200 ms
- **Unit:** centimetres (cm)

| Role | UUID |
|---|---|
| NUS Service | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| TX characteristic (device → iPhone, notify) | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` |

## iOS pairing — nothing required

The Feather uses **BLE**, not Classic Bluetooth. BLE devices do not need to be paired in iOS Settings → Bluetooth (that flow is only for Classic BT devices like headphones). `react-native-ble-plx` uses CoreBluetooth directly — the same API the Bluefruit Connect app uses — so the connection works identically without any OS-level pairing step.

The only prompt the user sees is the iOS Bluetooth *permission* dialog on the very first scan ("Forever would like to use Bluetooth"). After granting it once, the app connects to ForeverMeasure autonomously.

## BLE state machine

```
idle → scanning → connecting → connected → disconnected → idle
```

---

## Implementation Steps

### Step 1 — Install `react-native-ble-plx`

```bash
npx expo install react-native-ble-plx
```

v3+ config plugin auto-adds `NSBluetoothAlwaysUsageDescription` to Info.plist.

### Step 2 — `app.json` — add plugin

```json
["react-native-ble-plx", { "isBackgroundEnabled": false }]
```

### Step 3 — Rebuild native project

```bash
npx expo prebuild --clean --platform ios
npx expo run:ios --configuration Release --device
```

### Step 4 — Create `src/hooks/useBLEMeasure.ts`

Self-contained hook owning the `BleManager` lifecycle:

- `new BleManager()` once in a `useRef`; `manager.destroy()` on unmount
- `startScan()`: `manager.startDeviceScan([NUS_SERVICE], null, cb)` — filters `device.name === 'ForeverMeasure'`, stops on first match, connects, discovers services, calls `device.monitorCharacteristicForService(NUS_SERVICE, NUS_TX, onNotify)`
- `onNotify`: `atob(char.value)` → trim → `parseFloat()` → `setValueCm()`
- `disconnect()`: `device.cancelConnection()`, reset to `idle` / `null`
- Returns `{ status, valueCm, startScan, disconnect }`

### Step 5 — Replace `app/(tabs)/measurements.tsx` stub

The screen lives entirely here — no separate modal route needed.

**Layout — idle / scanning / connecting:**

```
┌──────────────────────────────────┐
│  Measurements                    │
│                                  │
│        No measurements yet       │
│                                  │
│                          [+ FAB] │  ← Ionicons "add", bottom-right
└──────────────────────────────────┘
```

FAB tap → `startScan()`; FAB icon swaps to an `ActivityIndicator` while `status === 'scanning' || 'connecting'`.

**Layout — connected (panel slides up from bottom via `Animated.spring`):**

```
┌──────────────────────────────────┐
│  Measurements                    │
│                                  │
│        No measurements yet       │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  ForeverMeasure  ● Connected │ │
│ │                              │ │
│ │         17.5 cm              │ │  ← updates 5×/sec
│ │                              │ │
│ │  [Disconnect]    [Save]      │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

- Value displayed as `${valueCm?.toFixed(1)} cm`
- **Save** inserts into `measurements` table: `weightKg = 0`, `notes = \`BLE: ${valueCm?.toFixed(1)} cm\``, `profileId` from `useActiveProfileStore`, `measuredAt = Date.now()`. This avoids a schema change — full measurement redesign happens in Phase 4.
- After Save: brief success banner ("Saved!"), panel stays open for another reading
- **Disconnect**: slides panel away, FAB returns to `+`

### Step 6 — No other files need changing

BLE is self-contained within `measurements.tsx` + the hook. No `_layout.tsx` edits, no new routes.

---

## Files to Create / Modify

| File | Action |
|---|---|
| `app.json` | Add `react-native-ble-plx` plugin |
| `src/hooks/useBLEMeasure.ts` | Create — BLE manager hook |
| `app/(tabs)/measurements.tsx` | Replace stub with full screen + BLE panel |

---

## Verification Steps

1. Rebuild — on first FAB tap iOS shows Bluetooth permission prompt → Allow
2. Power on Feather (already running `Basic_Bluetooth.ino`); tap FAB — no iOS Settings pairing needed
3. Status: Scanning → Connecting → Connected; panel slides up
4. Move encoder — value updates live ~5×/sec on screen
5. Tap Save — row inserted in `measurements` table (visible via Drizzle Studio or Phase 4 list)
6. Tap Disconnect — panel slides away, FAB restores to `+`
