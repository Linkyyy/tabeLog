import { randomUUID } from "node:crypto";
import { parseEntry, AppError } from "./validation";
import { getEntry, insertEntry, updateEntry } from "./db";
import { savePhoto, removePhoto } from "./storage";
import type { Entry, Photo } from "./types";
export async function writeEntry(request: Request, id?: string) {
  // Vercel's request limit is 4.5 MB; enforce a smaller aggregate limit everywhere.
  if (Number(request.headers.get("content-length")) > 4 * 1024 * 1024)
    throw new AppError("上传内容过大，请减少照片或压缩后重试", 413);
  const form = await request.formData();
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("entry")));
  } catch {
    throw new AppError("记录格式不正确");
  }
  const input = parseEntry(raw);
  const old = id ? await getEntry(id) : null;
  if (id && !old) throw new AppError("这篇日记不存在", 404);
  const keep = input.keepPhotoIds || [];
  if (keep.some((photoId) => !old?.photos.some((p) => p.id === photoId)))
    throw new AppError("照片不属于这篇日记");
  if (old && form.get("updatedAt") !== old.updatedAt)
    throw new AppError("这篇日记已更新，请刷新后重试", 409);
  const files = form.getAll("photos");
  if (files.some((f) => !(f instanceof File)))
    throw new AppError("照片格式不正确");
  if (files.length + keep.length > 6)
    throw new AppError("每篇日记最多上传 6 张照片");
  const uploads: Photo[] = [];
  try {
    for (const f of files) uploads.push(await savePhoto(f as File));
    const { keepPhotoIds: _, ...fields } = input;
    const entry: Entry = {
      ...fields,
      id: id || randomUUID(),
      photos: [
        ...(old?.photos.filter((p) => keep.includes(p.id)) || []),
        ...uploads,
      ],
      createdAt: old?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (old) await updateEntry(entry, old.updatedAt);
    else await insertEntry(entry);
    await Promise.all(
      (old?.photos.filter((p) => !keep.includes(p.id)) || []).map((p) =>
        removePhoto(p.id),
      ),
    );
    return entry;
  } catch (error) {
    await Promise.all(uploads.map((p) => removePhoto(p.id)));
    throw error;
  }
}
