import Image from "next/image";
import { X } from "lucide-react";
import type { ImageAttachment } from "@/lib/images";

export function ImageAttachments({ images, onRemove }: { images: ImageAttachment[]; onRemove?: (index: number) => void }) {
  return <div className="mb-2 flex flex-wrap gap-2">
    {images.map((image, index) => <div key={`${index}-${image.name}`} className="relative overflow-hidden rounded-lg border border-line bg-black/20">
      <Image src={image.dataUrl} alt={image.name || `Attached image ${index + 1}`} width={onRemove ? 96 : 320} height={onRemove ? 72 : 200} unoptimized
        className={onRemove ? "h-20 w-24 object-contain" : "max-h-64 max-w-full object-contain"} />
      {onRemove && <button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => onRemove(index)} className="absolute right-1 top-1 rounded-full bg-black/80 p-1 text-white"><X className="size-3" /></button>}
    </div>)}
  </div>;
}
