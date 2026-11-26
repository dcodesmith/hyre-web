import { type FieldMetadata, getInputProps } from "@conform-to/react";
import { cn } from "cn";
import {
  CameraIcon,
  CheckIcon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { type DragEvent, useMemo, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "~/components/ui/field";
import { useImageFilePreviews } from "~/hooks/use-image-file-previews";
import { useSelfieCamera } from "~/hooks/use-selfie-camera";

const EMPTY_FILES: readonly File[] = [];
const LICENSE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const SELFIE_TIPS = [
  "Stay in a well lit area",
  "Look straight at the camera",
  "No sunglasses or filters",
] as const;

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function OnboardingLicenseUploadField({
  field,
  label = "Upload license",
}: {
  readonly field: FieldMetadata<File | undefined>;
  readonly label?: string;
}) {
  const [selectedFile, setSelectedFile] = useState<File>();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageFiles = useMemo(
    () => (selectedFile?.type.startsWith("image/") ? [selectedFile] : EMPTY_FILES),
    [selectedFile],
  );
  const [preview] = useImageFilePreviews(imageFiles);
  const inputProps = getInputProps(field, { type: "file" });
  const hasError = Boolean(field.errors?.length);

  function assignFile(file: File | undefined) {
    const input = inputRef.current;
    if (input) {
      if (file) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
      } else {
        input.value = "";
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setSelectedFile(file);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) assignFile(droppedFile);
  }

  return (
    <Field data-invalid={hasError}>
      <FieldLabel htmlFor={field.id}>{label}</FieldLabel>
      <div className="relative">
        <input
          {...inputProps}
          ref={inputRef}
          accept={LICENSE_ACCEPT}
          className="sr-only peer"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? field.errorId : `${field.id}-hint`}
          onChange={(event) => setSelectedFile(event.currentTarget.files?.[0])}
        />
        {selectedFile ? (
          <div
            className={cn(
              "flex items-start justify-between gap-3 rounded-md border border-dashed bg-background p-4 shadow-xs transition-colors",
              hasError ? "border-destructive" : "border-input",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-15 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-muted/40">
                {preview ? (
                  <img
                    src={preview.url}
                    alt={`${selectedFile.name} preview`}
                    className="size-full object-cover"
                  />
                ) : (
                  <FileTextIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)} &middot; upload complete
                </p>
                <div className="mt-1 h-2 w-40 max-w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-full rounded-full bg-foreground" />
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${selectedFile.name}`}
              onClick={() => assignFile(undefined)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor={field.id}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-md border border-dashed bg-background px-4 py-4 text-center shadow-xs transition-colors hover:bg-muted/30 peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
              hasError ? "border-destructive" : "border-input",
              isDragging ? "border-foreground bg-muted/40" : null,
            )}
          >
            <UploadIcon className="size-4 text-foreground" aria-hidden="true" />
            <span className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-medium text-foreground">Tap to upload</span>
              <span id={`${field.id}-hint`} className="max-w-52 text-xs text-muted-foreground">
                Acceptable formats: JPEG, PNG, WebP or PDF under 5&nbsp;MB
              </span>
            </span>
          </label>
        )}
      </div>
      <FieldError id={field.errorId} errors={field.errors?.map((message) => ({ message }))} />
    </Field>
  );
}

type OnboardingSelfieCardProps = {
  readonly field: {
    readonly errorId: string;
    readonly errors?: string[];
    readonly id: string;
    readonly name: string;
  };
};

export function OnboardingSelfieCard({ field }: OnboardingSelfieCardProps) {
  const [selfie, setSelfie] = useState<File>();
  const inputRef = useRef<HTMLInputElement>(null);
  const files = useMemo(() => (selfie ? [selfie] : EMPTY_FILES), [selfie]);
  const [preview] = useImageFilePreviews(files);
  const hasError = Boolean(field.errors?.length);

  function selectSelfie(file: File) {
    const input = inputRef.current;
    if (input) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setSelfie(file);
  }

  const camera = useSelfieCamera(selectSelfie);
  const descriptionId = `${field.id}-description`;

  return (
    <>
      <FieldSet className="gap-2" data-invalid={hasError}>
        <FieldLegend variant="label" className="mb-2">
          Selfie
        </FieldLegend>
        <input
          ref={inputRef}
          id={field.id}
          name={field.name}
          type="file"
          hidden
          tabIndex={-1}
          aria-hidden="true"
          accept="image/jpeg,image/png,image/webp"
          onClick={(event) => event.preventDefault()}
          onKeyDown={(event) => event.preventDefault()}
          onChange={(event) => setSelfie(event.currentTarget.files?.[0])}
        />
        <div
          className={cn(
            "flex flex-col gap-6 rounded-md border bg-background p-4 shadow-xs",
            hasError ? "border-destructive" : "border-input",
          )}
        >
          <div className="flex items-center justify-center rounded-sm bg-muted p-4">
            <div className="flex h-[93px] w-[152px] items-center justify-center overflow-hidden rounded-sm bg-background">
              {preview ? (
                <img
                  src={preview.url}
                  alt="Selected selfie preview"
                  width={152}
                  height={93}
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          </div>

          {preview ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold leading-6 text-foreground">Looking good!</p>
                <p id={descriptionId} className="text-sm leading-5 text-muted-foreground">
                  Your selfie is ready to submit, you can retake the selfie if you&apos;d like to
                  change it before submission
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-md sm:w-44"
                aria-describedby={`${descriptionId}${hasError ? ` ${field.errorId}` : ""}`}
                aria-invalid={hasError || undefined}
                onClick={() => void camera.openCamera()}
              >
                <CameraIcon aria-hidden="true" />
                Retake
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold leading-6 text-foreground">
                  Take a quick selfie
                </p>
                <p id={descriptionId} className="text-sm leading-5 text-muted-foreground">
                  This becomes your profile picture once you&apos;re approved
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-sm text-foreground">
                <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
                <span>We&apos;ll compare it with your NIN photo</span>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm text-foreground">
                {SELFIE_TIPS.map((tip) => (
                  <li key={tip} className="flex items-center gap-2">
                    <CheckIcon className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-md sm:w-44"
                aria-describedby={`${descriptionId}${hasError ? ` ${field.errorId}` : ""}`}
                aria-invalid={hasError || undefined}
                onClick={() => void camera.openCamera()}
              >
                <CameraIcon aria-hidden="true" />
                Take selfie
              </Button>
            </div>
          )}
        </div>
        <FieldError id={field.errorId} errors={field.errors?.map((message) => ({ message }))} />
      </FieldSet>

      <Dialog
        open={camera.open}
        onOpenChange={(open) => {
          if (!open) camera.closeCamera();
        }}
      >
        <DialogContent className="overscroll-contain">
          <DialogHeader>
            <DialogTitle>Take a selfie</DialogTitle>
            <DialogDescription>
              Face the camera in good light, then capture the photo.
            </DialogDescription>
          </DialogHeader>
          {camera.cameraError ? (
            <p className="text-sm text-destructive" role="alert">
              {camera.cameraError}
            </p>
          ) : (
            <video
              ref={camera.attachVideo}
              autoPlay
              playsInline
              muted
              aria-label="Front camera preview"
              className="aspect-3/4 w-full rounded-md bg-muted object-cover"
            />
          )}
          <DialogFooter>
            <Button type="button" onClick={camera.capture} disabled={Boolean(camera.cameraError)}>
              Capture photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
