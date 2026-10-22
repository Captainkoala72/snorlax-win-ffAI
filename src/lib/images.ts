// Data URLs keep attachments private to the chat request; no public image hosting.
export interface ImageAttachment { name: string; dataUrl: string }
export const MAX_IMAGES = 3;
// Includes images replayed from history, keeping JSON below Vercel's body limit.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export function imageBytes(image: ImageAttachment): number {
  const encoded = image.dataUrl.slice(image.dataUrl.indexOf(",") + 1);
  return encoded.length * 3 / 4 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
}

export function parseImages(value: unknown): ImageAttachment[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_IMAGES) throw new Error(`Attach up to ${MAX_IMAGES} images.`);
  let total = 0;
  return value.map((item) => {
    if (!item || typeof item.dataUrl !== "string") throw new Error("Invalid image attachment.");
    const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.dataUrl);
    if (!match || match[2].length % 4 !== 0) throw new Error("Use PNG, JPEG, WebP or GIF images.");
    const image = { name: typeof item.name === "string" ? item.name.slice(0, 120) : "Image", dataUrl: item.dataUrl };
    total += imageBytes(image);
    if (total > MAX_IMAGE_BYTES) throw new Error("Images must total 2 MB or less. Try a smaller screenshot.");
    const bytes = atob(match[2].slice(0, 32));
    const valid = match[1] === "png" ? bytes.startsWith("\x89PNG\r\n\x1a\n")
      : match[1] === "jpeg" ? bytes.startsWith("\xff\xd8\xff")
      : match[1] === "gif" ? /^GIF8[79]a/.test(bytes)
      : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
    if (!valid) throw new Error("The attachment is not a valid supported image.");
    return image;
  });
}

export async function readImageFiles(files: File[]): Promise<ImageAttachment[]> {
  if (files.length > MAX_IMAGES) throw new Error(`Attach up to ${MAX_IMAGES} images.`);
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_IMAGE_BYTES) throw new Error("Images must total 2 MB or less. Try a smaller screenshot.");
  const images = await Promise.all(files.map((file) => new Promise<ImageAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => reject(new Error("Could not read the image. Please try again."));
    reader.readAsDataURL(file);
  })));
  return parseImages(images);
}
