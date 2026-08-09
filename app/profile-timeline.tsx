import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image } from 'react-native';
import { Stack, useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import { eq } from 'drizzle-orm';
import {
  Svg, Polyline, Circle, Line as SvgLine,
  Text as SvgText, Rect, G, Path,
} from 'react-native-svg';
import { db } from '../src/db/database';
import { profiles, Profile, Measurement } from '../src/db/schema';
import { AvatarSection } from '../src/components/scene/AvatarSection';
import { RulerSection } from '../src/components/scene/RulerSection';
import { getMeasurements } from '../src/services/measurement.service';
import { useSettingsStore } from '../src/store/settings.store';
import { formatHeight, toGraphValue } from '../src/utils/weight';
import { Ionicons } from '@expo/vector-icons';

// ─── Chart constants ──────────────────────────────────────────────────────────
const SVG_H  = 280;
const PAD_L  = 60;
const PAD_R  = 20;
const PAD_T  = 28;
const PAD_B  = 48;
const N_YTKS = 5;
const TIP_W  = 134;
const TIP_H  = 56;
const HIT_R  = 28;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function shortDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function xLabel(ts: number, spansYears: boolean) {
  const d     = new Date(ts);
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  if (spansYears) return `${month} '${String(d.getFullYear()).slice(2)}`;
  return `${d.getDate()} ${month}`;
}

function yTickLabel(value: number, unit: 'cm' | 'ft') {
  if (unit === 'cm') return `${Math.round(value)}`;
  return `${Math.floor(value / 12)}'${Math.round(value % 12)}"`;
}

function formatMeasurement(m: Measurement, unit: 'cm' | 'ft') {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null)
    return `${m.heightFt} ft ${m.heightIn} in`;
  return formatHeight(m.heightCm, unit);
}

function formatDelta(deltaCm: number, unit: 'cm' | 'ft'): string {
  const sign = deltaCm >= 0 ? '+' : '−';
  if (unit === 'cm') {
    const val = Math.abs(Math.round(deltaCm * 10) / 10);
    return `${sign}${val} cm`;
  }
  const totalIn = Math.round(Math.abs(deltaCm / 2.54) * 10) / 10;
  return `${sign}${totalIn} in`;
}

// ─── Height chart ─────────────────────────────────────────────────────────────
function starPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${pts[0]} L${pts.slice(1).join(' L')} Z`;
}

type ChartPoint = { x: number; y: number; label: string; measurement: Measurement };

function HeightChart({
  measurements,
  primaryUnit,
  onMeasurementPress,
}: {
  measurements: Measurement[];
  primaryUnit: 'cm' | 'ft';
  onMeasurementPress?: (m: Measurement) => void;
}) {
  const [w, setW] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const data: ChartPoint[] = [...measurements]
    .filter((m) => m.heightCm > 0)
    .sort((a, b) => a.measuredAt - b.measuredAt)
    .map((m) => ({
      x:           m.measuredAt,
      y:           toGraphValue(m.heightCm, primaryUnit),
      label:       formatMeasurement(m, primaryUnit),
      measurement: m,
    }));

  const cW = Math.max(w - PAD_L - PAD_R, 1);
  const cH = SVG_H - PAD_T - PAD_B;

  const ys      = data.length > 0 ? data.map((d) => d.y) : [0];
  const yMin    = Math.min(...ys);
  const yMax    = Math.max(...ys);
  const yRange  = yMax - yMin || 10;
  const yPad    = Math.max(yRange * 0.15, 2);
  const yLow    = yMin - yPad;
  const yHigh   = yMax + yPad;

  const xMin     = data.length > 0 ? data[0].x : 0;
  const xMax     = data.length > 0 ? data[data.length - 1].x : 1;
  const xRange   = xMax - xMin || 1;
  const spansYrs = data.length > 1 &&
    new Date(xMin).getFullYear() !== new Date(xMax).getFullYear();

  const px = (ts: number) => PAD_L + ((ts - xMin) / xRange) * cW;
  const py = (v: number)  => PAD_T  + (1 - (v - yLow) / (yHigh - yLow)) * cH;

  const yTicks  = Array.from({ length: N_YTKS }, (_, i) =>
    yLow + (i / (N_YTKS - 1)) * (yHigh - yLow),
  );
  const xStep   = Math.max(1, Math.ceil(data.length / 5));
  const bottomY = PAD_T + cH;

  const polyPts = data
    .map((d) => `${px(d.x).toFixed(1)},${py(d.y).toFixed(1)}`)
    .join(' ');

  const areaPath = data.length > 1
    ? `M ${px(data[0].x).toFixed(1)},${py(data[0].y).toFixed(1)} ` +
      data.slice(1).map((d) => `L ${px(d.x).toFixed(1)},${py(d.y).toFixed(1)}`).join(' ') +
      ` L ${px(xMax).toFixed(1)},${bottomY.toFixed(1)}` +
      ` L ${px(xMin).toFixed(1)},${bottomY.toFixed(1)} Z`
    : '';

  function handlePress(tapX: number, tapY: number) {
    if (data.length === 0) return;
    // If tooltip is visible and tap lands on it, open the detail screen
    if (selectedIdx !== null && tip !== null) {
      if (tapX >= tip.x && tapX <= tip.x + TIP_W &&
          tapY >= tip.y && tapY <= tip.y + TIP_H) {
        onMeasurementPress?.(data[selectedIdx].measurement);
        return;
      }
    }
    // Otherwise select/deselect the nearest dot
    const found = data.reduce<{ idx: number; dist: number } | null>((acc, d, i) => {
      const dist = Math.sqrt((tapX - px(d.x)) ** 2 + (tapY - py(d.y)) ** 2);
      if (dist < HIT_R && (!acc || dist < acc.dist)) return { idx: i, dist };
      return acc;
    }, null);
    setSelectedIdx(found ? found.idx : null);
  }

  let tip: { x: number; y: number } | null = null;
  if (selectedIdx !== null && w > 0) {
    const dotX = px(data[selectedIdx].x);
    const dotY = py(data[selectedIdx].y);
    const bx = Math.min(Math.max(dotX - TIP_W / 2, PAD_L), PAD_L + cW - TIP_W);
    const by = dotY - TIP_H - 16 < PAD_T ? dotY + 16 : dotY - TIP_H - 16;
    tip = { x: bx, y: by };
  }

  if (data.length === 0) {
    return <Text style={styles.emptyChart}>No measurements to display.</Text>;
  }

  return (
    <View style={styles.chartOuter} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <View style={{ height: SVG_H }}>
          <Svg width={w} height={SVG_H}>
            <Rect x={PAD_L} y={PAD_T} width={cW} height={cH} fill="#fff" />

            {yTicks.map((tick, i) => (
              <G key={i}>
                <SvgLine x1={PAD_L} y1={py(tick)} x2={PAD_L + cW} y2={py(tick)}
                  stroke={i === 0 ? '#CBD5E0' : '#EDF2F7'} strokeWidth={i === 0 ? 1.5 : 1} />
                <SvgText x={PAD_L - 8} y={py(tick) + 4} fontSize={11} fill="#4A5568"
                  textAnchor="end" fontWeight="500">
                  {yTickLabel(tick, primaryUnit)}
                </SvgText>
              </G>
            ))}

            <SvgText x={PAD_L - 8} y={PAD_T - 9} fontSize={10} fill="#A0AEC0" textAnchor="end">
              {primaryUnit === 'cm' ? 'cm' : 'ft & in'}
            </SvgText>
            <SvgLine x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={bottomY}
              stroke="#CBD5E0" strokeWidth={1.5} />

            {areaPath !== '' && <Path d={areaPath} fill="rgba(74,144,217,0.09)" />}
            {data.length > 1 && (
              <Polyline points={polyPts} fill="none" stroke="#4A90D9"
                strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            )}

            {selectedIdx !== null && (
              <Circle
                cx={px(data[selectedIdx].x)} cy={py(data[selectedIdx].y)}
                r={12}
                fill={data[selectedIdx].measurement.isMilestone === 1
                  ? 'rgba(214,158,46,0.18)'
                  : 'rgba(74,144,217,0.16)'}
              />
            )}
            {data.map((d, i) => {
              const sel = i === selectedIdx;
              if (d.measurement.isMilestone === 1) {
                return (
                  <Path
                    key={i}
                    d={starPath(px(d.x), py(d.y), sel ? 8 : 7, sel ? 3.5 : 3)}
                    fill={sel ? '#fff' : '#D69E2E'}
                    stroke="#D69E2E"
                    strokeWidth={sel ? 2 : 1.5}
                    strokeLinejoin="round"
                  />
                );
              }
              return (
                <Circle key={i} cx={px(d.x)} cy={py(d.y)}
                  r={sel ? 6 : 5}
                  fill={sel ? '#fff' : '#4A90D9'}
                  stroke="#4A90D9" strokeWidth={sel ? 2.5 : 2} />
              );
            })}

            {data.map((d, i) => {
              if (i % xStep !== 0 && i !== data.length - 1) return null;
              const lx = Math.min(Math.max(px(d.x), PAD_L + 22), w - PAD_R - 22);
              return (
                <G key={`xl-${i}`}>
                  <SvgText x={lx} y={SVG_H - 10} fontSize={10} fill="#4A5568" textAnchor="middle">
                    {xLabel(d.x, spansYrs)}
                  </SvgText>
                  <SvgLine x1={px(d.x)} y1={bottomY} x2={px(d.x)} y2={bottomY + 4}
                    stroke="#CBD5E0" strokeWidth={1} />
                </G>
              );
            })}

            {tip !== null && selectedIdx !== null && (
              <G>
                <Rect x={tip.x + 2} y={tip.y + 2} width={TIP_W} height={TIP_H}
                  rx={9} fill="rgba(0,0,0,0.07)" />
                <Rect x={tip.x} y={tip.y} width={TIP_W} height={TIP_H}
                  rx={9} fill="#fff" stroke="#E2E8F0" strokeWidth={1} />
                <SvgText x={tip.x + TIP_W / 2} y={tip.y + 22} fontSize={14}
                  fill="#2D3748" fontWeight="700" textAnchor="middle">
                  {data[selectedIdx].label}
                </SvgText>
                <SvgText x={tip.x + TIP_W / 2} y={tip.y + 40} fontSize={11}
                  fill="#718096" textAnchor="middle">
                  {formatDate(data[selectedIdx].x)}
                </SvgText>
              </G>
            )}
          </Svg>

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => handlePress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          />
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
const COLLAPSED_H = 120;

export default function ProfileKitchenScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const primaryUnit = useSettingsStore((s) => s.primaryUnit);

  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isExpanded,   setIsExpanded]   = useState(false);
  const [rulerH,       setRulerH]       = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      db.select().from(profiles).where(eq(profiles.id, id)).then(([p]) => {
        if (p) setProfile(p);
      });
      getMeasurements(id).then(setMeasurements);
    }, [id]),
  );

  const latest     = measurements[0] ?? null;
  const milestones = measurements.filter((m) => m.isMilestone === 1);

  // Shared values so snap points are accessible inside worklets
  const snapCollapsed = useSharedValue(600);
  const sheetY        = useSharedValue(600);
  const startY        = useSharedValue(600);

  function onContainerLayout(h: number) {
    const snap = h - COLLAPSED_H;
    snapCollapsed.value = snap;
    // Jump to collapsed position without animation on first layout
    sheetY.value = snap;
  }

  function handleExpandedChange(expanded: boolean) {
    setIsExpanded(expanded);
  }

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startY.value = sheetY.value;
    })
    .onUpdate((e) => {
      const next = startY.value + e.translationY;
      sheetY.value = Math.min(Math.max(next, 0), snapCollapsed.value);
    })
    .onEnd((e) => {
      const goExpanded = sheetY.value < snapCollapsed.value / 2 || e.velocityY < -500;
      const target     = goExpanded ? 0 : snapCollapsed.value;
      sheetY.value     = withSpring(target, { damping: 20, stiffness: 150 });
      runOnJS(handleExpandedChange)(goExpanded);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown:      true,
          title:            profile?.name ?? '',
          headerBackTitle:  'Profiles',
          headerStyle:      { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '700', color: '#1A202C' },
          headerTintColor:  '#4A90D9',
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/edit-profile', params: { id } })}
              hitSlop={12}
              style={{ paddingRight: 4 }}
            >
              <Ionicons name="create-outline" size={22} color="#4A90D9" />
            </Pressable>
          ),
        }}
      />

      <View
        style={styles.container}
        onLayout={(e) => onContainerLayout(e.nativeEvent.layout.height)}
      >
        {/* ── Scene area — background layer ── */}
        <View style={styles.kitchen}>
          <Image
            source={require('../assets/scenes/room_1_background.png')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </View>

        {/* ── Profile info — top 10%, left 1/4 ── */}
        <View style={styles.profileInfoPane} />

        {/* ── Ruler — left 1/3, below profile info ── */}
        {profile && (
          <View
            style={styles.rulerPane}
            onLayout={(e) => setRulerH(e.nativeEvent.layout.height)}
          >
            <RulerSection profile={profile} measurements={measurements} primaryUnit={primaryUnit} paneHeight={rulerH} />
          </View>
        )}

        {/* ── Avatar — right 1/3, bottom 75% of scene height ── */}
        {profile && (
          <View style={styles.avatarPane}>
            <View style={styles.avatarArea}>
              <AvatarSection profile={profile} />
            </View>
          </View>
        )}

        {/* ── Bottom sheet ── */}
        <Animated.View style={[styles.sheet, sheetStyle]}>

          {/* Drag handle + collapsed content */}
          <GestureDetector gesture={panGesture}>
            <View style={styles.handleArea}>
              <View style={styles.handlePill} />
              <View style={styles.latestRow}>
                {latest ? (
                  <>
                    <View style={styles.latestHeightRow}>
                      <Text style={styles.latestHeight}>
                        {formatMeasurement(latest, primaryUnit)}
                      </Text>
                      {measurements.length >= 2 && (() => {
                        const delta = latest.heightCm - measurements[1].heightCm;
                        const positive = delta >= 0;
                        return (
                          <Text style={[styles.deltaBadge, positive ? styles.deltaPositive : styles.deltaNegative]}>
                            {formatDelta(delta, primaryUnit)}
                          </Text>
                        );
                      })()}
                    </View>
                    <Text style={styles.latestDate}>
                      {shortDate(latest.measuredAt)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.latestNone}>No measurements yet</Text>
                )}
              </View>
            </View>
          </GestureDetector>

          {/* Scrollable expanded content */}
          <ScrollView
            scrollEnabled={isExpanded}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.sectionTitle}>Journey</Text>
            <HeightChart
              measurements={measurements}
              primaryUnit={primaryUnit}
              onMeasurementPress={(m) =>
                router.push({ pathname: '/measurement-detail', params: { id: m.id, profileName: profile?.name ?? '' } })
              }
            />

            <Text style={[styles.sectionTitle, styles.sectionTitleGap]}>Milestones</Text>
            {milestones.length === 0 ? (
              <Text style={styles.emptySection}>No milestones recorded yet.</Text>
            ) : (
              milestones.map((m) => (
                <View key={m.id} style={styles.milestoneRow}>
                  <Text style={styles.milestoneName}>{m.milestoneName ?? '—'}</Text>
                  <View style={styles.milestoneRight}>
                    <Text style={styles.milestoneValue}>
                      {formatMeasurement(m, primaryUnit)}
                    </Text>
                    <Text style={styles.milestoneDate}>
                      {shortDate(m.measuredAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <Pressable
              style={styles.allMeasurementsBtn}
              onPress={() =>
                router.push({
                  pathname: '/all-measurements',
                  params: { profileId: id, profileName: profile?.name ?? '' },
                })
              }
            >
              <Text style={styles.allMeasurementsBtnText}>All Measurements</Text>
            </Pressable>

            <View style={styles.scrollPad} />
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: '#E8F4FD' },
  container: { flex: 1 },

  kitchen: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          120,         // COLLAPSED_H — stops at top of collapsed sheet
    backgroundColor: '#E8F4FD',  // fallback while image loads
    overflow:        'hidden',
  },

  // Ruler — left third of scene
  profileInfoPane: {
    position:        'absolute',
    left:            0,
    top:             0,
    height:          '15%',
    width:           '40%',
    backgroundColor: 'rgba(100, 149, 237, 0.35)', // diagnostic blue
  },

  rulerPane: {
    position:        'absolute',
    left:            0,
    top:             '15%',
    bottom:          120,                      // COLLAPSED_H
    width:           '33.33%',
  },

  // Avatar overlay — right third of scene, bottom 75% of scene height
  avatarPane: {
    position: 'absolute',
    right:    0,
    top:      0,
    bottom:   120,               // COLLAPSED_H
    width:    '33.33%',
  },
  // Absolutely positioned inside avatarPane — top:25% leaves the shelf clear
  avatarArea: {
    position: 'absolute',
    top:      '25%',
    left:     0,
    right:    0,
    bottom:   '7%',
  },

  // Bottom sheet
  sheet: {
    position:             'absolute',
    left:                 0,
    right:                0,
    top:                  0,
    bottom:               0,
    backgroundColor:      '#fff',
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    shadowColor:          '#000',
    shadowOpacity:        0.12,
    shadowRadius:         12,
    elevation:            16,
  },

  // Handle + collapsed content
  handleArea:    { alignItems: 'center', paddingTop: 10, paddingBottom: 16, paddingHorizontal: 20 },
  handlePill:    { width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E0', marginBottom: 14 },
  latestRow:        { alignItems: 'center', gap: 4 },
  latestHeightRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  latestHeight:     { fontSize: 30, fontWeight: '700', color: '#2D3748' },
  latestDate:       { fontSize: 14, color: '#718096' },
  latestNone:       { fontSize: 15, color: '#A0AEC0' },
  deltaBadge:       { fontSize: 13, fontWeight: '600', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  deltaPositive:    { color: '#276749', backgroundColor: '#C6F6D5' },
  deltaNegative:    { color: '#9B2C2C', backgroundColor: '#FED7D7' },

  // Scroll content
  scrollContent:    { paddingHorizontal: 20, paddingTop: 4 },
  sectionTitle:     { fontSize: 20, fontWeight: '700', color: '#1A202C', marginBottom: 16 },
  sectionTitleGap:  { marginTop: 32 },
  emptySection:     { color: '#A0AEC0', fontSize: 14, marginBottom: 16 },
  scrollPad:        { height: 48 },

  // Chart
  chartOuter:  { marginBottom: 8 },
  emptyChart:  { color: '#A0AEC0', fontSize: 14, paddingVertical: 32, textAlign: 'center' },

  // Milestones
  milestoneRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  milestoneName:  { fontSize: 15, fontWeight: '600', color: '#2D3748', flex: 1 },
  milestoneRight: { alignItems: 'flex-end', gap: 2 },
  milestoneValue: { fontSize: 15, fontWeight: '700', color: '#4A90D9' },
  milestoneDate:  { fontSize: 12, color: '#A0AEC0' },

  allMeasurementsBtn:     { marginTop: 24, backgroundColor: '#4A90D9', borderRadius: 12, padding: 16, alignItems: 'center' },
  allMeasurementsBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
