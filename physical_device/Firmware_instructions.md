Yes. In fact, your current Forever Measure firmware is already most of the way there.
The intended flow should be:
NFC sticker → app identifies theme → app connects to Forever Measure over BLE → app sends RGB command → Forever Measure changes the illuminated button colour.
Your NFC tag currently contains the theme/artwork identifier in the format we set up, for example:
FM|1|ART|001
The app can map ART|001 to a theme definition such as:
const themes = {
  "001": {
    name: "Theme 1",
    rgb: [255, 80, 0]
  },
  "002": {
    name: "Theme 2",
    rgb: [40, 180, 255]
  }
};
Then, once the NFC tag has been scanned, the app sends this over BLE:
rgb 255 80 0\n
The important part is the \n on the end.
Your current firmware already accepts exactly this command over BLE. You have a BLEUart bleuart, checkBleCommands() passes received BLE text into the same command processor as USB Serial and processRgbCommand() already understands:
rgb red
rgb green
rgb blue
rgb orange
rgb 255 80 0
So you don't actually need to add a new RGB protocol to the firmware.
The BLE connection is the Nordic UART Service that your existing BLEUart uses. The app writes to:
Service:
6E400001-B5A3-F393-E0A9-E50E24DCCA9E

Write characteristic:
6E400002-B5A3-F393-E0A9-E50E24DCCA9E
Adafruit's BLE UART implementation uses this service specifically to let the phone send data to the peripheral.
Since your app is React Native with react-native-ble-plx, the core of it would look roughly like this:
import { Buffer } from "buffer";

const UART_SERVICE =
  "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";

const UART_WRITE =
  "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";

async function setForeverMeasureColour(device, r, g, b) {
  const command = `rgb ${r} ${g} ${b}\n`;
  const encoded = Buffer.from(command, "utf8").toString("base64");

  await device.writeCharacteristicWithResponseForService(
    UART_SERVICE,
    UART_WRITE,
    encoded
  );
}
Then the NFC handler effectively does:
const artworkId = "001"; // extracted from NFC tag

const theme = themes[artworkId];

await setForeverMeasureColour(
  connectedForeverMeasure,
  theme.rgb[0],
  theme.rgb[1],
  theme.rgb[2]
);
So from the user's perspective:
Scan NFC door
      ↓
App reads FM|1|ART|001
      ↓
App selects ART 001 theme
      ↓
App connects to "ForeverMeasure"
      ↓
App sends "rgb 255 80 0\n"
      ↓
Button immediately turns orange
There are two things I would change in the firmware before considering this finished.
First, your new 2-minute sleep system currently stops calling checkBleCommands() while asleep. BLE itself can remain alive, but a colour command received while the screen is asleep won't actually be processed until the user moves the tape or presses the button. We should change that so an incoming app command can wake the Forever Measure and immediately change the colour.
Second, the selected RGB colour currently lives only in RAM. The code starts each boot with:
uint8_t buttonLedR = 0;
uint8_t buttonLedG = 0;
uint8_t buttonLedB = 255;
So a complete power cycle returns the button to blue.
For the product, I'd make the app's NFC scan authoritative: whenever a door is scanned, it sends that door's colour to the device. I'd also have the device store the last received RGB values in flash, so it boots in the last selected theme even before the app reconnects.
I'd also have the device respond with something like:
RGB_OK,255,80,0
so the app knows the command really reached the Forever Measure rather than assuming the BLE write worked.
That would give you a fairly robust chain: NFC determines theme → app controls both its own artwork and Forever Measure RGB → device remembers that colour.
