import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { eq } from 'drizzle-orm';
import {
  Svg, Polyline, Circle, Line as SvgLine,
  Text as SvgText, Rect, G, Path,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../src/db/database';
import { profiles, Profile, Measurement } from '../src/db/schema';
import { getMeasurements, deleteMeasurement } from '../src/services/measurement.service';
import { useSettingsStore } from '../src/store/settings.store';
import { formatHeight, toGraphValue } from '../src/utils/weight';

// ─── Chart layout constants ───────────────────────────────────────────────────
const SVG_H  = 300;
const PAD_L  = 60;   // room for Y-axis labels
const PAD_R  = 20;
const PAD_T  = 28;   // room above top grid line
const PAD_B  = 48;   // room for X-axis labels
const N_YTKS = 5;    // number of Y-axis grid lines

// Tooltip card dimensions
const TIP_W = 134;
const TIP_H = 56;

// How close a tap must be to a dot (in px) to select it
const HIT_R = 28;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// X-axis label: include year abbreviation when data spans multiple calendar years
function xLabel(ts: number, spansYears: boolean): string {
  const d     = new Date(ts);
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  if (spansYears) {
    const yr = String(d.getFullYear()).slice(2);
    return `${month} '${yr}`;
  }
  return `${d.getDate()} ${month}`;
}

// Y-axis tick label: feet-and-inches notation for ft unit, plain number for cm
function yTickLabel(value: number, unit: 'cm' | 'ft'): string {
  if (unit === 'cm') return `${Math.round(value)}`;
  const ft     = Math.floor(value / 12);
  const inches = Math.round(value % 12);
  return `${ft}'${inches}"`;
}

// ─── Chart point type ─────────────────────────────────────────────────────────
type ChartPoint = { x: number; y: number; label: string };

// ─── HeightChart ─────────────────────────────────────────────────────────────
function HeightChart({
  measurements,
  primaryUnit,
}: {
  measurements: Measurement[];
  primaryUnit: 'cm' | 'ft';
}) {
  const [w,           setW]           = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const data: ChartPoint[] = [...measurements]
    .filter((m) => m.heightCm > 0)
    .sort((a, b) => a.measuredAt - b.measuredAt)
    .map((m) => ({
      x:     m.measuredAt,
      y:     toGraphValue(m.heightCm, primaryUnit),
      label: primaryUnit === 'ft' && m.heightFt != null && m.heightIn != null
               ? `${m.heightFt} ft ${m.heightIn} in`
               : formatHeight(m.heightCm, primaryUnit),
    }));

  // ── Scaling (safe to compute even when w=0 / data empty) ──
  const cW = Math.max(w - PAD_L - PAD_R, 1);
  const cH = SVG_H - PAD_T - PAD_B;

  const ys     = data.length > 0 ? data.map((d) => d.y) : [0];
  const yMin   = Math.min(...ys);
  const yMax   = Math.max(...ys);
  const yRange = yMax - yMin || 10;
  const yPad   = Math.max(yRange * 0.15, 2);
  const yLow   = yMin - yPad;
  const yHigh  = yMax + yPad;

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
  const unitLabel = primaryUnit === 'cm' ? 'cm' : 'ft & in';

  const polyPts = data
    .map((d) => `${px(d.x).toFixed(1)},${py(d.y).toFixed(1)}`)
    .join(' ');

  const areaPath = data.length > 1
    ? `M ${px(data[0].x).toFixed(1)},${py(data[0].y).toFixed(1)} ` +
      data.slice(1).map((d) => `L ${px(d.x).toFixed(1)},${py(d.y).toFixed(1)}`).join(' ') +
      ` L ${px(xMax).toFixed(1)},${bottomY.toFixed(1)}` +
      ` L ${px(xMin).toFixed(1)},${bottomY.toFixed(1)} Z`
    : '';

  // ── Tap handler ──
  function handlePress(tapX: number, tapY: number) {
    if (data.length === 0) return;
    let closest: { idx: number; dist: number } | null = null;
    data.forEach((d, i) => {
      const dx   = tapX - px(d.x);
      const dy   = tapY - py(d.y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < HIT_R && (!closest || dist < closest.dist)) {
        closest = { idx: i, dist };
      }
    });
    setSelectedIdx(closest ? closest.idx : null);
  }

  // ── Tooltip box position ──
  let tip: { x: number; y: number } | null = null;
  if (selectedIdx !== null && w > 0) {
    const pt   = data[selectedIdx];
    const dotX = px(pt.x);
    const dotY = py(pt.y);
    let bx = dotX - TIP_W / 2;
    let by = dotY - TIP_H - 16; // default: above the dot
    // Keep inside chart horizontally
    bx = Math.min(Math.max(bx, PAD_L), PAD_L + cW - TIP_W);
    // Flip below the dot if not enough room above
    if (by < PAD_T) by = dotY + 16;
    tip = { x: bx, y: by };
  }

  return (
    <View style={styles.chartOuter} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {data.length === 0 ? (
        <Text style={styles.empty}>No measurements to display.</Text>
      ) : w > 0 ? (
        <View style={{ height: SVG_H }}>
          <Svg width={w} height={SVG_H}>

            {/* ── White plot area ── */}
            <Rect x={PAD_L} y={PAD_T} width={cW} height={cH} fill="#fff" />

            {/* ── Y-axis grid lines + tick labels ── */}
            {yTicks.map((tick, i) => {
              const y        = py(tick);
              const isBottom = i === 0;
              return (
                <G key={i}>
                  <SvgLine
                    x1={PAD_L} y1={y} x2={PAD_L + cW} y2={y}
                    stroke={isBottom ? '#CBD5E0' : '#EDF2F7'}
                    strokeWidth={isBottom ? 1.5 : 1}
                  />
                  <SvgText
                    x={PAD_L - 8} y={y + 4}
                    fontSize={11} fill="#4A5568"
                    textAnchor="end" fontWeight="500"
                  >
                    {yTickLabel(tick, primaryUnit)}
                  </SvgText>
                </G>
              );
            })}

            {/* ── Y-axis unit label (above top grid line) ── */}
            <SvgText
              x={PAD_L - 8} y={PAD_T - 9}
              fontSize={10} fill="#A0AEC0" textAnchor="end"
            >
              {unitLabel}
            </SvgText>

            {/* ── Left axis border ── */}
            <SvgLine
              x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={bottomY}
              stroke="#CBD5E0" strokeWidth={1.5}
            />

            {/* ── Area fill under line ── */}
            {areaPath !== '' && (
              <Path d={areaPath} fill="rgba(74,144,217,0.09)" />
            )}

            {/* ── Connecting line ── */}
            {data.length > 1 && (
              <Polyline
                points={polyPts}
                fill="none"
                stroke="#4A90D9"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* ── Selected dot pulse ring ── */}
            {selectedIdx !== null && (
              <Circle
                cx={px(data[selectedIdx].x)} cy={py(data[selectedIdx].y)}
                r={12} fill="rgba(74,144,217,0.16)"
              />
            )}

            {/* ── All data point dots ── */}
            {data.map((d, i) => {
              const sel = i === selectedIdx;
              return (
                <Circle
                  key={i}
                  cx={px(d.x)} cy={py(d.y)}
                  r={sel ? 6 : 5}
                  fill={sel ? '#fff' : '#4A90D9'}
                  stroke="#4A90D9"
                  strokeWidth={sel ? 2.5 : 2}
                />
              );
            })}

            {/* ── X-axis date labels ── */}
            {data.map((d, i) => {
              if (i % xStep !== 0 && i !== data.length - 1) return null;
              // Clamp so labels near the edges don't clip
              const lx = Math.min(
                Math.max(px(d.x), PAD_L + 22),
                w - PAD_R - 22,
              );
              return (
                <SvgText
                  key={i}
                  x={lx} y={SVG_H - 10}
                  fontSize={10} fill="#4A5568" textAnchor="middle"
                >
                  {xLabel(d.x, spansYrs)}
                </SvgText>
              );
            })}

            {/* ── X-axis tick marks ── */}
            {data.map((d, i) => {
              if (i % xStep !== 0 && i !== data.length - 1) return null;
              return (
                <SvgLine
                  key={`tk-${i}`}
                  x1={px(d.x)} y1={bottomY}
                  x2={px(d.x)} y2={bottomY + 4}
                  stroke="#CBD5E0" strokeWidth={1}
                />
              );
            })}

            {/* ── Tooltip card ── */}
            {tip !== null && selectedIdx !== null && (
              <G>
                {/* soft shadow */}
                <Rect
                  x={tip.x + 2} y={tip.y + 2}
                  width={TIP_W} height={TIP_H}
                  rx={9} fill="rgba(0,0,0,0.07)"
                />
                {/* white card */}
                <Rect
                  x={tip.x} y={tip.y}
                  width={TIP_W} height={TIP_H}
                  rx={9} fill="#fff"
                  stroke="#E2E8F0" strokeWidth={1}
                />
                {/* measurement value */}
                <SvgText
                  x={tip.x + TIP_W / 2} y={tip.y + 22}
                  fontSize={14} fill="#2D3748"
                  fontWeight="700" textAnchor="middle"
                >
                  {data[selectedIdx].label}
                </SvgText>
                {/* date */}
                <SvgText
                  x={tip.x + TIP_W / 2} y={tip.y + 40}
                  fontSize={11} fill="#718096" textAnchor="middle"
                >
                  {formatDate(data[selectedIdx].x)}
                </SvgText>
              </G>
            )}

          </Svg>

          {/* Transparent Pressable overlay captures every tap on the chart.
              Placed after Svg so it sits on top in the RN view hierarchy. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) =>
              handlePress(e.nativeEvent.locationX, e.nativeEvent.locationY)
            }
          />
        </View>
      ) : null}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileTimelineScreen() {
  const { id }      = useLocalSearchParams<{ id: string }>();
  const primaryUnit = useSettingsStore((s) => s.primaryUnit);

  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [activeTab,    setActiveTab]    = useState<'data' | 'graph'>('data');

  useEffect(() => {
    if (!id) return;
    db.select().from(profiles).where(eq(profiles.id, id)).then(([p]) => {
      if (p) setProfile(p);
    });
    getMeasurements(id).then(setMeasurements);
  }, [id]);

  function handleDelete(item: Measurement) {
    Alert.alert(
      'Delete Measurement',
      `Delete the reading of ${measurementValue(item)} on ${formatDate(item.measuredAt)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteMeasurement(item.id);
            setMeasurements((prev) => prev.filter((m) => m.id !== item.id));
          },
        },
      ],
    );
  }

  function measurementValue(item: Measurement): string {
    if (item.heightCm > 0) {
      if (primaryUnit === 'ft' && item.heightFt != null && item.heightIn != null) {
        return `${item.heightFt} ft ${item.heightIn} in`;
      }
      return formatHeight(item.heightCm, primaryUnit);
    }
    return item.notes ?? '—';
  }

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
        }}
      />

      <View style={{ flex: 1 }}>
        {activeTab === 'data' ? (
          <FlatList
            data={measurements}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>No measurements yet for this profile.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.date}>{formatDate(item.measuredAt)}</Text>
                  {item.isMilestone === 1 && item.milestoneName ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>★ {item.milestoneName}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.value}>{measurementValue(item)}</Text>
                  <Pressable onPress={() => handleDelete(item)} hitSlop={12}>
                    <Ionicons name="trash-outline" size={18} color="#FC8181" />
                  </Pressable>
                </View>
              </View>
            )}
          />
        ) : (
          <HeightChart measurements={measurements} primaryUnit={primaryUnit} />
        )}
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {(['data', 'graph'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
              {active && <View style={styles.tabUnderline} />}
              <Ionicons
                name={tab === 'data' ? 'list-outline' : 'trending-up-outline'}
                size={26}
                color={active ? '#4A90D9' : '#A0AEC0'}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab === 'data' ? 'Data' : 'Graph'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: '#F7FAFC' },
  list:       { padding: 16, paddingBottom: 40 },
  empty:      { textAlign: 'center', color: '#A0AEC0', marginTop: 60, fontSize: 15 },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowLeft:  { gap: 4 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  date:     { fontSize: 14, color: '#4A5568' },
  value:    { fontSize: 16, fontWeight: '600', color: '#2D3748' },

  badge: {
    backgroundColor: '#FEFCBF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, color: '#744210', fontWeight: '600' },

  chartOuter: { flex: 1, justifyContent: 'center' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    height: 80,
    backgroundColor: '#fff',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A0AEC0',
    letterSpacing: 0.2,
  },
  tabLabelActive: { color: '#4A90D9' },
  tabUnderline: {
    position: 'absolute',
    top: 0,
    height: 3,
    width: '50%',
    backgroundColor: '#4A90D9',
    borderRadius: 2,
  },
});
