import { supabase } from './supabase'

/** The one private bucket for CPR documents and player photos (Phase 11). */
export const FILES_BUCKET = 'player-files'

export const MAX_FILE_BYTES = 8 * 1024 * 1024 // matches the bucket's own file_size_limit

export const CPR_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const EXTENSION_OF: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export type FileRejection = 'tooLarge' | 'badType'

/** Client-side checks only — the bucket itself refuses a wrong type or a file over the limit too. */
export function rejectionOf(
  file: File,
  accept: readonly string[] = CPR_FILE_TYPES,
): FileRejection | null {
  if (file.size > MAX_FILE_BYTES) return 'tooLarge'
  if (!accept.includes(file.type)) return 'badType'
  return null
}

/** A parent's upload, before their submission exists: `applications/<submission id>/<child>-<random>.<ext>`. */
export function applicationFilePath(submissionId: string, childIndex: number, file: File): string {
  const ext = EXTENSION_OF[file.type] ?? 'bin'
  return `applications/${submissionId}/${childIndex}-${crypto.randomUUID()}.${ext}`
}

/** An admin/coach upload for an existing player: `players/<player id>/<kind>-<random>.<ext>`. */
export function playerFilePath(playerId: string, kind: 'cpr' | 'avatar', file: File): string {
  const ext = EXTENSION_OF[file.type] ?? 'bin'
  return `players/${playerId}/${kind}-${crypto.randomUUID()}.${ext}`
}

/** Uploads to the given path (never overwrites — every path this app makes is unique). */
export async function uploadFile(path: string, file: File): Promise<void> {
  const { error } = await supabase.storage
    .from(FILES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
}

/** Best-effort tidy-up after replacing a player's file — the RLS delete policy still applies. */
export async function removeFile(path: string): Promise<void> {
  await supabase.storage.from(FILES_BUCKET).remove([path])
}

/** A short-lived URL to view or download a private file. Callers should not cache it long. */
export async function signedUrl(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export function isImagePath(path: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(path)
}
