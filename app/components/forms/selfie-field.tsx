import { CameraIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useImageFilePreviews } from "~/hooks/use-image-file-previews";
import { useSelfieCamera } from "~/hooks/use-selfie-camera";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "../ui/field";

const EMPTY_FILES: readonly File[] = [];

type SelfieFieldProps = {
  readonly field: {
    readonly errorId: string;
    readonly errors?: string[];
    readonly id: string;
    readonly name: string;
  };
};

export function SelfieField({ field }: SelfieFieldProps) {
  const [selfie, setSelfie] = useState<File>();
  const inputRef = useRef<HTMLInputElement>(null);
  const files = useMemo(() => (selfie ? [selfie] : EMPTY_FILES), [selfie]);
  const [preview] = useImageFilePreviews(files);

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
      <FieldSet
        className="gap-2 data-[invalid=true]:text-destructive"
        data-invalid={Boolean(field.errors)}
      >
        <FieldLegend variant="label">Selfie</FieldLegend>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          aria-describedby={`${descriptionId}${field.errors ? ` ${field.errorId}` : ""}`}
          aria-invalid={Boolean(field.errors) || undefined}
          onClick={() => void camera.openCamera()}
        >
          <CameraIcon aria-hidden="true" />
          Take selfie
        </Button>
        <input
          ref={inputRef}
          id={field.id}
          name={field.name}
          type="file"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setSelfie(event.currentTarget.files?.[0])}
        />
        <FieldDescription id={descriptionId}>
          Take a clear selfie in good light. After approval, this becomes your profile picture.
          Maximum 5 MB.
        </FieldDescription>
        <FieldError id={field.errorId} errors={field.errors?.map((message) => ({ message }))} />
      </FieldSet>
      {preview ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <img
            src={preview.url}
            alt="Selected selfie preview"
            width={80}
            height={80}
            className="size-20 rounded-md object-cover"
          />
          <span className="text-sm text-muted-foreground">Selfie ready to submit</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <CameraIcon className="size-5" aria-hidden="true" />
          Staff will compare this selfie with your NIN photo before approval.
        </div>
      )}
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
