#include <Wire.h>
#include <Adafruit_seesaw.h>
#include <seesaw_neopixel.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>

// -------------------- OLED setup --------------------

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

// Most 1.3" 128x64 I2C OLEDs use SH1106.
// I2C address is usually 0x3C.
#define OLED_ADDR 0x3C

Adafruit_SH1106G display = Adafruit_SH1106G(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);

// -------------------- Encoder setup --------------------

#define ENCODER_ADDR 0x36

Adafruit_seesaw encoder;

// -------------------- Measurement setup --------------------

// Start with a simple calibration value.
// Change this once you know how many encoder counts equal a real distance.
float mmPerCount = 6.5;

// First 20 mm / 2 cm of tape movement is ignored.
float startOffsetMm = 20.0;

// Stores the encoder zero position.
int32_t zeroPosition = 0;

// -------------------- Setup --------------------

void setup() {
  Serial.begin(115200);

  // Wait briefly for Serial Monitor, but do not get stuck when running from battery.
  unsigned long startTime = millis();
  while (!Serial && millis() - startTime < 1500) {
    delay(10);
  }

  Serial.println("Forever Measure encoder + OLED test");

  Wire.begin();

  // Start OLED
  if (!display.begin(OLED_ADDR, true)) {
    Serial.println("OLED not found. Check wiring/address.");

    // If OLED is not found, stop here.
    // This will only be visible on Serial when USB is connected.
    while (1) {
      delay(10);
    }
  }

  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Forever Measure");
  display.println("OLED OK");
  display.display();
  delay(1000);

  // Start encoder
  if (!encoder.begin(ENCODER_ADDR)) {
    Serial.println("Encoder not found. Check wiring/address.");

    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("Encoder not found");
    display.println("Check wiring");
    display.display();

    while (1) {
      delay(10);
    }
  }

  Serial.println("Encoder OK");

  // Set current encoder position as zero.
  zeroPosition = encoder.getEncoderPosition();

  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Forever Measure");
  display.println("Encoder OK");
  display.println("Ready");
  display.display();
  delay(1000);
}

// -------------------- Main loop --------------------

void loop() {
  int32_t rawPosition = encoder.getEncoderPosition();
  int32_t countsFromZero = rawPosition - zeroPosition;

  // Raw measured tape movement
  float rawHeightMm = countsFromZero * mmPerCount;

  // Ignore the first 20 mm / 2 cm of movement
  float heightMm = rawHeightMm - startOffsetMm;

  // Prevent negative readings
  if (heightMm < 0) {
    heightMm = 0;
  }

  float heightCm = heightMm / 10.0;

  // Serial debug output - useful when plugged into USB
  Serial.print("Raw: ");
  Serial.print(rawPosition);
  Serial.print("  Counts: ");
  Serial.print(countsFromZero);
  Serial.print("  Raw mm: ");
  Serial.print(rawHeightMm);
  Serial.print("  Height mm: ");
  Serial.println(heightMm);

  // OLED display output
  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Forever Measure");

  display.setCursor(0, 14);
  display.print("Counts: ");
  display.println(countsFromZero);

  display.setTextSize(2);
  display.setCursor(0, 30);
  display.print(heightCm, 1);
  display.println("cm");

  display.setTextSize(1);
  display.setCursor(0, 56);
  display.println("Rotate encoder");

  display.display();

  delay(100);
}