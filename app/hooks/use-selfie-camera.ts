import { useEffect, useRef, useState } from "react";

const CAMERA_UNAVAILABLE = "Allow camera access, or upload a passport photograph instead.";
const MAX_SELFIE_EDGE = 1024;

export function selfieFrameSize(width: number, height: number) {
  const scale = Math.min(1, MAX_SELFIE_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

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
    const request = requestRef.current;
    const canvas = document.createElement("canvas");
    const frame = selfieFrameSize(video.videoWidth, video.videoHeight);
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, frame.width, frame.height);
    canvas.toBlob(
      (blob) => {
        if (!blob || request !== requestRef.current) return;
        onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
        closeCamera();
      },
      "image/jpeg",
      0.92,
    );
  }

  return { open, cameraError, openCamera, closeCamera, attachVideo, capture };
}
