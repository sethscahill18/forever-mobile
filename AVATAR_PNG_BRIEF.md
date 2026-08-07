# Avatar PNG Layer Specification

The avatar in the app is composited from three transparent PNG layers stacked on top of each other.
Every layer must share **exactly the same canvas size** so the layers align perfectly.

---

## Canvas specification

| Property | Value |
|----------|-------|
| Width | 400 px |
| Height | 700 px |
| Background | Transparent (PNG with alpha channel) |
| Format | PNG-24 with transparency |

**Position guides:**
- Character's feet sit at the **very bottom** of the canvas (bottom edge, minimal padding)
- Character's head sits in the **top 30%** of the canvas (head center ≈ y 110–140)
- Character is **horizontally centred**
- Leave the head at least 20 px from the top edge

---

## The three layers

### Layer 1 — Body (`body/`)
Everything **except** hair and clothing:
- Head, face, facial features (eyes, eyebrows, nose, mouth, smile)
- Neck, ears
- Hands and wrists
- Bare lower legs / feet (ankles, shoes)
- Anything not covered by hair or clothing

Everything else → **fully transparent**

### Layer 2 — Clothing (`clothing/`)
Just the outfit:
- Top garment (t-shirt, hoodie, dress, shirt) including collar
- Trousers/jeans (for non-dress styles)
- Belt if applicable

The neckline and wrist cuffs should overlap slightly with the body layer so no gap shows.
Everything else → **fully transparent**

### Layer 3 — Hair (`hair/`)
Just the hair:
- All hair strands, volume, and highlights
- Bun, ponytail, or accessory if applicable

Everything else → **fully transparent**

**Stack order in the app:** body → clothing → hair (hair sits on top of everything)

---

## File naming convention

```
assets/avatar/body/{bodyType}_{skinTone}.png
assets/avatar/hair/{hairStyle}_{hairColour}.png
assets/avatar/clothing/{clothingStyle}_{clothingColour}.png
```

### Body type options
| Key | Description |
|-----|-------------|
| `baby` | Very young child, big head relative to body |
| `child` | Young child, ~6–10 years |
| `teenager` | Adolescent, ~11–16 years (matches the designer's image) |
| `adult` | Full adult proportions |

### Skin tone options
| Key | Description |
|-----|-------------|
| `light` | Fair / pale skin |
| `medium` | Mid-range skin tone |
| `dark` | Darker complexion |

### Hair style options
| Key | Description |
|-----|-------------|
| `buzz` | Very short, close to scalp |
| `short_straight` | Short, neat, straight |
| `short_wavy` | Short, slightly messy or wavy |
| `long_straight` | Straight hair past shoulders |
| `curly` | Curly / afro volume |
| `ponytail` | Pulled back ponytail |

### Hair colour options
| Key | Approximate colour |
|-----|-------------------|
| `black` | Very dark black |
| `brown` | Natural brown |
| `auburn` | Reddish-brown |
| `blonde` | Golden blonde |
| `red` | Bright red |
| `grey` | Grey / silver |

### Clothing style options
| Key | Description |
|-----|-------------|
| `tshirt` | Short-sleeved T-shirt + jeans |
| `hoodie` | Hooded sweatshirt + jeans |
| `dress` | A-line dress, no trousers |
| `shirt` | Collared button-down shirt + jeans |

### Clothing colour options
| Key | Approximate colour |
|-----|-------------------|
| `navy` | Dark blue (matches designer's image) |
| `red` | Bright red |
| `green` | Grass green |
| `yellow` | Sunny yellow |
| `purple` | Purple / violet |
| `blue` | Mid blue |
| `grey` | Charcoal grey |

---

## Example file names

```
assets/avatar/body/teenager_medium.png      ← matches the designer's image
assets/avatar/hair/short_straight_brown.png ← matches the designer's image
assets/avatar/clothing/tshirt_navy.png      ← matches the designer's image
```

---

## How the app uses the images

The app stacks all three PNGs using `position: absolute` inside a fixed-size container.
The layers align perfectly because they all share the same 400 × 700 canvas.

For **circular profile thumbnails** (56 dp circles), the app scales the image to fill the 
width of the circle and crops from the top — this naturally shows the face and head.

---

## How to add a new asset

1. Create the PNG file (400 × 700 px, transparent background)
2. Place it in the correct folder under `assets/avatar/`
3. Open `src/components/avatar/avatarAssets.ts`
4. Find the matching section (`BODY_LAYERS`, `HAIR_LAYERS`, or `CLOTHING_LAYERS`)
5. Uncomment (or add) the `require()` line for that file
6. Save — the app will use it immediately on next reload

---

## Recommended order to create first

Start with these 3 files to get the first complete avatar working end-to-end:

| Priority | File | Why |
|----------|------|-----|
| 1 | `body/teenager_medium.png` | Matches the designer's reference |
| 2 | `hair/short_straight_brown.png` | Matches the designer's reference |
| 3 | `clothing/tshirt_navy.png` | Matches the designer's reference |

Once these 3 are in place and added to `avatarAssets.ts`, the 3D avatar will appear 
in the app and replace the SVG placeholder automatically.

---

## Total files needed (full set)

| Layer | Count | Formula |
|-------|-------|---------|
| Body | 12 | 4 types × 3 skin tones |
| Hair | 36 | 6 styles × 6 colours |
| Clothing | 28 | 4 styles × 7 colours |
| **Total** | **76** | Build progressively — start with 3 |
