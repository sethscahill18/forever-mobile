#include <Wire.h>
#include <bluefruit.h>
#include <Adafruit_seesaw.h>
#include <seesaw_neopixel.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>

// -------------------- OLED setup --------------------

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDR 0x3C

Adafruit_SH1106G display = Adafruit_SH1106G(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);

bool oledOK = false;

// -------------------- Encoder setup --------------------

#define ENCODER_ADDR 0x36

Adafruit_seesaw encoder;
bool encoderOK = false;

// -------------------- BLE setup --------------------

BLEUart bleuart;

unsigned long lastBleSendMs = 0;

// 200 ms = 5 updates per second.
// This is smoother for the Bluefruit Connect Plotter.
const unsigned long bleSendIntervalMs = 200;

// -------------------- Measurement setup --------------------

// Calibration value:
// 1 encoder count = 6.4 mm of tape movement.
float mmPerCount = 6.4;

// First 20 mm / 2 cm of tape movement is ignored.
float startOffsetMm = 20.0;

int32_t zeroPosition = 0;
int32_t latestCountsFromZero = 0;

float latestRawHeightMm = 0.0;
float latestHeightMm = 0.0;
float latestHeightCm = 0.0;

// -------------------- BLE callbacks --------------------

void connect_callback(uint16_t conn_handle) {
  (void) conn_handle;

  Serial.println("BLE connected");

  if (oledOK) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("Forever Measure");
    display.println("BLE connected");
    display.display();
  }
}

void disconnect_callback(uint16_t conn_handle, uint8_t reason) {
  (void) conn_handle;
  (void) reason;

  Serial.println("BLE disconnected");

  if (oledOK) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("Forever Measure");
    display.println("BLE disconnected");
    display.display();
  }
}

// -------------------- BLE setup functions --------------------

void startAdv() {
  Serial.println("Starting BLE advertising...");

  Bluefruit.Advertising.clearData();
  Bluefruit.ScanResponse.clearData();

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();

  // Advertise Nordic UART service
  Bluefruit.Advertising.addService(bleuart);

  // Show device name in scan response
  Bluefruit.ScanResponse.addName();

  // Restart advertising automatically after disconnect
  Bluefruit.Advertising.restartOnDisconnect(true);

  // Advertising interval
  Bluefruit.Advertising.setInterval(32, 244);

  // Fast advertising timeout in seconds
  Bluefruit.Advertising.setFastTimeout(30);

  // 0 = advertise forever
  Bluefruit.Advertising.start(0);

  Serial.println("BLE advertising started");
}

void setupBLE() {
  Serial.println("Initialising Bluefruit...");

  Bluefruit.begin();

  // Reasonable prototype transmit power
  Bluefruit.setTxPower(4);

  // Name shown in Bluefruit Connect
  Bluefruit.setName("ForeverMeasure");

  Bluefruit.Periph.setConnectCallback(connect_callback);
  Bluefruit.Periph.setDisconnectCallback(disconnect_callback);

  // Start BLE UART service
  bleuart.begin();

  startAdv();

  Serial.println("BLE setup complete");
}

// -------------------- Measurement --------------------

void updateMeasurement() {
  if (!encoderOK) {
    latestCountsFromZero = 0;
    latestRawHeightMm = 0.0;
    latestHeightMm = 0.0;
    latestHeightCm = 0.0;
    return;
  }

  int32_t rawPosition = encoder.getEncoderPosition();
  latestCountsFromZero = rawPosition - zeroPosition;

  // Convert encoder counts into raw tape movement
  latestRawHeightMm = latestCountsFromZero * mmPerCount;

  // Apply 20 mm / 2 cm offset
  latestHeightMm = latestRawHeightMm - startOffsetMm;

  // Prevent negative readings
  if (latestHeightMm < 0) {
    latestHeightMm = 0;
  }

  latestHeightCm = latestHeightMm / 10.0;
}

// -------------------- BLE send --------------------

void sendBleMeasurement() {
  if (!Bluefruit.connected()) {
    return;
  }

  unsigned long now = millis();

  if (now - lastBleSendMs < bleSendIntervalMs) {
    return;
  }

  lastBleSendMs = now;

  // Send only a numeric value so Bluefruit Connect Plotter can graph it.
  // No "cm", no JSON, no labels.
  bleuart.println(latestHeightCm, 1);

  Serial.print("Sent BLE plot value: ");
  Serial.println(latestHeightCm, 1);
}

// -------------------- OLED display --------------------

void updateDisplay() {
  if (!oledOK) {
    return;
  }

  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Forever Measure");

  display.setCursor(0, 12);
  if (Bluefruit.connected()) {
    display.println("BLE: Connected");
  } else {
    display.println("BLE: Advertising");
  }

  display.setCursor(0, 24);
  if (encoderOK) {
    display.print("Counts: ");
    display.println(latestCountsFromZero);
  } else {
    display.println("Encoder: not found");
  }

  display.setTextSize(2);
  display.setCursor(0, 40);
  display.print(latestHeightCm, 1);
  display.println("cm");

  display.display();
}

// -------------------- Setup --------------------

void setup() {
  Serial.begin(115200);

  // Wait briefly for Serial Monitor, but do not get stuck when running from battery.
  unsigned long startTime = millis();
  while (!Serial && millis() - startTime < 3000) {
    delay(10);
  }

  Serial.println();
  Serial.println("=================================");
  Serial.println("Forever Measure BLE plotter sketch");
  Serial.println("=================================");

  Serial.println("Starting I2C...");
  Wire.begin();
  Serial.println("I2C started");

  // Start OLED
  Serial.println("Starting OLED...");
  oledOK = display.begin(OLED_ADDR, true);

  if (oledOK) {
    Serial.println("OLED OK");

    display.clearDisplay();
    display.setTextColor(SH110X_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("Forever Measure");
    display.println("OLED OK");
    display.display();
  } else {
    Serial.println("OLED NOT FOUND - continuing anyway");
  }

  delay(500);

  // Start encoder
  Serial.println("Starting encoder...");
  encoderOK = encoder.begin(ENCODER_ADDR);

  if (encoderOK) {
    Serial.println("Encoder OK");

    // Set current position as zero.
    zeroPosition = encoder.getEncoderPosition();
  } else {
    Serial.println("Encoder NOT FOUND - continuing anyway");
  }

  delay(500);

  // Start Bluetooth
  setupBLE();

  if (oledOK) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("Forever Measure");
    display.println("BLE advertising");
    display.println("Plotter ready");
    display.display();
  }

  Serial.println("Setup complete");
}

// -------------------- Loop --------------------

void loop() {
  updateMeasurement();

  Serial.print("Loop running | BLE: ");
  Serial.print(Bluefruit.connected() ? "connected" : "advertising");
  Serial.print(" | Height cm: ");
  Serial.print(latestHeightCm, 1);
  Serial.print(" | Counts: ");
  Serial.print(latestCountsFromZero);
  Serial.print(" | Encoder OK: ");
  Serial.println(encoderOK ? "yes" : "no");

  updateDisplay();
  sendBleMeasurement();

  delay(100);
}