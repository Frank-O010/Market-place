"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ACCEPTED_IMAGE_TYPES, imageUrl, MAX_PHOTOS_PER_LISTING, MAX_UPLOAD_BYTES } from "@/lib/images";
import { deletePhoto, finishPhotoUpload, movePhoto, requestPhotoUpload, updatePhotoAlt } from "@/server/actions/photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ManagedPhoto = { id: string; storageKey: string; altText: string };

/** Add, reorder, describe and remove a listing's photos. The first photo is the cover. */
export function PhotoManager({ listingId, photos }: { listingId: string; photos: ManagedPhoto[] }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [busy, startTransition] = React.useTransition();
  const remaining = MAX_PHOTOS_PER_LISTING - photos.length - uploading.length;

  async function uploadOne(file: File): Promise<string | null> {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return `${file.name}: please choose a JPEG, PNG or WebP photo.`;
    }
    if (file.size > MAX_UPLOAD_BYTES) return `${file.name}: photos can be up to 10 MB.`;
    const target = await requestPhotoUpload(listingId, { contentType: file.type, size: file.size });
    if (!target.ok) return `${file.name}: ${target.error}`;
    const put = await fetch(target.data.url, { method: "PUT", headers: target.data.headers, body: file }).catch(
      () => null,
    );
    if (!put?.ok) return `${file.name}: the upload failed. Check your connection and try again.`;
    const done = await finishPhotoUpload(listingId, target.data.key);
    return done.ok ? null : `${file.name}: ${done.error}`;
  }

  async function onFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).slice(0, Math.max(0, remaining));
    if (inputRef.current) inputRef.current.value = "";
    if (!files.length) return;
    setErrors([]);
    setUploading(files.map((f) => f.name));
    const problems: string[] = [];
    // One at a time: kinder to slow mobile connections than parallel uploads.
    for (const file of files) {
      const problem = await uploadOne(file);
      if (problem) problems.push(problem);
      setUploading((names) => names.slice(1));
      router.refresh();
    }
    setErrors(problems);
    if (problems.length < files.length) toast.success("Photos added.");
  }

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error ?? "Something went wrong.");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="photos-heading" className="flex max-w-2xl flex-col gap-3">
      <h2 id="photos-heading" className="text-xl font-semibold">
        Photos
      </h2>
      <p className="text-muted text-sm">
        Add up to {MAX_PHOTOS_PER_LISTING} clear photos. The first one is the cover. Location data is removed from every
        photo.
      </p>
      {errors.length > 0 && (
        <ul role="alert" className="border-danger bg-danger-subtle flex flex-col gap-1 rounded-md border p-3 text-sm">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Listing photos">
        {photos.map((photo, i) => (
          <li key={photo.id} className="border-border bg-surface flex flex-col gap-2 rounded-md border p-2">
            <div className="bg-surface-muted relative aspect-square overflow-hidden rounded">
              {/* eslint-disable-next-line @next/next/no-img-element -- size is pre-generated */}
              <img src={imageUrl(photo.storageKey, "card")} alt={photo.altText} className="size-full object-cover" />
              {i === 0 && (
                <span className="bg-surface absolute top-1 left-1 rounded px-1.5 py-0.5 text-xs font-medium">
                  Cover
                </span>
              )}
            </div>
            <AltTextEditor photo={photo} index={i} onSave={(alt) => run(() => updatePhotoAlt(photo.id, alt))} />
            <div className="flex justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy || i === 0}
                aria-label={`Move photo ${i + 1} earlier`}
                onClick={() => run(() => movePhoto(photo.id, "earlier"))}
              >
                <ArrowLeft aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={`Delete photo ${i + 1}`}
                onClick={() => run(() => deletePhoto(photo.id))}
              >
                <Trash2 aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy || i === photos.length - 1}
                aria-label={`Move photo ${i + 1} later`}
                onClick={() => run(() => movePhoto(photo.id, "later"))}
              >
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </li>
        ))}
        {uploading.map((name) => (
          <li
            key={name}
            className="border-border text-muted flex aspect-square flex-col items-center justify-center gap-2 rounded-md border p-2 text-center text-xs"
          >
            <Loader2 className="size-6 animate-spin" aria-hidden />
            <span className="line-clamp-2 break-all">Uploading {name}</span>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div>
          <input
            ref={inputRef}
            id="photo-input"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => inputRef.current?.click()}
            disabled={uploading.length > 0}
          >
            <Camera aria-hidden /> {photos.length ? "Add more photos" : "Add photos"}
          </Button>
          {/* A real label too, so the file input is reachable for assistive tech and tests. */}
          <label htmlFor="photo-input" className="sr-only">
            Choose photos to upload
          </label>
        </div>
      )}
    </section>
  );
}

function AltTextEditor({
  photo,
  index,
  onSave,
}: {
  photo: ManagedPhoto;
  index: number;
  onSave: (alt: string) => void;
}) {
  const [value, setValue] = React.useState(photo.altText);
  const id = `alt-${photo.id}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">
        Describe photo {index + 1}
      </label>
      <Input
        id={id}
        value={value}
        maxLength={150}
        className="h-11 text-sm"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value.trim() !== photo.altText && onSave(value)}
      />
    </div>
  );
}
