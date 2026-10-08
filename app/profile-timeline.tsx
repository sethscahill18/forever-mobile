import { useCallback, useMemo, useState } from 'react';
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
import { ProfileInfoSection } from '../src/components/scene/ProfileInfoSection';
import { getMeasurements } from '../src/services/measurement.service';
import { useSettingsStore } from '../src/store/settings.store';
import { formatHeight, toGraphValue } from '../src/utils/weight';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_800ExtraBold, Nunito_900Black } from '@expo-google-fonts/nunito';
import { useAppTheme } from '../src/store/appTheme.store';
import { ThemeColors, ThemeName } from '../src/theme/tokens';
import { resolveDocUri } from '../src/utils/imageStorage';
import { withAlpha } from '../src/theme/withAlpha';

// ─── Room scene background — one per profile theme ────────────────────────────
const SCENE_BACKGROUNDS: Record<ThemeName, ReturnType<typeof require>> = {
  space:    require('../assets/scenes/room_1_background.png'),
  dinosaur: require('../assets/scenes/room_2_background.png'),
  princess: require('../assets/scenes/room_3_background.png'),
};

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
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function shortMonthDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function valueLabel(m: Measurement, unit: 'cm' | 'ft'): string {
  if (unit === 'ft' && m.heightFt != null && m.heightIn != null) {
    return `${m.heightFt}'${Math.round(m.heightIn)}"`;
  }
  return `${m.heightCm.toFixed(1)}cm`;
}

function ThreeMonthGraph({ measurements, primaryUnit, colors }: { measurements: Measurement[]; primaryUnit: 'cm' | 'ft'; colors: ThemeColors }) {
  const [w, setW] = useState(0);

  const _now = new Date(); const cutoff = new Date(_now.getFullYear(), _now.getMonth() - 3, _now.getDate()).getTime();
  const pts = measurements
    .filter(m => m.measuredAt >= cutoff && m.heightCm > 0)
    .sort((a, b) => a.measuredAt - b.measuredAt);

  if (pts.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: colors.textFaint }}>No recent data</Text>
      </View>
    );
  }

  const CHART_H = 60;
  const LABEL_H = 38;
  const SVG_H   = CHART_H + LABEL_H;
  const PAD_X   = 22;

  const minH  = Math.min(...pts.map(m => m.heightCm));
  const maxH  = Math.max(...pts.map(m => m.heightCm));
  const range = maxH - minH || 1;

  const toY = (cm: number) => 8 + (CHART_H - 14) * (1 - (cm - minH) / range);

  const n       = pts.length;
  const innerW  = Math.max(0, w - 2 * PAD_X);
  const spacing = n > 1 ? innerW / (n - 1) : 0;

  const dotPts = pts.map((m, i) => ({
    x: PAD_X + (n === 1 ? innerW / 2 : i * spacing),
    y: toY(m.heightCm),
    m,
  }));

  const polyPoints = dotPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <View style={{ flex: 1 }} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={SVG_H}>
          {n > 1 && (
            <Polyline points={polyPoints} fill="none" stroke={colors.primary} strokeWidth={1.5} />
          )}
          {dotPts.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={4} fill={withAlpha(colors.primary, 0.35)} stroke={colors.primary} strokeWidth={1.5} />
              <SvgText x={p.x} y={CHART_H + 13} fontSize={9} fill={colors.textMuted} textAnchor="middle">
                {shortMonthDate(p.m.measuredAt)}
              </SvgText>
              <SvgText x={p.x} y={CHART_H + 26} fontSize={9} fill={colors.textSecondary} textAnchor="middle" fontWeight="600">
                {valueLabel(p.m, primaryUnit)}
              </SvgText>
            </G>
          ))}
        </Svg>
      )}
    </View>
  );
}

function HeightChart({
  measurements,
  primaryUnit,
  onMeasurementPress,
  colors,
  styles,
}: {
  measurements: Measurement[];
  primaryUnit: 'cm' | 'ft';
  onMeasurementPress?: (m: Measurement) => void;
  colors: ThemeColors;
  styles: Styles;
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
            <Rect x={PAD_L} y={PAD_T} width={cW} height={cH} fill={colors.surface} />

            {yTicks.map((tick, i) => (
              <G key={i}>
                <SvgLine x1={PAD_L} y1={py(tick)} x2={PAD_L + cW} y2={py(tick)}
                  stroke={i === 0 ? colors.borderStrong : colors.border} strokeWidth={i === 0 ? 1.5 : 1} />
                <SvgText x={PAD_L - 8} y={py(tick) + 4} fontSize={11} fill={colors.textSecondary}
                  textAnchor="end" fontWeight="500">
                  {yTickLabel(tick, primaryUnit)}
                </SvgText>
              </G>
            ))}

            <SvgText x={PAD_L - 8} y={PAD_T - 9} fontSize={10} fill={colors.textFaint} textAnchor="end">
              {primaryUnit === 'cm' ? 'cm' : 'ft & in'}
            </SvgText>
            <SvgLine x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={bottomY}
              stroke={colors.borderStrong} strokeWidth={1.5} />

            {areaPath !== '' && <Path d={areaPath} fill={withAlpha(colors.primary, 0.09)} />}
            {data.length > 1 && (
              <Polyline points={polyPts} fill="none" stroke={colors.primary}
                strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            )}

            {selectedIdx !== null && (
              <Circle
                cx={px(data[selectedIdx].x)} cy={py(data[selectedIdx].y)}
                r={12}
                fill={data[selectedIdx].measurement.isMilestone === 1
                  ? withAlpha(colors.accentGold, 0.18)
                  : withAlpha(colors.primary, 0.16)}
              />
            )}
            {data.map((d, i) => {
              const sel = i === selectedIdx;
              if (d.measurement.isMilestone === 1) {
                return (
                  <Path
                    key={i}
                    d={starPath(px(d.x), py(d.y), sel ? 8 : 7, sel ? 3.5 : 3)}
                    fill={sel ? colors.surface : colors.accentGold}
                    stroke={colors.accentGold}
                    strokeWidth={sel ? 2 : 1.5}
                    strokeLinejoin="round"
                  />
                );
              }
              return (
                <Circle key={i} cx={px(d.x)} cy={py(d.y)}
                  r={sel ? 6 : 5}
                  fill={sel ? colors.surface : colors.primary}
                  stroke={colors.primary} strokeWidth={sel ? 2.5 : 2} />
              );
            })}

            {data.map((d, i) => {
              if (i % xStep !== 0 && i !== data.length - 1) return null;
              const lx = Math.min(Math.max(px(d.x), PAD_L + 22), w - PAD_R - 22);
              return (
                <G key={`xl-${i}`}>
                  <SvgText x={lx} y={SVG_H - 10} fontSize={10} fill={colors.textSecondary} textAnchor="middle">
                    {xLabel(d.x, spansYrs)}
                  </SvgText>
                  <SvgLine x1={px(d.x)} y1={bottomY} x2={px(d.x)} y2={bottomY + 4}
                    stroke={colors.borderStrong} strokeWidth={1} />
                </G>
              );
            })}

            {tip !== null && selectedIdx !== null && (
              <G>
                <Rect x={tip.x + 2} y={tip.y + 2} width={TIP_W} height={TIP_H}
                  rx={9} fill="rgba(0,0,0,0.07)" />
                <Rect x={tip.x} y={tip.y} width={TIP_W} height={TIP_H}
                  rx={9} fill={colors.surface} stroke={colors.border} strokeWidth={1} />
                <SvgText x={tip.x + TIP_W / 2} y={tip.y + 22} fontSize={14}
                  fill={colors.textSecondary} fontWeight="700" textAnchor="middle">
                  {data[selectedIdx].label}
                </SvgText>
                <SvgText x={tip.x + TIP_W / 2} y={tip.y + 40} fontSize={11}
                  fill={colors.textMuted} textAnchor="middle">
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
// Leave this much of the room scene visible at the top when fully expanded, so
// the drag handle never reaches the very top of the screen — right at y:0 it was
// hard to grab again to pull the sheet back down.
const EXPANDED_TOP = 90;

export default function ProfileKitchenScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const primaryUnit = useSettingsStore((s) => s.primaryUnit);

  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_800ExtraBold, Nunito_900Black });
  const nunitoFont = fontsLoaded ? 'Nunito_400Regular' : undefined;
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      sheetY.value = Math.min(Math.max(next, EXPANDED_TOP), snapCollapsed.value);
    })
    .onEnd((e) => {
      const goExpanded = sheetY.value < snapCollapsed.value / 2 || e.velocityY < -500;
      const target     = goExpanded ? EXPANDED_TOP : snapCollapsed.value;
      sheetY.value     = withSpring(target, { damping: 50, stiffness: 180, mass: 1, overshootClamping: true });
      runOnJS(handleExpandedChange)(goExpanded);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{ headerShown: false }}
      />

      <View
        style={styles.container}
        onLayout={(e) => onContainerLayout(e.nativeEvent.layout.height)}
      >
        {/* ── Back button overlay ── */}
        <Pressable onPress={() => router.back()} hitSlop={16}
          style={{ position: 'absolute', top: 56, left: 16, zIndex: 99 }}>
          <BlurView intensity={70} tint="light" style={styles.glassBtn}>
            <View style={styles.glassBtnSpecular} />
            <Ionicons name="chevron-back" size={24} color="rgba(0,0,0,0.8)" />
          </BlurView>
        </Pressable>

        {/* ── Edit button overlay ── */}
        <Pressable onPress={() => router.push({ pathname: '/edit-profile', params: { id } })} hitSlop={16}
          style={{ position: 'absolute', top: 56, right: 16, zIndex: 99 }}>
          <BlurView intensity={70} tint="light" style={styles.glassBtn}>
            <View style={styles.glassBtnSpecular} />
            <Ionicons name="create" size={22} color="rgba(0,0,0,0.8)" />
          </BlurView>
        </Pressable>

        {/* ── Scene area — background layer ── */}
        <View style={styles.kitchen}>
          <Image
            source={SCENE_BACKGROUNDS[(profile?.colourPalette as ThemeName) ?? 'princess']}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </View>

        {/* ── Profile info — top 15%, left 40% ── */}
        {profile && (
          <View style={styles.profileInfoPane}>
            <ProfileInfoSection profile={profile} />
          </View>
        )}

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
              <AvatarSection profile={profile} latestHeightCm={latest?.heightCm} />
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
                    <View style={styles.latestLeft}>
                      <Ionicons name="star" size={25} color={colors.accentGoldDark} style={{ marginRight: 14 }} />
                      <View style={{ flexDirection: 'column' }}>
                        <Text style={styles.latestLabel}>LATEST HEIGHT</Text>
                        <Text style={styles.latestHeight}>
                          {primaryUnit === 'ft' && latest.heightFt != null && latest.heightIn != null
                            ? <>{latest.heightFt}<Text style={{ fontSize: 20 }}> ft </Text>{latest.heightIn}<Text style={{ fontSize: 20 }}> in</Text></>
                            : <>{latest.heightCm.toFixed(1)}<Text style={{ fontSize: 20 }}> cm</Text></>
                          }
                        </Text>
                      </View>
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
            {/* ── Growth Progress ── */}
            {(() => {
              const _now = new Date(); const cutoff = new Date(_now.getFullYear(), _now.getMonth() - 3, _now.getDate()).getTime();
              const recent = measurements
                .filter(m => m.measuredAt >= cutoff && m.heightCm > 0)
                .sort((a, b) => a.measuredAt - b.measuredAt);
              const delta = recent.length >= 2
                ? recent[recent.length - 1].heightCm - recent[0].heightCm
                : null;
              return (
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 24, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', padding: 14, alignItems: 'flex-start', minHeight: 100 }}>
                    <View style={{ width: '41%', paddingRight: 8 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, letterSpacing: 0, marginBottom: 8, fontFamily: fontsLoaded ? 'Nunito_800ExtraBold' : undefined }}>GROWTH PROGRESS</Text>
                      {delta !== null ? (
                        <Text style={{ fontSize: 26, color: colors.primary, fontFamily: fontsLoaded ? 'Nunito_600SemiBold' : undefined }}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(1)} cm
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: nunitoFont }}>Not enough data</Text>
                      )}
                      <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: fontsLoaded ? 'Nunito_600SemiBold' : undefined }}>last 3 months</Text>
                    </View>
                    <ThreeMonthGraph measurements={measurements} primaryUnit={primaryUnit} colors={colors} />
                  </View>
                </View>
              );
            })()}

            <Text style={styles.sectionTitle}>Milestones</Text>
            {milestones.length === 0 ? (
              <Text style={styles.emptySection}>No milestones recorded yet.</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8, gap: 12 }}
              >
                {milestones.map((m) => (
                  <View key={m.id} style={styles.milestoneCard}>
                    {m.milestoneImage ? (
                      <Image
                        source={{ uri: resolveDocUri(m.milestoneImage)! }}
                        style={styles.milestoneCardImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.milestoneCardImagePlaceholder}>
                        <Ionicons name="image-outline" size={28} color={colors.borderStrong} />
                      </View>
                    )}
                    <View style={styles.milestoneCardBody}>
                      <Text style={styles.milestoneName} numberOfLines={2}>{m.milestoneName ?? '—'}</Text>
                      <Text style={styles.milestoneValue}>{formatMeasurement(m, primaryUnit)}</Text>
                      <Text style={styles.milestoneDate}>{shortDate(m.measuredAt)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
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
type Styles = ReturnType<typeof makeStyles>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen:    { flex: 1, backgroundColor: colors.sceneBackground },
  container: { flex: 1 },

  glassBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      20,
    overflow:          'hidden',
    borderWidth:       0.5,
    borderColor:       'rgba(255,255,255,0.6)',
    gap:               3,
  },
  glassBtnSpecular: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          '50%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  glassBtnText: {
    fontSize: 17,
    color:    'rgba(0,0,0,0.75)',
  },

  kitchen: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: colors.sceneBackground,  // fallback while image loads
    overflow:        'hidden',
  },

  // Ruler — left third of scene
  profileInfoPane: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          '70%',
    width:           '100%',
  },

  rulerPane: {
    position:        'absolute',
    left:            0,
    top:             '25%',
    bottom:          '15%',                    // COLLAPSED_H
    width:           '45%',
  },

  // Avatar overlay — right third of scene, bottom 75% of scene height
  avatarPane: {
    position: 'absolute',
    right:    0,
    top:      '30%',
    bottom:   '20%',             // COLLAPSED_H + 5%
    width:    '33.33%',
  },
  // Absolutely positioned inside avatarPane — top:25% leaves the shelf clear
  avatarArea: {
    position: 'absolute',
    top:      '25%',
    left:     0,
    right:    0,
    bottom:   0,
  },

  // Bottom sheet
  sheet: {
    position:             'absolute',
    left:                 12,
    right:                12,
    top:                  0,
    // Extend well past the bottom of the screen so the room-scene background
    // can never peek through below the sheet while dragging, regardless of
    // safe-area insets — makes the sheet look "infinitely long" at the bottom.
    bottom:               -400,
    backgroundColor:      colors.backgroundPaper,
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    shadowColor:          '#000',
    shadowOpacity:        0.12,
    shadowRadius:         12,
    elevation:            16,
  },

  // Handle + collapsed content
  handleArea:    { alignItems: 'center', paddingTop: 10, paddingBottom: 16, paddingHorizontal: 20 },
  handlePill:    { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 14 },
  latestRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4 },
  latestLeft:      { flexDirection: 'row', alignItems: 'flex-start' },
  latestLabel:  { fontSize: 15, color: colors.textSecondary, letterSpacing: 0.8, fontFamily: 'Nunito_800ExtraBold' },
  latestHeight: { fontSize: 30, color: colors.primary, fontFamily: 'Nunito_600SemiBold' },
  latestDate:   { fontSize: 14, color: colors.textMuted, fontFamily: 'Nunito_500Medium' },
  latestNone:   { fontSize: 15, color: colors.textFaint, fontFamily: 'Nunito_400Regular' },

  // Scroll content
  scrollContent:    { paddingHorizontal: 20, paddingTop: 4 },
  sectionTitle:     { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 16, fontFamily: 'Nunito_400Regular' },
  sectionTitleGap:  { marginTop: 32 },
  emptySection:     { color: colors.textFaint, fontSize: 14, marginBottom: 16, fontFamily: 'Nunito_400Regular' },
  scrollPad:        { height: 48 },

  // Chart
  chartOuter:  { marginBottom: 8 },
  emptyChart:  { color: colors.textFaint, fontSize: 14, paddingVertical: 32, textAlign: 'center', fontFamily: 'Nunito_400Regular' },

  // Milestones
  milestoneCard: {
    width:           140,
    borderRadius:    14,
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
  },
  milestoneCardImage: {
    width:  140,
    height: 110,
  },
  milestoneCardImagePlaceholder: {
    width:           140,
    height:          110,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  milestoneCardBody: {
    padding: 10,
    gap:     4,
  },
  milestoneName:  { fontSize: 13, color: colors.textSecondary, fontFamily: 'Nunito_600SemiBold' },
  milestoneValue: { fontSize: 13, fontWeight: '700', color: colors.primary, fontFamily: 'Nunito_400Regular' },
  milestoneDate:  { fontSize: 11, color: colors.textFaint, fontFamily: 'Nunito_400Regular' },

  allMeasurementsBtn:     { marginTop: 24, backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  allMeasurementsBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16, fontFamily: 'Nunito_400Regular' },
  });
}
