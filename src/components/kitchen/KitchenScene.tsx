import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Svg, Rect, Line as SvgLine, Text as SvgText, Path, G } from 'react-native-svg';
import { Profile, Measurement } from '../../db/schema';
import { useSettingsStore } from '../../store/settings.store';
import { formatHeight } from '../../utils/weight';

// SVG layer imports
import WallDecorSvg    from '../../../assets/kitchen/wall_decor.svg';
import DoorStyle1Svg   from '../../../assets/kitchen/door_style_1.svg';
import DoorStyle2Svg   from '../../../assets/kitchen/door_style_2.svg';
import DoorStyle3Svg   from '../../../assets/kitchen/door_style_3.svg';
import HandleStyle1Svg from '../../../assets/kitchen/handle_style_1.svg';
import HandleStyle2Svg from '../../../assets/kitchen/handle_style_2.svg';
import HandleStyle3Svg from '../../../assets/kitchen/handle_style_3.svg';
import AvatarBabySvg      from '../../../assets/kitchen/avatar_baby.svg';
import AvatarChildSvg     from '../../../assets/kitchen/avatar_child.svg';
import AvatarTeenagerSvg  from '../../../assets/kitchen/avatar_teenager.svg';
import AvatarAdultSvg     from '../../../assets/kitchen/avatar_adult.svg';
import ShelfSvg           from '../../../assets/kitchen/shelf.svg';
import ShelfRocket1Svg    from '../../../assets/kitchen/shelf_rocket_1.svg';
import ShelfFlowerPotSvg  from '../../../assets/kitchen/shelf_flower_pot.svg';
import ShelfBookSvg       from '../../../assets/kitchen/shelf_book.svg';

// ─── Scene coordinate constants (all SVG assets share viewBox="0 0 390 844") ──
const SCENE_VB     = '0 0 390 844';
const FLOOR_Y      = 720;
const CEIL_Y       = 80;
const MAX_CM       = 210;
const MARK_X1      = 68;
const MARK_X2      = 92;
const MARK_LABEL_X = 62;

// ─── Colour maps ──────────────────────────────────────────────────────────────
const WALL_COLOURS: Record<string, string> = {
  red:   '#FEE2E2',
  blue:  '#DBEAFE',
  green: '#D1FAE5',
};

const DOOR_COLOURS: Record<string, string> = {
  black: '#2D3748',
  brown: '#7B341E',
  red:   '#9B2C2C',
};

// ─── Layer lookup maps ────────────────────────────────────────────────────────
const DOOR_SVGS = {
  style_1: DoorStyle1Svg,
  style_2: DoorStyle2Svg,
  style_3: DoorStyle3Svg,
} as const;

const HANDLE_SVGS = {
  handle_style_1: HandleStyle1Svg,
  handle_style_2: HandleStyle2Svg,
  handle_style_3: HandleStyle3Svg,
} as const;

const AVATAR_SVGS = {
  baby:     AvatarBabySvg,
  child:    AvatarChildSvg,
  teenager: AvatarTeenagerSvg,
  adult:    AvatarAdultSvg,
} as const;

const SHELF_ITEM_SVGS = {
  rocket_1:   ShelfRocket1Svg,
  flower_pot: ShelfFlowerPotSvg,
  book:       ShelfBookSvg,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function heightToY(cm: number): number {
  return FLOOR_Y - (cm / MAX_CM) * (FLOOR_Y - CEIL_Y);
}

function starPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r     = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${pts[0]} L${pts.slice(1).join(' L')} Z`;
}

// Wrapper that handles absolute positioning so SVG components receive only
// pixel dimensions — passing absoluteFillObject directly to an SVG causes
// Yoga to emit bogus constraint sizes (2^47).
function Layer({ children }: { children: React.ReactNode }) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {children}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
interface KitchenSceneProps {
  profile: Profile;
  measurements: Measurement[];
}

export default function KitchenScene({ profile, measurements }: KitchenSceneProps) {
  const primaryUnit = useSettingsStore((s) => s.primaryUnit);
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  const wallFill = WALL_COLOURS[profile.theme]      ?? WALL_COLOURS.red;
  const doorFill = DOOR_COLOURS[profile.doorColour] ?? DOOR_COLOURS.black;

  const DoorSvg      = DOOR_SVGS[profile.doorStyle       as keyof typeof DOOR_SVGS]      ?? DoorStyle1Svg;
  const HandleSvg    = HANDLE_SVGS[profile.handleStyle   as keyof typeof HANDLE_SVGS]    ?? HandleStyle1Svg;
  const AvatarSvg    = AVATAR_SVGS[profile.avatar        as keyof typeof AVATAR_SVGS]    ?? AvatarChildSvg;
  const ShelfItemSvg = SHELF_ITEM_SVGS[profile.shelfItems as keyof typeof SHELF_ITEM_SVGS] ?? ShelfRocket1Svg;

  const newestId     = measurements.length > 0 ? measurements[0].id : null;
  const oldestFirst  = [...measurements].reverse();

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
    >
      {/* Wall base colour — rendered immediately, no size dependency */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: wallFill }]} />

      {/* SVG layers — deferred until we have a real pixel size */}
      {size !== null && (() => {
        const svgDims = { width: size.w, height: size.h, viewBox: SCENE_VB, preserveAspectRatio: 'none' as const };
        return (
          <>
            <Layer><WallDecorSvg {...svgDims} /></Layer>

            <Layer>
              <Svg {...svgDims}>
                <Rect x={95} y={88} width={160} height={632} fill={doorFill} />
              </Svg>
            </Layer>

            <Layer><DoorSvg    {...svgDims} /></Layer>
            <Layer><HandleSvg  {...svgDims} /></Layer>
            <Layer><ShelfSvg   {...svgDims} /></Layer>
            <Layer><ShelfItemSvg {...svgDims} /></Layer>
            <Layer><AvatarSvg  {...svgDims} /></Layer>

            {oldestFirst.length > 0 && (
              <Layer>
                <Svg {...svgDims}>
                  {oldestFirst.map((m) => {
                    const y = heightToY(m.heightCm);
                    if (y < CEIL_Y || y > FLOOR_Y) return null;

                    const isLatest    = m.id === newestId;
                    const isMilestone = m.isMilestone === 1;
                    const lineColour  = isMilestone ? '#D69E2E' : '#8B6914';
                    const labelColour = isMilestone ? '#C07700' : '#5D4037';
                    const x2          = isMilestone ? MARK_X2 + 8 : MARK_X2;
                    const label       = primaryUnit === 'ft' && m.heightFt != null && m.heightIn != null
                      ? `${m.heightFt}'${m.heightIn}"`
                      : formatHeight(m.heightCm, primaryUnit);

                    return (
                      <G key={m.id}>
                        <SvgLine
                          x1={MARK_X1} y1={y} x2={x2} y2={y}
                          stroke={lineColour} strokeWidth={isLatest ? 2.5 : 1.5}
                        />
                        {isMilestone && (
                          <Path d={starPath(x2 + 7, y, 5, 2.2)} fill="#D69E2E" />
                        )}
                        <SvgText
                          x={MARK_LABEL_X} y={y - 3}
                          fontSize={9} fill={labelColour} textAnchor="end"
                          fontWeight={isLatest || isMilestone ? '700' : '400'}
                        >
                          {label}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </Layer>
            )}
          </>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: StyleSheet.absoluteFillObject,
});
