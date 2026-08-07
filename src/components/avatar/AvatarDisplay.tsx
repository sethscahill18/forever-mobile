import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import Svg, { Circle, Ellipse, Rect, Path, G } from 'react-native-svg';
import { AvatarConfig, BodyType } from './types';
import {
  COMPLETE_AVATARS,
  BODY_LAYERS, HAIR_LAYERS, CLOTHING_LAYERS,
  BODY_TYPE_SCALE,
  skinToneKey, hairColourKey, clothingColourKey,
  CANVAS_ASPECT, HEAD_CENTER_FRACTION,
} from './avatarAssets';

interface AvatarDisplayProps {
  config: AvatarConfig;
  /** Overall height in dp. Full-body width = size × CANVAS_ASPECT; compact = size × size. */
  size: number;
  /** When true, renders as a square frame cropped to show the head (for circular thumbnails). */
  compact?: boolean;
}

export function AvatarDisplay({ config, size, compact = false }: AvatarDisplayProps) {
  // 1. Complete pre-rendered PNG — highest priority
  if (config.avatarId) {
    const found = COMPLETE_AVATARS.find((a) => a.id === config.avatarId);
    if (found) {
      // Scale full-body display by body type so babies look smaller than teenagers.
      // Compact (circular thumbnail) is unscaled — the face always fills the circle.
      const displaySize = compact
        ? size
        : size * (BODY_TYPE_SCALE[found.bodyType] ?? 1);
      return <SinglePNGAvatar source={found.source} size={displaySize} compact={compact} />;
    }
  }

  // 2. Layer-composited PNG (when all three layers exist for this config)
  const bodyKey    = `${config.bodyType}_${skinToneKey(config.skinTone)}`;
  const hairKey    = `${config.hairStyle}_${hairColourKey(config.hairColour)}`;
  const clothingKey = `${config.clothingStyle}_${clothingColourKey(config.clothingColour)}`;

  const bodySource    = BODY_LAYERS[bodyKey]     ?? null;
  const hairSource    = HAIR_LAYERS[hairKey]     ?? null;
  const clothingSource = CLOTHING_LAYERS[clothingKey] ?? null;

  // Switch to PNG only when all three layers exist for this exact combination.
  // If any layer is missing we fall back to SVG so nothing looks half-rendered.
  if (bodySource && hairSource && clothingSource) {
    return (
      <PNGAvatar
        bodySource={bodySource}
        hairSource={hairSource}
        clothingSource={clothingSource}
        size={size}
        compact={compact}
      />
    );
  }

  return <SVGAvatar config={config} size={size} compact={compact} />;
}

// ── Single complete PNG (pre-rendered full character) ─────────────────────────

function SinglePNGAvatar({
  source, size, compact,
}: {
  source: ImageSourcePropType; size: number; compact: boolean;
}) {
  if (compact) {
    const imgW      = size;
    const imgH      = size / CANVAS_ASPECT;
    const topOffset = size / 2 - HEAD_CENTER_FRACTION * imgH;
    return (
      <View style={{ width: size, height: size, overflow: 'hidden' }}>
        <Image
          source={source}
          style={{ position: 'absolute', top: topOffset, width: imgW, height: imgH }}
        />
      </View>
    );
  }
  const displayW = size * CANVAS_ASPECT;
  return (
    <View style={{ width: displayW, height: size }}>
      <Image source={source} style={StyleSheet.absoluteFill} resizeMode="contain" />
    </View>
  );
}

// ── PNG layer compositor ──────────────────────────────────────────────────────

function PNGAvatar({
  bodySource, hairSource, clothingSource, size, compact,
}: {
  bodySource:     ImageSourcePropType;
  hairSource:     ImageSourcePropType;
  clothingSource: ImageSourcePropType;
  size:    number;
  compact: boolean;
}) {
  if (compact) {
    // Scale the full-body PNG so its width fills the container, then offset
    // vertically so the head is centred within the square.
    const imgW = size;
    const imgH = size / CANVAS_ASPECT;
    // topOffset positions the image so HEAD_CENTER_FRACTION of imgH lands at size/2
    const topOffset = size / 2 - HEAD_CENTER_FRACTION * imgH;
    const layerStyle = {
      position: 'absolute' as const,
      top: topOffset,
      width: imgW,
      height: imgH,
    };
    return (
      <View style={{ width: size, height: size, overflow: 'hidden' }}>
        <Image source={bodySource}     style={layerStyle} />
        <Image source={clothingSource} style={layerStyle} />
        <Image source={hairSource}     style={layerStyle} />
      </View>
    );
  }

  // Full-body view — width proportional to canvas aspect ratio
  const displayW = size * CANVAS_ASPECT;
  return (
    <View style={{ width: displayW, height: size }}>
      <Image source={bodySource}     style={StyleSheet.absoluteFill} resizeMode="contain" />
      <Image source={clothingSource} style={StyleSheet.absoluteFill} resizeMode="contain" />
      <Image source={hairSource}     style={StyleSheet.absoluteFill} resizeMode="contain" />
    </View>
  );
}

// ── SVG fallback (rendered while PNG assets are being created) ────────────────

// Body proportions — all values in viewBox "0 0 60 100" space
// hx/hy = head center, hr = head radius
// sy = shoulder Y, shw = shoulder half-width
// wy = waist Y, lby = leg bottom Y
const BODY: Record<BodyType, {
  hx: number; hy: number; hr: number;
  sy: number; shw: number; wy: number; lby: number;
}> = {
  baby:     { hx: 30, hy: 20, hr: 16, sy: 44, shw: 13, wy: 74, lby: 90 },
  child:    { hx: 30, hy: 18, hr: 13, sy: 38, shw: 16, wy: 72, lby: 96 },
  teenager: { hx: 30, hy: 16, hr: 11, sy: 34, shw: 18, wy: 74, lby: 99 },
  adult:    { hx: 30, hy: 15, hr: 10, sy: 30, shw: 20, wy: 76, lby: 99 },
};

const PANTS_COLOUR = '#3D4E63';

function SVGAvatar({ config, size, compact }: { config: AvatarConfig; size: number; compact: boolean }) {
  const b = BODY[config.bodyType];
  const { hx, hy, hr, sy, shw, wy, lby } = b;

  const SL = hx - shw;
  const SR = hx + shw;
  const WL = hx - (shw - 2);
  const WR = hx + (shw - 2);
  const L  = hx - hr;
  const R  = hx + hr;

  const neckLeft = hx - hr * 0.22;
  const neckW    = hr * 0.44;
  const neckTop  = hy + hr * 0.9;
  const neckH    = Math.max(0, sy - neckTop);

  const earR = hr * 0.32;
  const HL   = hy - hr * 0.55;
  const EY   = hy - hr * 0.28;
  const exL  = hx - hr * 0.32;
  const exR  = hx + hr * 0.32;
  const eRx  = hr * 0.20;
  const eRy  = hr * 0.28;
  const NY   = hy + hr * 0.10;
  const MY   = hy + hr * 0.32;

  const skin  = config.skinTone;
  const hair  = config.hairColour;
  const cloth = config.clothingColour;
  const isDress = config.clothingStyle === 'dress';
  const isCurly = config.hairStyle === 'curly';

  function hairFrontPaths(): string[] {
    switch (config.hairStyle) {
      case 'buzz':
        return [`M ${L+5} ${HL+4} C ${L+3} ${T()} ${R-3} ${T()} ${R-5} ${HL+4} Q ${hx} ${HL+2} ${L+5} ${HL+4} Z`];
      case 'short_straight':
        return [`M ${L} ${HL+2} C ${L-2} ${T()} ${R+2} ${T()} ${R} ${HL+2} Q ${hx} ${HL} ${L} ${HL+2} Z`];
      case 'short_wavy':
        return [
          `M ${L} ${HL+2} ` +
          `C ${L-2} ${T()} ${R+2} ${T()} ${R} ${HL+2} ` +
          `C ${R-hr*0.15} ${HL+5} ${hx+hr*0.15} ${HL+1} ${hx} ${HL+3} ` +
          `C ${hx-hr*0.15} ${HL+5} ${L+hr*0.15} ${HL+2} ${L} ${HL+2} Z`,
        ];
      case 'long_straight':
        return [
          `M ${L} ${HL+2} C ${L-2} ${T()} ${R+2} ${T()} ${R} ${HL+2} Q ${hx} ${HL} ${L} ${HL+2} Z`,
          `M ${L-1} ${hy} Q ${L-3} ${hy+25} ${L-1} ${hy+55} L ${L+5} ${hy+55} Q ${L+4} ${hy+25} ${L+4} ${hy} Z`,
          `M ${R+1} ${hy} Q ${R+3} ${hy+25} ${R+1} ${hy+55} L ${R-5} ${hy+55} Q ${R-4} ${hy+25} ${R-4} ${hy} Z`,
        ];
      case 'ponytail':
        return [
          `M ${L+2} ${HL+2} C ${L} ${T()} ${R} ${T()} ${R-2} ${HL+2} Q ${hx} ${HL} ${L+2} ${HL+2} Z`,
          `M ${R-2} ${hy-2} Q ${R+8} ${hy+2} ${R+6} ${hy+hr+8} L ${R+2} ${hy+hr+8} Q ${R+4} ${hy+2} ${R-3} ${hy-3} Z`,
        ];
      default:
        return [];
    }
  }

  function T() { return hy - hr; }

  function clothingShapes(): { d: string; fill: string }[] {
    const sleevL = `M ${SL} ${sy} L ${SL-7} ${sy+9} L ${SL-4} ${sy+15} L ${SL+4} ${sy+6} Z`;
    const sleevR = `M ${SR} ${sy} L ${SR+7} ${sy+9} L ${SR+4} ${sy+15} L ${SR-4} ${sy+6} Z`;
    const body   = `M ${SL} ${sy} L ${SR} ${sy} L ${WR} ${wy} L ${WL} ${wy} Z`;
    switch (config.clothingStyle) {
      case 'tshirt':
        return [{ d: body, fill: cloth }, { d: sleevL, fill: cloth }, { d: sleevR, fill: cloth }];
      case 'hoodie':
        return [
          { d: `M ${SL-2} ${sy+4} C ${SL-4} ${hy-hr} ${SR+4} ${hy-hr} ${SR+2} ${sy+4} L ${SR} ${sy} L ${SL} ${sy} Z`, fill: cloth },
          { d: body, fill: cloth }, { d: sleevL, fill: cloth }, { d: sleevR, fill: cloth },
        ];
      case 'dress':
        return [
          { d: `M ${SL} ${sy} L ${SR} ${sy} L ${SR+10} ${lby} L ${SL-10} ${lby} Z`, fill: cloth },
          { d: sleevL, fill: cloth }, { d: sleevR, fill: cloth },
        ];
      case 'shirt':
        return [
          { d: body, fill: cloth }, { d: sleevL, fill: cloth }, { d: sleevR, fill: cloth },
          { d: `M ${hx-4} ${sy} L ${hx} ${sy+8} L ${hx+4} ${sy} Z`, fill: 'white' },
        ];
      default:
        return [];
    }
  }

  const svgW    = compact ? size : size * 0.6;
  const svgH    = size;
  const vBox    = compact ? '0 0 60 60' : '0 0 60 100';
  const hFront  = hairFrontPaths();
  const clothes = clothingShapes();

  return (
    <View style={{ width: svgW, height: svgH }}>
      <Svg width={svgW} height={svgH} viewBox={vBox}>
        {!isDress && (
          <G>
            <Rect x={WL}   y={wy} width={hx - WL - 2} height={lby - wy} rx={2} fill={PANTS_COLOUR} />
            <Rect x={hx+2} y={wy} width={WR - hx - 2} height={lby - wy} rx={2} fill={PANTS_COLOUR} />
          </G>
        )}
        {clothes.map((s, i) => <Path key={i} d={s.d} fill={s.fill} />)}
        <Rect x={neckLeft} y={neckTop} width={neckW} height={neckH} rx={neckW / 2} fill={skin} />
        <Circle cx={hx} cy={hy} r={hr} fill={skin} />
        <Circle cx={L}  cy={hy} r={earR} fill={skin} />
        <Circle cx={R}  cy={hy} r={earR} fill={skin} />
        {isCurly ? (
          <G>
            <Circle cx={hx}          cy={hy - hr * 0.55} r={hr * 0.62} fill={hair} />
            <Circle cx={hx - hr*0.6} cy={hy - hr * 0.55} r={hr * 0.56} fill={hair} />
            <Circle cx={hx + hr*0.6} cy={hy - hr * 0.55} r={hr * 0.56} fill={hair} />
            <Circle cx={hx - hr}     cy={hy - hr * 0.2}  r={hr * 0.50} fill={hair} />
            <Circle cx={hx + hr}     cy={hy - hr * 0.2}  r={hr * 0.50} fill={hair} />
          </G>
        ) : (
          hFront.map((d, i) => <Path key={i} d={d} fill={hair} />)
        )}
        {config.hairStyle === 'ponytail' && (
          <Circle cx={R + 2} cy={hy - 1} r={hr * 0.13} fill="#333" />
        )}
        <Ellipse cx={exL} cy={EY} rx={eRx} ry={eRy} fill="white" />
        <Ellipse cx={exR} cy={EY} rx={eRx} ry={eRy} fill="white" />
        <Circle cx={exL} cy={EY + eRy * 0.12} r={eRx * 0.70} fill="#1A1A1A" />
        <Circle cx={exR} cy={EY + eRy * 0.12} r={eRx * 0.70} fill="#1A1A1A" />
        <Circle cx={exL - eRx*0.25} cy={EY - eRy*0.22} r={eRx * 0.28} fill="white" />
        <Circle cx={exR - eRx*0.25} cy={EY - eRy*0.22} r={eRx * 0.28} fill="white" />
        <Path
          d={`M ${hx-hr*0.42} ${HL+1} Q ${hx-hr*0.2} ${HL-1} ${hx-hr*0.02} ${HL+1}`}
          stroke="#3D2B1F" strokeWidth={hr * 0.12} fill="none" strokeLinecap="round"
        />
        <Path
          d={`M ${hx+hr*0.02} ${HL+1} Q ${hx+hr*0.2} ${HL-1} ${hx+hr*0.42} ${HL+1}`}
          stroke="#3D2B1F" strokeWidth={hr * 0.12} fill="none" strokeLinecap="round"
        />
        <Circle cx={hx - hr*0.1} cy={NY} r={hr * 0.07} fill="#C97D60" />
        <Circle cx={hx + hr*0.1} cy={NY} r={hr * 0.07} fill="#C97D60" />
        <Path
          d={`M ${hx-hr*0.3} ${MY} Q ${hx} ${MY+hr*0.25} ${hx+hr*0.3} ${MY}`}
          stroke="#C0392B" strokeWidth={hr * 0.10} fill="none" strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
