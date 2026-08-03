# Kitchen Scene — Designer Brief

This document describes everything you need to know to deliver the final SVG artwork for the kitchen scene displayed in the "Forever" app. Each profile has a personalised kitchen door scene that shows a growth chart. Height measurements are drawn as marks on the door frame by the app.

---

## How the scene works

The scene is built from **individual SVG layers** that the app stacks in z-order. When you update a file, the app automatically picks it up — no code changes needed.

The app draws:
- The wall background colour (from the profile's **theme**)
- The door panel colour (from the profile's **doorColour**)
- Height measurement marks on the left side of the door frame (drawn in code)

Everything else comes from your SVG files.

---

## Critical SVG requirements

### 1. Shared viewBox — every file must use exactly this value
```
viewBox="0 0 390 844"
```
All layers must share this coordinate space. If they differ, elements won't align.

### 2. Coordinate anchors
The app positions height marks using two Y values within the viewBox. The door frame in your artwork must align with these constants:

| Constant | Value | Meaning |
|----------|-------|---------|
| `FLOOR_Y` | `720` | Y coordinate of the floor (0 cm mark) |
| `CEIL_Y`  | `80`  | Y coordinate of the top of the door frame (~210 cm) |

The app uses the formula: `y = 720 − (heightCm / 210) × (720 − 80)`

If you adjust the door position, tell the developer the new `FLOOR_Y` and `CEIL_Y` values.

### 3. No parametric fill required in SVG files
Wall colour and door panel colour are rendered as separate coloured rectangles by the app. **Do not include wall fill or door panel fill in your SVGs** — leave those areas transparent. Your SVGs should only contain:
- Structural elements (door frame, rails, stiles)
- Decorative elements (shelf, handles, avatars, shelf items)
- Floor and baseboard strips (in `wall_decor.svg`)

### 4. No embedded fonts
Convert all text to paths. The app doesn't load external fonts inside SVGs.

### 5. Clean SVG output
- No `<style>` blocks or CSS classes — use inline attributes only
- No embedded raster images inside the SVG files
- No external `href` or `xlink:href` references

---

## Door geometry (for reference)

The current placeholder uses these coordinates. You may change them, but tell the developer if you do.

| Element | x | y | width | height |
|---------|---|---|-------|--------|
| Door outer frame | 85 | 78 | 180 | 644 |
| Door inner panel (coloured by app) | 95 | 88 | 160 | 632 |
| Left stile | 85 | 78 | 10 | 644 |
| Right stile | 255 | 78 | 10 | 644 |
| Top rail | 85 | 78 | 180 | 10 |
| Bottom rail | 85 | 716 | 180 | 6 |

Height marks are drawn at `x = 68–92` (left of and into the left stile). Allow visible space in that zone.

Avatar silhouettes are positioned at approximately `x = 278–345` (right of the door frame).

---

## Files to deliver

Place all files in `assets/kitchen/`. The current placeholder files can be overwritten directly.

### Wall decoration
| File | Contents | Colour notes |
|------|----------|-------------|
| `wall_decor.svg` | Floor strip, baseboard left and right of door, any wall texture | Floor/baseboard can use fixed colours — the app sets the wall fill separately |

### Door styles (3 variants)
| File | Description |
|------|-------------|
| `door_style_1.svg` | Plain panel door — frame only, no interior rails |
| `door_style_2.svg` | Two-panel door — frame + single horizontal rail at mid-height |
| `door_style_3.svg` | Four-panel door — frame + vertical centre divider + horizontal rail |

**Important:** Leave the interior door panel area transparent. The app fills it with the chosen door colour.

### Door handles (3 variants)
| File | Description |
|------|-------------|
| `handle_style_1.svg` | Round door knob — positioned on the right edge of the door at mid-height |
| `handle_style_2.svg` | Lever handle |
| `handle_style_3.svg` | Bar/pull handle |

### Avatar silhouettes (4 sizes)
Avatars stand to the **right** of the door frame (`x ≈ 278–345`). Size each proportionally to the character's height, with their feet at `FLOOR_Y = 720`.

| File | Character | Approximate height |
|------|-----------|-------------------|
| `avatar_baby.svg` | Baby | ~70 cm |
| `avatar_child.svg` | Child | ~110 cm |
| `avatar_teenager.svg` | Teenager | ~155 cm |
| `avatar_adult.svg` | Adult | ~175 cm |

### Shelf and items
| File | Description |
|------|-------------|
| `shelf.svg` | Wall-mounted shelf, positioned to the right of the door at approximately `y = 154–168` |
| `shelf_rocket_1.svg` | Rocket toy sitting on the shelf |
| `shelf_flower_pot.svg` | Flower pot sitting on the shelf |
| `shelf_book.svg` | Book sitting on the shelf |

---

## Summary of all files (15 total)

```
assets/kitchen/
  wall_decor.svg
  door_style_1.svg
  door_style_2.svg
  door_style_3.svg
  handle_style_1.svg
  handle_style_2.svg
  handle_style_3.svg
  avatar_baby.svg
  avatar_child.svg
  avatar_teenager.svg
  avatar_adult.svg
  shelf.svg
  shelf_rocket_1.svg
  shelf_flower_pot.svg
  shelf_book.svg
```

---

## Handoff

Drop the SVG files into `assets/kitchen/` and overwrite the placeholders. The app will immediately use the new artwork without any code changes. If you change the door position or the `FLOOR_Y`/`CEIL_Y` anchors, let the developer know the new Y values so the height marks stay aligned.
