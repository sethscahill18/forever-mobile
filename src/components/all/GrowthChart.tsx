import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Svg, Polyline, Circle, Line as SvgLine, Text as SvgText, G, Rect } from 'react-native-svg';
import { useAppTheme } from '../../store/appTheme.store';
import { ThemeColors } from '../../theme/tokens';
import { withAlpha } from '../../theme/withAlpha';
import { formatHeight } from '../../utils/weight';

export type ChartPoint = { x: number; y: number; cm: number };
export type ChartSeries = { id: string; name: string; color: string; points: ChartPoint[] };

type RangeKey = '3M' | '6M' | '1Y' | 'All';
const RANGES: { key: RangeKey; days: number | null }[] = [
  { key: '3M', days: 91 },
  { key: '6M', days: 182 },
  { key: '1Y', days: 365 },
  { key: 'All', days: null },
];

const SVG_H  = 240;
const PAD_L  = 44;
const PAD_R  = 16;
const PAD_T  = 20;
const PAD_B  = 28;
const N_YTKS = 5;
const N_XTKS = 4;
const TIP_W  = 140;
const TIP_H  = 56;
const HIT_R  = 28;
const DAY_MS = 86_400_000;

function yTickLabel(value: number, unit: 'cm' | 'ft') {
  if (unit === 'cm') return `${Math.round(value)}`;
  return `${Math.floor(value / 12)}'${Math.round(value % 12)}"`;
}

function xTickLabel(ts: number, spansYears: boolean) {
  const d = new Date(ts);
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  if (spansYears) return `${month} '${String(d.getFullYear()).slice(2)}`;
  return `${d.getDate()} ${month}`;
}

function tipDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function GrowthChart({
  series, hiddenIds, unit,
}: {
  series: ChartSeries[];
  hiddenIds: Set<string>;
  unit: 'cm' | 'ft';
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [range, setRange] = useState<RangeKey>('All');
  const [w, setW] = useState(0);
  const [selected, setSelected] = useState<{ sid: string; idx: number } | null>(null);

  const visible = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const from = days == null ? -Infinity : Date.now() - days * DAY_MS;
    return series
      .filter((s) => !hiddenIds.has(s.id))
      .map((s) => ({ ...s, points: s.points.filter((p) => p.x >= from) }))
      .filter((s) => s.points.length > 0);
  }, [series, hiddenIds, range]);

  const all = visible.flatMap((s) => s.points);

  const cW = Math.max(w - PAD_L - PAD_R, 1);
  const cH = SVG_H - PAD_T - PAD_B;

  const ys = all.map((p) => p.y);
  const yMin = ys.length ? Math.min(...ys) : 0;
  const yMax = ys.length ? Math.max(...ys) : 10;
  const yPad = Math.max((yMax - yMin || 10) * 0.15, 2);
  const yLow = yMin - yPad;
  const yHigh = yMax + yPad;

  const xs = all.map((p) => p.x);
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 1;
  const xRange = xMax - xMin || 1;
  const spansYears = new Date(xMin).getFullYear() !== new Date(xMax).getFullYear();

  // A single x-value would pin everything to the left edge — centre it instead.
  const px = (t: number) => PAD_L + (xMax === xMin ? cW / 2 : ((t - xMin) / xRange) * cW);
  const py = (v: number) => PAD_T + (1 - (v - yLow) / (yHigh - yLow)) * cH;

  const yTicks = Array.from({ length: N_YTKS }, (_, i) => yLow + (i / (N_YTKS - 1)) * (yHigh - yLow));
  const xTicks = xMax === xMin
    ? [xMin]
    : Array.from({ length: N_XTKS }, (_, i) => xMin + (i / (N_XTKS - 1)) * xRange);
  const bottomY = PAD_T + cH;

  const sel = selected
    ? (() => {
        const s = visible.find((v) => v.id === selected.sid);
        const p = s?.points[selected.idx];
        return s && p ? { s, p } : null;
      })()
    : null;

  let tip: { x: number; y: number } | null = null;
  if (sel) {
    const dotX = px(sel.p.x);
    const dotY = py(sel.p.y);
    const bx = Math.min(Math.max(dotX - TIP_W / 2, PAD_L), PAD_L + cW - TIP_W);
    const by = dotY - TIP_H - 14 < PAD_T ? dotY + 14 : dotY - TIP_H - 14;
    tip = { x: bx, y: by };
  }

  function handlePress(tapX: number, tapY: number) {
    let best: { sid: string; idx: number; dist: number } | null = null;
    for (const s of visible) {
      s.points.forEach((p, idx) => {
        const dist = Math.hypot(tapX - px(p.x), tapY - py(p.y));
        if (dist < HIT_R && (!best || dist < best.dist)) best = { sid: s.id, idx, dist };
      });
    }
    setSelected(best ? { sid: (best as any).sid, idx: (best as any).idx } : null);
  }

  return (
    <View>
      <View style={styles.chipRow}>
        {RANGES.map((r) => (
          <Pressable
            key={r.key}
            style={[styles.chip, range === r.key && styles.chipActive]}
            onPress={() => { setRange(r.key); setSelected(null); }}
          >
            <Text style={[styles.chipText, range === r.key && styles.chipTextActive]}>{r.key}</Text>
          </Pressable>
        ))}
      </View>

      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {visible.length === 0 ? (
          <Text style={styles.empty}>
            {series.every((s) => hiddenIds.has(s.id))
              ? 'All profiles are hidden. Turn one on in the list below.'
              : 'No measurements in this time range.'}
          </Text>
        ) : (
          w > 0 && (
            <View style={{ height: SVG_H }}>
              <Svg width={w} height={SVG_H}>
                {yTicks.map((tick, i) => (
                  <G key={`y${i}`}>
                    <SvgLine
                      x1={PAD_L} y1={py(tick)} x2={PAD_L + cW} y2={py(tick)}
                      stroke={i === 0 ? colors.borderStrong : colors.border}
                      strokeWidth={i === 0 ? 1.5 : 1}
                    />
                    <SvgText
                      x={PAD_L - 6} y={py(tick) + 4}
                      fontSize={11} fill={colors.textSecondary} textAnchor="end" fontWeight="500"
                    >
                      {yTickLabel(tick, unit)}
                    </SvgText>
                  </G>
                ))}

                <SvgText x={PAD_L - 6} y={PAD_T - 8} fontSize={10} fill={colors.textFaint} textAnchor="end">
                  {unit === 'cm' ? 'cm' : 'ft & in'}
                </SvgText>
                <SvgLine x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={bottomY} stroke={colors.borderStrong} strokeWidth={1.5} />

                {xTicks.map((t, i) => (
                  <G key={`x${i}`}>
                    <SvgLine x1={px(t)} y1={bottomY} x2={px(t)} y2={bottomY + 4} stroke={colors.borderStrong} strokeWidth={1} />
                    <SvgText x={px(t)} y={bottomY + 17} fontSize={10} fill={colors.textMuted} textAnchor="middle">
                      {xTickLabel(t, spansYears)}
                    </SvgText>
                  </G>
                ))}

                {visible.map((s) => {
                  if (s.points.length < 2) return null;
                  const pts = s.points.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
                  return (
                    <Polyline
                      key={s.id} points={pts} fill="none" stroke={s.color}
                      strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                    />
                  );
                })}

                {visible.flatMap((s) =>
                  s.points.map((p, i) => {
                    const isSel = selected?.sid === s.id && selected.idx === i;
                    return (
                      <Circle
                        key={`${s.id}-${i}`}
                        cx={px(p.x)} cy={py(p.y)}
                        r={isSel ? 6 : 4}
                        fill={isSel ? colors.surface : withAlpha(s.color, 0.35)}
                        stroke={s.color}
                        strokeWidth={isSel ? 2.5 : 1.5}
                      />
                    );
                  }),
                )}

                {tip && sel && (
                  <G>
                    <Rect x={tip.x + 2} y={tip.y + 2} width={TIP_W} height={TIP_H} rx={9} fill="rgba(0,0,0,0.07)" />
                    <Rect x={tip.x} y={tip.y} width={TIP_W} height={TIP_H} rx={9}
                      fill={colors.surface} stroke={sel.s.color} strokeWidth={1.5} />
                    <SvgText x={tip.x + TIP_W / 2} y={tip.y + 18} fontSize={12} fill={colors.textMuted}
                      fontWeight="600" textAnchor="middle">
                      {sel.s.name.length > 16 ? `${sel.s.name.slice(0, 15)}…` : sel.s.name}
                    </SvgText>
                    <SvgText x={tip.x + TIP_W / 2} y={tip.y + 36} fontSize={14} fill={colors.textPrimary}
                      fontWeight="700" textAnchor="middle">
                      {formatHeight(sel.p.cm, unit)}
                    </SvgText>
                    <SvgText x={tip.x + TIP_W / 2} y={tip.y + 50} fontSize={10} fill={colors.textMuted} textAnchor="middle">
                      {tipDate(sel.p.x)}
                    </SvgText>
                  </G>
                )}
              </Svg>

              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={(e) => handlePress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
              />
            </View>
          )
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    },
    chipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText:       { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    chipTextActive: { color: colors.onPrimary },
    empty: {
      textAlign: 'center', color: colors.textFaint, fontSize: 14,
      paddingVertical: 40, paddingHorizontal: 24,
    },
  });
}
