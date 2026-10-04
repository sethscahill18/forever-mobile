import * as FileSystem from 'expo-file-system/legacy';
import * as ExpoCrypto from 'expo-crypto';

/**
 * Copies a picked image into a persistent app-local subdirectory and returns a
 * path RELATIVE to `FileSystem.documentDirectory` (e.g. "milestones/abc.jpg").
 *
 * Why relative, not absolute: iOS can reassign the app's sandbox container
 * UUID between rebuilds/reinstalls, which changes `documentDirectory`'s
 * absolute value. A path stored as `documentDirectory + ...` at save time can
 * point at a container that no longer exists by the time it's read back.
 * Storing a relative path and resolving it against the CURRENT
 * `documentDirectory` at read time (see `resolveDocUri`) avoids that.
 */
export async function saveLocalImageCopy(sourceUri: string, subdir: string): Promise<string> {
  const dir = FileSystem.documentDirectory + subdir + '/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const ext      = sourceUri.split('.').pop() ?? 'jpg';
  const filename = `${ExpoCrypto.randomUUID()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dir + filename });
  return `${subdir}/${filename}`;
}

/**
 * Resolves a stored image reference (relative, new-format) into an absolute
 * `file://` URI usable by <Image>. Also self-heals old absolute paths saved
 * before this fix: those are remapped onto the CURRENT documentDirectory by
 * keeping everything after the stable "/Documents/" segment.
 */
export function resolveDocUri(stored: string | null | undefined): string | null {
  if (!stored) return null;

  if (!stored.includes('://')) {
    // Already relative — resolve against the current container.
    return (FileSystem.documentDirectory ?? '') + stored;
  }

  const marker = '/Documents/';
  const idx = stored.indexOf(marker);
  if (idx === -1) return stored; // unrecognised format — best effort passthrough

  const relative = stored.slice(idx + marker.length);
  return (FileSystem.documentDirectory ?? '') + relative;
}

/** Deletes a stored image reference (relative or legacy absolute) from disk. */
export async function deleteLocalImage(stored: string | null | undefined): Promise<void> {
  const uri = resolveDocUri(stored);
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
