import { supabase } from './supabase';
import { AppError, unwrap } from './errors';

const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** Center-crops and resizes to 256×256 WebP (≈10–30 KB) before upload. */
async function toSquareWebp(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new AppError('invalid_avatar');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.85));
  if (blob && blob.type === 'image/webp') return blob;
  // Safari < 14 cannot encode WebP
  const jpeg = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
  if (!jpeg) throw new AppError('invalid_avatar');
  return jpeg;
}

export async function uploadAvatar(userId: string, file: File, previousUrl: string | null): Promise<string> {
  if (file.size > MAX_INPUT_BYTES || (file.type && !ACCEPTED.includes(file.type))) throw new AppError('invalid_avatar');
  const blob = await toSquareWebp(file);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  unwrap(await supabase.storage.from('avatars').upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' }));
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  unwrap(await supabase.rpc('set_my_avatar', { p_url: url }));
  await removeOwnAvatarFile(userId, previousUrl);
  return url;
}

export async function clearAvatar(userId: string, previousUrl: string | null) {
  unwrap(await supabase.rpc('set_my_avatar', { p_url: null }));
  await removeOwnAvatarFile(userId, previousUrl);
}

async function removeOwnAvatarFile(userId: string, url: string | null) {
  const marker = `/storage/v1/object/public/avatars/`;
  if (!url || !url.includes(marker)) return;
  const path = url.split(marker)[1];
  if (path?.startsWith(`${userId}/`)) await supabase.storage.from('avatars').remove([path]);
}
