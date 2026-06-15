import { eq, asc } from 'drizzle-orm';
import * as ExpoCrypto from 'expo-crypto';
import { db } from '../db/database';
import { profiles, Profile, NewProfile } from '../db/schema';
import { useActiveProfileStore, getSavedProfileId } from '../store/activeProfile.store';

export async function getProfiles(userId: string): Promise<Profile[]> {
  return db.select().from(profiles).where(eq(profiles.userId, userId)).orderBy(asc(profiles.name));
}

export async function createProfile(
  userId: string,
  data: Omit<NewProfile, 'id' | 'userId' | 'createdAt'>,
): Promise<Profile> {
  const id = ExpoCrypto.randomUUID();
  const now = Date.now();
  await db.insert(profiles).values({ id, userId, createdAt: now, ...data });
  const [created] = await db.select().from(profiles).where(eq(profiles.id, id));
  return created;
}

export async function updateProfile(
  id: string,
  data: Partial<Omit<NewProfile, 'id' | 'userId' | 'createdAt'>>,
): Promise<Profile> {
  await db.update(profiles).set(data).where(eq(profiles.id, id));
  const [updated] = await db.select().from(profiles).where(eq(profiles.id, id));
  // Keep the active profile store in sync
  const current = useActiveProfileStore.getState().profile;
  if (current?.id === id) useActiveProfileStore.getState().setProfile(updated);
  return updated;
}

export async function deleteProfile(id: string): Promise<void> {
  await db.delete(profiles).where(eq(profiles.id, id));
  const current = useActiveProfileStore.getState().profile;
  if (current?.id === id) useActiveProfileStore.getState().clearProfile();
}

export async function initActiveProfile(userId: string): Promise<void> {
  const all = await getProfiles(userId);
  if (all.length === 0) return;
  const savedId = await getSavedProfileId();
  const saved   = all.find((p) => p.id === savedId);
  useActiveProfileStore.getState().setProfile(saved ?? all[0]);
}
