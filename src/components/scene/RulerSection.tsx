import { View, StyleSheet, useWindowDimensions, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Line as SvgLine, Text as SvgText, G } from 'react-native-svg';
import { Measurement, Profile } from '../../db/schema';

const FILL = { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 } as const;

interface Props {
  profile:      Profile;
  measurements: Measurement[];
  primaryUnit:  'cm' | 'ft';
  paneHeight:   number;
}

const MAX_CM  = 200;
const CARD_H  = 60;
const CARD_GAP = 4;

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function cmLabel(m: Measurement, unit: 'cm' | 'ft'): string {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null) {
    return `${m.heightFt}'${Math.round(m.heightIn)}"`;
  }
  return String(Math.round(m.heightCm));
}

type CardData = { m: Measurement; cardTop: number; tickY: number };

export function RulerSection({ profile, measurements, primaryUnit, paneHeight }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const paneW = Math.round(screenWidth * 0.4);  // actual pane width (matches rulerPane width:'40%')
  const w     = screenWidth / 3;                // spine positioning anchor (unchanged)
  const h     = paneHeight;
  if (h === 0) return null;

  const RULER_X   = Math.round(w * 0.36);
  const TICK_X    = Math.round(w * 0.48);
  const FLOOR_Y   = h * 0.9;
  const CEIL_Y    = h * 0.05;
  const CARD_LEFT = TICK_X + 16;
  const CARD_W    = paneW - CARD_LEFT - 2;

  function heightToY(cm: number): number {
    return FLOOR_Y - (cm / MAX_CM) * (FLOOR_Y - CEIL_Y);
  }

  const newestId = measurements.length > 0 ? measurements[0].id : null;
  const latestM  = measurements.length > 0 ? measurements[0] : null;

  const GRAD_STEP = 20;
  const gradMarks: number[] = [];
  for (let cm = GRAD_STEP; cm <= 200; cm += GRAD_STEP) gradMarks.push(cm);

  const fineTicks: number[] = [];
  for (let cm = 2; cm <= MAX_CM; cm += 2) {
    if (cm % GRAD_STEP !== 0) fineTicks.push(cm);
  }

  function isNearLatest(cm: number): boolean {
    if (!latestM) return false;
    return Math.abs(heightToY(latestM.heightCm) - heightToY(cm)) < 18;
  }

  // All milestone measurements
  const milestones = measurements.filter(m => m.isMilestone === 1 && !!m.milestoneName);

  // Compute card positions with collision avoidance (process top-to-bottom)
  const cardItems: CardData[] = [];
  const sortedMilestones = milestones
    .map(m => ({ m, tickY: heightToY(m.heightCm) }))
    .filter(({ tickY }) => tickY >= CEIL_Y - 1 && tickY <= FLOOR_Y + 1)
    .sort((a, b) => a.tickY - b.tickY);

  for (const { m, tickY } of sortedMilestones) {
    let cardTop = Math.max(CEIL_Y, Math.min(FLOOR_Y - CARD_H, tickY - CARD_H / 2));
    if (cardItems.length > 0) {
      const prev = cardItems[cardItems.length - 1];
      if (cardTop < prev.cardTop + CARD_H + CARD_GAP) {
        cardTop = prev.cardTop + CARD_H + CARD_GAP;
      }
    }
    cardItems.push({ m, cardTop, tickY });
  }

  return (
    <View style={FILL} pointerEvents="none">

      <Svg width={paneW} height={h}>

        {/* Fine ticks (every 2 cm, centred on spine) */}
        {fineTicks.map((cm) => {
          const y = heightToY(cm);
          if (y < CEIL_Y - 1 || y > FLOOR_Y + 1) return null;
          const isTen      = cm % 10 === 0;
          const half       = isTen ? 10 : 6;
          const tickStroke = isTen ? 2.0 : 1.5;
          return (
            <SvgLine key={`t${cm}`}
              x1={TICK_X - half} y1={y} x2={TICK_X + half} y2={y}
              stroke="#777" strokeWidth={tickStroke} />
          );
        })}

        {/* Major graduation marks + labels (every 20 cm) */}
        {gradMarks.map((cm) => {
          const y        = heightToY(cm);
          if (y < CEIL_Y - 1 || y > FLOOR_Y + 1) return null;
          const suppress  = isNearLatest(cm);
          const isCentury = cm % 100 === 0;
          const labelSize = isCentury ? 20 : 13;
          return (
            <G key={`g${cm}`}>
              <SvgLine
                x1={TICK_X - 14} y1={y} x2={TICK_X + 14} y2={y}
                stroke="#666" strokeWidth={2.5} />
              {!suppress && (
                <SvgText
                  x={RULER_X - 4} y={isCentury ? y + 7 : y + 5}
                  fontSize={labelSize} fill="#555" textAnchor="end">
                  {cm}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Connector lines: spine edge → card left-centre */}
        {cardItems.map(({ m, cardTop, tickY }) => {
          const isLatest = m.id === newestId;
          const cardMidY = cardTop + CARD_H / 2;
          return (
            <SvgLine key={`conn${m.id}`}
              x1={TICK_X + 14} y1={tickY}
              x2={CARD_LEFT}   y2={cardMidY}
              stroke={isLatest ? '#4B9EFF' : '#D69E2E'}
              strokeWidth={1}
              strokeDasharray="3,3" />
          );
        })}

        {/* Latest measurement tick — blue */}
        {latestM && (() => {
          const y = heightToY(latestM.heightCm);
          if (y < CEIL_Y || y > FLOOR_Y) return null;
          return (
            <SvgLine
              x1={TICK_X - 14} y1={y} x2={TICK_X + 14} y2={y}
              stroke="#4B9EFF" strokeWidth={2.5} />
          );
        })()}

        {/* Latest measurement height label — blue, outlined */}
        {latestM && (() => {
          const y = heightToY(latestM.heightCm);
          if (y < CEIL_Y || y > FLOOR_Y) return null;
          const label = cmLabel(latestM, primaryUnit);
          return (
            <G>
              <SvgText x={RULER_X - 4} y={y + 7} fontSize={24} fill="none"
                stroke="#B3D9FF" strokeWidth={4} textAnchor="end" fontWeight="700">
                {label}
              </SvgText>
              <SvgText x={RULER_X - 4} y={y + 7} fontSize={24} fill="#4B9EFF"
                textAnchor="end" fontWeight="700">
                {label}
              </SvgText>
            </G>
          );
        })()}

        {/* 0 cm baseline */}
        <G>
          <SvgLine
            x1={TICK_X - 14} y1={FLOOR_Y} x2={TICK_X + 14} y2={FLOOR_Y}
            stroke="#666" strokeWidth={2.5} />
          <SvgText x={TICK_X} y={FLOOR_Y + 22} fontSize={20} fill="#555" textAnchor="middle">
            {`0 ${primaryUnit === 'ft' ? 'ft' : 'cm'}`}
          </SvgText>
        </G>

      </Svg>

      {/* Milestone cards — Liquid Glass */}
      {cardItems.map(({ m, cardTop }) => (
        <BlurView key={`card${m.id}`}
          intensity={70} tint="light"
          style={[styles.card, { position: 'absolute', left: CARD_LEFT, top: cardTop,
            width: CARD_W, height: CARD_H }]}
        >
          {/* Specular highlight — simulates the top-edge glass reflection */}
          <View style={styles.specular} />
          <Text style={styles.cardTitle} numberOfLines={2}>{m.milestoneName}</Text>
          <Text style={styles.cardDate}>{formatDate(m.measuredAt)}</Text>
        </BlurView>
      ))}

    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:  14,
    overflow:      'hidden',
    padding:       8,
    justifyContent: 'space-between',
    borderWidth:   0.5,
    borderColor:   'rgba(255,255,255,0.6)',
  },
  specular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          '45%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  cardTitle: {
    fontSize:   12,
    fontWeight: '600',
    color:      'rgba(0,0,0,0.80)',
    lineHeight: 15,
  },
  cardDate: {
    fontSize: 11,
    color:    'rgba(0,0,0,0.50)',
    flex:     1,
  },
});
