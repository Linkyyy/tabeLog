import "server-only";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { HttpsProxyAgent } from "https-proxy-agent";
import { localMode } from "./config";
import { AppError } from "./validation";
import type { Photo } from "./types";
const photoDir = () =>
  path.join(
    process.env.LOCAL_DATA_DIR || path.join(process.cwd(), ".data"),
    "photos",
  );
let client: S3Client;
function r2() {
  return (client ||= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler:
      process.env.HTTPS_PROXY || process.env.HTTP_PROXY
        ? new NodeHttpHandler({
            httpsAgent: new HttpsProxyAgent(
              (process.env.HTTPS_PROXY || process.env.HTTP_PROXY)!,
            ),
          })
        : undefined,
  }));
}
export async function savePhoto(file: File): Promise<Photo> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024 ||
    !file.size
  )
    throw new AppError("仅支持 5 MB 以内的 JPG、PNG、WebP 图片");
  let body: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40000000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format))
      throw new Error("Unsupported image format");
    body = await image
      .rotate()
      .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AppError("图片无法读取，请选择有效的 JPG、PNG、WebP 文件");
  }
  const id = randomUUID();
  if (localMode) {
    await mkdir(photoDir(), { recursive: true });
    await writeFile(path.join(photoDir(), `${id}.webp`), body);
  } else
    await r2().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `photos/${id}.webp`,
        Body: body,
        ContentType: "image/webp",
      }),
    );
  return { id, url: `/api/photos/${id}` };
}
export async function readPhoto(id: string) {
  if (localMode)
    return new Uint8Array(await readFile(path.join(photoDir(), `${id}.webp`)));
  const response = await r2().send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `photos/${id}.webp`,
    }),
  );
  if (!response.Body) throw new AppError("照片不存在", 404);
  return response.Body.transformToByteArray();
}
export async function removePhoto(id: string) {
  try {
    if (localMode) await unlink(path.join(photoDir(), `${id}.webp`));
    else
      await r2().send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: `photos/${id}.webp`,
        }),
      );
  } catch (error) {
    console.error(
      "Photo cleanup failed",
      error instanceof Error ? error.name : "unknown",
    );
  }
}
