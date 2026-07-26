import { desc, eq } from 'drizzle-orm';
import * as ExpoCrypto from 'expo-crypto';
import { db } from '../db/database';
import { measurements, Measurement } from '../db/schema';

export async function getMeasurements(profileId: string): Promise<Measurement[]> {
  return db
    .select()
    .from(measurements)
    .where(eq(measurements.profileId, profileId))
    .orderBy(desc(measurements.measuredAt));
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.delete(measurements).where(eq(measurements.id, id));
}

export async function updateMeasurement(
  id: string,
  data: { isMilestone: number; milestoneName?: string | null; milestoneImage?: string | null },
): Promise<void> {
  await db.update(measurements).set(data).where(eq(measurements.id, id));
}

export async function saveMeasurement(
  profileId: string,
  heightCm: number,
  measuredAt: number,
  heightFt?: number,
  heightIn?: number,
): Promise<void> {
  await db.insert(measurements).values({
    id:          ExpoCrypto.randomUUID(),
    profileId,
    heightCm,
    heightFt:    heightFt ?? null,
    heightIn:    heightIn ?? null,
    measuredAt,
    isMilestone: 0,
    createdAt:   Date.now(),
  });
}
