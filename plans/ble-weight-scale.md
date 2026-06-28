# BLE Weight Scale Integration — Forever App

## Context
The Adafruit Feather nRF52840 Express acts as a BLE peripheral transmitting live weight readings. The iPhone app scans for it, connects, and displays the live reading on a dedicated screen with an option to save it as a measurement. The app already uses a native build (`expo run:ios`) so native BLE libraries are supported.

---

## BLE Protocol — Nordic UART Service (NUS)

The Feather uses Adafruit's built-in `BLEUart` class which implements the Nordic UART Service. The firmware just calls `bleuart.println(weight, 2)` — no manual GATT characteristic creation needed.

| Role | UUID |
|---|---|
| NUS Service | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| TX characteristic (Feather → iPhone, notify) | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` |

**Data format:** ASCII float with newline — e.g. `"72.50\n"`. Parsed with `parseFloat()` on the JS side.  
**Device filter:** Feather advertises as `"ForeverScale"`. The app ignores all other BLE devices during scanning.

---

## App State Machine

```
idle → scanning → connecting → connected → disconnected → idle
```

---

## Implementation Steps

### Step 1 — Install `react-native-ble-plx`
```bash
npx expo install react-native-ble-plx
```
v3+ ships a config plugin that automatically adds `NSBluetoothAlwaysUsageDescription` to Info.plist.

### Step 2 — Update `app.json`
Add the plugin entry inside the `"plugins"` array (after `"expo-secure-store"`):
```json
["react-native-ble-plx", { "isBackgroundEnabled": false }]
```

### Step 3 — Regenerate native project
```bash
npx expo prebuild --clean --platform ios
npx expo run:ios --configuration Release --device
```
This picks up the new native BLE module and Bluetooth entitlements.

### Step 4 — Create `src/hooks/useBLEScale.ts`
A self-contained hook that owns the `BleManager` lifecycle:
- Instantiates `new BleManager()` once in a `useRef`; calls `manager.destroy()` on unmount
- `startScan()`: calls `manager.startDeviceScan([NUS_SERVICE_UUID], null, callback)`, filters on `device.name === 'ForeverScale'`, stops scan on first match, then connects
- On connect: calls `device.discoverAllServicesAndCharacteristics()`, then subscribes via `device.monitorCharacteristicForService(SERVICE_UUID, TX_UUID, callback)`
- Notification callback: decodes base64 value → UTF-8 string → `parseFloat()` → `setWeightKg()`
- `disconnect()`: calls `device.cancelConnection()`, resets state to `idle`
- Returns: `{ status, weightKg, startScan, disconnect }`

### Step 5 — Create `app/bluetooth-scale.tsx`
A modal screen (lives at root `app/` level, not inside `(tabs)/`, so the root Stack in `app/_layout.tsx` picks it up automatically).

**UI layout:**
```
┌────────────────────────────────┐
│  ← Back         Bluetooth      │
├────────────────────────────────┤
│  Status: Scanning...           │
│                                │
│  ┌──────────────────────────┐  │
│  │        72.5 kg           │  │  ← large, updates live on every notification
│  └──────────────────────────┘  │
│                                │
│  [ Scan for Scale ]            │  ← visible when idle / disconnected
│  [ Disconnect ]                │  ← visible when connected
│                                │
│  [ Save as Measurement ]       │  ← enabled when connected & weightKg > 0
└────────────────────────────────┘
```

- Weight is displayed via `formatWeight(weightKg, profile.weightUnit)` from `src/utils/weight.ts`
- "Save as Measurement" inserts directly into the `measurements` table via Drizzle, populating `weightKg`, `profileId` (from active profile store), and `measuredAt: Date.now()`

### Step 6 — Update `app/(tabs)/_layout.tsx`
Override `headerRight` for the measurements tab to add a Bluetooth icon button alongside the existing `ProfileSwitcher`:

```tsx
<Tabs.Screen
  name="measurements"
  options={{
    title: 'Measurements',
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 }}>
        <Pressable onPress={() => router.push('/bluetooth-scale')}>
          <Ionicons name="bluetooth-outline" size={22} color="#4A90D9" />
        </Pressable>
        <ProfileSwitcher />
      </View>
    ),
  }}
/>
```

---

## Files to Create / Modify

| File | Action |
|---|---|
| `app.json` | Add `react-native-ble-plx` plugin |
| `src/hooks/useBLEScale.ts` | Create — BLE manager hook |
| `app/bluetooth-scale.tsx` | Create — BLE reading screen |
| `app/(tabs)/_layout.tsx` | Add Bluetooth icon to measurements tab header |

---

## Adafruit Feather Firmware (Arduino)

Upload via **Arduino IDE**. Board package: **Adafruit nRF52 by Adafruit**.

**One-time setup:**  
Arduino IDE → Preferences → Additional Boards Manager URLs, add:  
`https://adafruit.github.io/arduino-board-index/package_adafruit_index.json`  
Then: Boards Manager → install **Adafruit nRF52**.

### Simulation sketch (no sensor — start here to verify BLE connection)

```cpp
#include <bluefruit.h>

BLEUart bleuart;
float weight = 60.0;

void setup() {
  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("ForeverScale");

  bleuart.begin();

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(bleuart);
  Bluefruit.Advertising.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244);
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);
}

void loop() {
  if (Bluefruit.connected()) {
    bleuart.println(weight, 2);    // sends e.g. "72.50\r\n"
    weight += 0.1;
    if (weight > 120.0) weight = 60.0;
  }
  delay(500);
}
```

### HX711 load cell sketch (real sensor)

Install the **HX711** library by Rob Tillaart via Arduino Library Manager.  
Adjust `DOUT_PIN`, `CLK_PIN`, and `CALIBRATION_FACTOR` to match your wiring.

```cpp
#include <bluefruit.h>
#include <HX711.h>

#define DOUT_PIN          11
#define CLK_PIN           12
#define CALIBRATION_FACTOR 2280.0   // calibrate with known weight

HX711 scale;
BLEUart bleuart;

void setup() {
  scale.begin(DOUT_PIN, CLK_PIN);
  scale.set_scale(CALIBRATION_FACTOR);
  scale.tare();

  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("ForeverScale");

  bleuart.begin();

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(bleuart);
  Bluefruit.Advertising.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.start(0);
}

void loop() {
  if (Bluefruit.connected() && scale.is_ready()) {
    float weightKg = scale.get_units(5);   // average of 5 readings for stability
    bleuart.println(weightKg, 2);
  }
  delay(500);
}
```

---

## Verification

1. After `expo prebuild --clean` and rebuild, tap the Bluetooth icon on the Measurements tab
2. iOS shows Bluetooth permission prompt → tap Allow
3. Power on Feather running the simulation sketch; tap "Scan for Scale"
4. App finds `"ForeverScale"` → status changes to Connected
5. Weight display updates every 500ms with incrementing values
6. Tap "Save as Measurement" → measurement is stored and visible in the profile's data
7. Tap "Disconnect" → status returns to idle
