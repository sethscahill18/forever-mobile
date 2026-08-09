import React from 'react';
import { View, StyleSheet, useWindowDimensions, Text } from 'react-native';
import Svg, { Line as SvgLine, Text as SvgText, G } from 'react-native-svg';
import { Measurement, Profile } from '../../db/schema';
import { buildAvatarConfig } from '../avatar/types';
import { AvatarDisplay } from '../avatar/AvatarDisplay';

interface Props {
  profile:      Profile;
  measurements: Measurement[];
  primaryUnit:  'cm' | 'ft';
  paneHeight:   number;
}

const MAX_CM = 200;
const CARD_H  = 48;
const MONTHS  = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function ordinalSuffix(d: number): string {
  if (d >= 11 && d <= 13) return 'th';
  switch (d % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatDate(ts: number): string {
  const d   = new Date(ts);
  const day = d.getDate();
  return `${day}${ordinalSuffix(day)} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function cmLabel(m: Measurement, unit: 'cm' | 'ft'): string {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null) {
    return `${m.heightFt}'${Math.round(m.heightIn)}"`;
  }
  return String(Math.round(m.heightCm));
}

export function RulerSection({ profile, measurements, primaryUnit, paneHeight }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const w = screenWidth / 3;   // matches rulerPane width:'33.33%'
  const h = paneHeight;
  if (h === 0) return null;

  const avatarConfig = buildAvatarConfig(profile);

  const RULER_X   = Math.round(w * 0.36);  // number label anchor
  const TICK_X    = Math.round(w * 0.48);  // tick mark centre
  const FLOOR_Y   = h * 0.87;
  const CEIL_Y    = h * 0.02;
  const CARD_LEFT = TICK_X + 10;
  const CARD_W    = w - CARD_LEFT - 6;

  function heightToY(cm: number): number {
    return FLOOR_Y - (cm / MAX_CM) * (FLOOR_Y - CEIL_Y);
  }

  const newestId = measurements.length > 0 ? measurements[0].id : null;
  const latestM  = measurements.length > 0 ? measurements[0] : null;

  // Graduation marks every 20 cm
  const GRAD_STEP = 20;
  const gradMarks: number[] = [];
  for (let cm = GRAD_STEP; cm <= 200; cm += GRAD_STEP) gradMarks.push(cm);

  // Fine ticks every 2 cm (excluding 20cm multiples which are drawn separately)
  const fineTicks: number[] = [];
  for (let cm = 2; cm <= MAX_CM; cm += 2) {
    if (cm % GRAD_STEP !== 0) fineTicks.push(cm);
  }

  // Suppress a graduation label if the latest-measurement blue label is too close.
  // Uses pixel distance so the threshold scales with layout, not cm values.
  function isNearLatest(cm: number): boolean {
    if (!latestM) return false;
    return Math.abs(heightToY(latestM.heightCm) - heightToY(cm)) < 18;
  }

  // Only the latest measurement is shown on the spine
  const latestIsMilestone = latestM?.isMilestone === 1 && !!latestM?.milestoneName;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">

      {/* ── SVG: spine, ticks, labels, connector lines ── */}
      <Svg width={w} height={h} style={StyleSheet.absoluteFillObject}>

        {/* Fine ticks (every 2 cm, centred on spine) */}
        {fineTicks.map((cm) => {
          const y = heightToY(cm);
          if (y < CEIL_Y - 1 || y > FLOOR_Y + 1) return null;
          const isTen      = cm % 10 === 0;
          const half       = isTen ? 10 : 6;
          const tickStroke = isTen ? 2.0 : 1.5;
          return (
            <SvgLine
              key={`t${cm}`}
              x1={TICK_X - half} y1={y}
              x2={TICK_X + half} y2={y}
              stroke="#777" strokeWidth={tickStroke}
            />
          );
        })}

        {/* Major graduation marks + labels (every 20 cm, centred on spine) */}
        {gradMarks.map((cm) => {
          const y         = heightToY(cm);
          if (y < CEIL_Y - 1 || y > FLOOR_Y + 1) return null;
          const suppress   = isNearLatest(cm);
          const isCentury  = cm % 100 === 0;
          const labelSize  = isCentury ? 20 : 13;
          const color      = '#555';
          return (
            <G key={`g${cm}`}>
              <SvgLine
                x1={TICK_X - 14} y1={y}
                x2={TICK_X + 14} y2={y}
                stroke="#666" strokeWidth={2.5}
              />
              {!suppress && (
                <SvgText
                  x={RULER_X - 4} y={isCentury ? y + 7 : y + 5}
                  fontSize={labelSize} fill={color} textAnchor="end"
                >
                  {cm}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Latest measurement height label — left of spine, blue */}
        {latestM && (() => {
          const y = heightToY(latestM.heightCm);
          if (y < CEIL_Y || y > FLOOR_Y) return null;
          const label = cmLabel(latestM, primaryUnit);
          return (
            <G>
              {/* Light blue outline rendered behind */}
              <SvgText
                x={RULER_X - 4} y={y + 7}
                fontSize={24} fill="none"
                stroke="#B3D9FF" strokeWidth={4}
                textAnchor="end" fontWeight="700"
              >
                {label}
              </SvgText>
              {/* Blue fill rendered on top */}
              <SvgText
                x={RULER_X - 4} y={y + 7}
                fontSize={24} fill="#4B9EFF"
                textAnchor="end" fontWeight="700"
              >
                {label}
              </SvgText>
            </G>
          );
        })()}

        {/* 0 cm baseline — tick same as 20 cm marks, label centred below spine */}
        <G>
          <SvgLine
            x1={TICK_X - 14} y1={FLOOR_Y}
            x2={TICK_X + 14} y2={FLOOR_Y}
            stroke="#666" strokeWidth={2.5}
          />
          <SvgText
            x={TICK_X} y={FLOOR_Y + 22}
            fontSize={20} fill="#555" textAnchor="middle"
          >
            {`0 ${primaryUnit === 'ft' ? 'ft' : 'cm'}`}
          </SvgText>
        </G>

        {/* Latest measurement line */}
        {latestM && (() => {
          const y = heightToY(latestM.heightCm);
          if (y < CEIL_Y || y > FLOOR_Y) return null;
          return (
            <SvgLine
              x1={TICK_X - 14} y1={y}
              x2={TICK_X + 14} y2={y}
              stroke="#4B9EFF" strokeWidth={2.5}
            />
          );
        })()}

      </Svg>

      {/* ── Latest measurement card (only if it is a milestone) ── */}
      {latestM && latestIsMilestone && (() => {
        const y       = heightToY(latestM.heightCm);
        if (y < CEIL_Y || y > FLOOR_Y) return null;
        const cardTop = Math.max(CEIL_Y, Math.min(FLOOR_Y - CARD_H, y - CARD_H / 2));
        return (
          <View
            style={[
              styles.card,
              {
                position:    'absolute',
                left:        CARD_LEFT,
                top:         cardTop,
                width:       CARD_W,
                height:      CARD_H,
                borderColor: '#4B9EFF',
              },
            ]}
          >
            <View style={styles.cardInner}>
              <View style={styles.cardText}>
                <Text style={styles.cardLabel} numberOfLines={2}>
                  {latestM.milestoneName}
                </Text>
                <Text style={styles.cardDateLatest}>
                  {formatDate(latestM.measuredAt)}
                </Text>
              </View>
              <View style={[styles.avatarRing, { borderColor: '#4B9EFF' }]}>
                <AvatarDisplay config={avatarConfig} size={32} compact />
              </View>
            </View>
          </View>
        );
      })()}

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderRadius:    10,
    borderWidth:     1,
    overflow:        'hidden',
  },
  cardInner: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
    paddingVertical:   4,
    gap:               6,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize:   10,
    fontWeight: '600',
    color:      '#2D2D2D',
    lineHeight: 13,
  },
  cardDate: {
    fontSize:  9,
    color:     '#888',
    marginTop: 2,
  },
  cardDateLatest: {
    color: '#4B9EFF',
  },
  avatarRing: {
    width:        32,
    height:       32,
    borderRadius: 16,
    overflow:     'hidden',
    borderWidth:  1.5,
    borderColor:  '#DDD',
  },
});
