import { useEffect, useRef, useState } from "react";

const CAMERA_UNAVAILABLE = "Allow camera access, or upload a passport photograph instead.";

function stopStream(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

export function useSelfieCamera(onCapture: (file: File) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string>();

  useEffect(
    () => () => {
      requestRef.current += 1;
      stopStream(streamRef.current);
      streamRef.current = null;
    },
    [],
  );

  function closeCamera() {
    requestRef.current += 1;
    stopStream(streamRef.current);
    streamRef.current = null;
    setOpen(false);
  }

  async function openCamera() {
    const request = ++requestRef.current;
    setCameraError(undefined);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(CAMERA_UNAVAILABLE);
      setOpen(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      if (request !== requestRef.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setOpen(true);
    } catch {
      if (request === requestRef.current) {
        setCameraError(CAMERA_UNAVAILABLE);
        setOpen(true);
      }
    }
  }

  function attachVideo(node: HTMLVideoElement | null) {
    videoRef.current = node;
    if (node && streamRef.current) node.srcObject = streamRef.current;
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
        closeCamera();
      },
      "image/jpeg",
      0.92,
    );
  }

  return { open, cameraError, openCamera, closeCamera, attachVideo, capture };
}
