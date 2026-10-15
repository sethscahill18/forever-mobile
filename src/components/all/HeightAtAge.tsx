import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAppTheme } from '../../store/appTheme.store';
import { ThemeColors } from '../../theme/tokens';
import { formatHeight, formatDelta } from '../../utils/weight';
import { dateAtAge, formatAge, formatAgeLabel } from '../../utils/age';
import { heightAtDate } from '../../utils/growthStats';
import { ProfileAvatar } from './ProfileAvatar';
import { InsightProfile } from './InsightSections';

// Half-year steps while little, whole years after.
const CANDIDATE_AGES: number[] = [
  0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
];

export function HeightAtAge({ items, unit }: { items: InsightProfile[]; unit: 'cm' | 'ft' }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const now = Date.now();

  const withDob = items.filter((i) => i.profile.dateOfBirth != null);
  const missingDob = items.filter((i) => i.profile.dateOfBirth == null);

  // Ages that at least one profile has data for, with how many do.
  const available = useMemo(() => {
    return CANDIDATE_AGES
      .map((age) => ({
        age,
        count: withDob.filter((i) => {
          const at = dateAtAge(i.profile.dateOfBirth!, age);
          return at <= now && heightAtDate(i.stats.points, at) != null;
        }).length,
      }))
      .filter((a) => a.count > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const [selected, setSelected] = useState<number | null>(null);

  // Default to the oldest age where 2+ profiles can be compared (else oldest with any data).
  useEffect(() => {
    if (available.length === 0) return;
    if (selected != null && available.some((a) => a.age === selected)) return;
    const comparable = available.filter((a) => a.count >= 2);
    const pick = comparable.length > 0 ? comparable[comparable.length - 1] : available[available.length - 1];
    setSelected(pick.age);
  }, [available, selected]);

  if (withDob.length === 0 && missingDob.length === 0) return null;

  const rows = selected == null
    ? []
    : withDob
        .map((i) => {
          const at = dateAtAge(i.profile.dateOfBirth!, selected);
          const h = at <= now ? heightAtDate(i.stats.points, at) : null;
          return { item: i, h };
        })
        .filter((r) => r.h != null)
        .sort((a, b) => b.h!.cm - a.h!.cm);
  const maxCm = rows.length > 0 ? rows[0].h!.cm : 1;
  const noData = withDob.filter((i) => !rows.some((r) => r.item.profile.id === i.profile.id));

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Height at the same age</Text>

      {available.length > 0 && selected != null ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {available.map((a) => (
              <Pressable
                key={a.age}
                style={[styles.chip, selected === a.age && styles.chipActive]}
                onPress={() => setSelected(a.age)}
              >
                <Text style={[styles.chipText, selected === a.age && styles.chipTextActive]}>
                  {formatAgeLabel(a.age)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {rows.map(({ item, h }, idx) => {
            const latest = item.stats.points[item.stats.points.length - 1];
            const gain = latest ? latest.cm - h!.cm : 0;
            return (
              <Pressable
                key={item.profile.id}
                style={styles.row}
                onPress={() => router.push({ pathname: '/profile-timeline', params: { id: item.profile.id } })}
              >
                <ProfileAvatar profile={item.profile} color={item.color} size={34} />
                <View style={styles.rowText}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.profile.name}</Text>
                    <Text style={styles.value}>
                      {h!.estimated ? '≈ ' : ''}{formatHeight(h!.cm, unit)}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.bar,
                        { width: `${Math.max(8, (h!.cm / maxCm) * 100)}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                  <Text style={styles.rowSub}>
                    {idx === 0 && rows.length > 1 ? 'Tallest at this age · ' : ''}
                    Now {formatAge(item.profile.dateOfBirth!, now)}
                    {latest && gain > 0.05 ? ` · ${formatDelta(gain, unit)} since` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {rows.length === 1 && (
            <Text style={styles.note}>
              Only one profile has measurements around {formatAgeLabel(selected)}. Pick another age to compare.
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.note}>
          {withDob.length === 0
            ? 'Add a date of birth to see how heights compare at the same age.'
            : 'Heights will appear here once measurements cover a birthday age.'}
        </Text>
      )}

      {(noData.length > 0 || missingDob.length > 0) && available.length > 0 && (
        <View style={styles.footer}>
          {missingDob.map((i) => (
            <Pressable
              key={i.profile.id}
              onPress={() => router.push({ pathname: '/edit-profile', params: { id: i.profile.id } })}
            >
              <Text style={styles.footerText}>
                Add a date of birth for <Text style={styles.footerLink}>{i.profile.name}</Text> to include them.
              </Text>
            </Pressable>
          ))}
          {noData.length > 0 && (
            <Text style={styles.footerText}>
              No data at this age: {noData.map((i) => i.profile.name).join(', ')}
            </Text>
          )}
        </View>
      )}
      {available.length === 0 && missingDob.length > 0 && withDob.length > 0 && (
        <View style={styles.footer}>
          {missingDob.map((i) => (
            <Text key={i.profile.id} style={styles.footerText}>
              Add a date of birth for {i.profile.name} to include them.
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: 16, marginBottom: 16, overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    heading: {
      fontSize: 14, fontWeight: '700', color: colors.textSecondary,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    chips: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    },
    chipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText:       { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    chipTextActive: { color: colors.onPrimary },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    rowText: { flex: 1 },
    rowTop:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    rowName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textSecondary },
    value:   { fontSize: 15, fontWeight: '700', color: colors.primary },
    track:   { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 6, overflow: 'hidden' },
    bar:     { height: 6, borderRadius: 3 },
    rowSub:  { fontSize: 12, color: colors.textMuted, marginTop: 6 },
    note: {
      fontSize: 13, color: colors.textMuted, lineHeight: 18,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    footer: {
      paddingHorizontal: 16, paddingVertical: 12, gap: 4,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    footerText: { fontSize: 12, color: colors.textMuted },
    footerLink: { color: colors.primary, fontWeight: '600' },
  });
}
