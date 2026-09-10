import { useEffect, useState } from "react";

type ImageFilePreview = {
  readonly file: File;
  readonly url: string;
};

export function useImageFilePreviews(files: readonly File[]) {
  const [previews, setPreviews] = useState<readonly ImageFilePreview[]>([]);

  useEffect(() => {
    const nextPreviews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setPreviews(nextPreviews);
    return () => {
      for (const preview of nextPreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [files]);

  return previews;
}
