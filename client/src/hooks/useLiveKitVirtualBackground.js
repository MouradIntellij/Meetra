import { useCallback, useRef, useState } from 'react';

const FPS = 24;
const SEGMENT_INTERVAL = 3;

let bodyPixPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadBodyPix() {
  if (bodyPixPromise) return bodyPixPromise;

  bodyPixPromise = (async () => {
    if (!window.tf) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
    }
    if (!window.bodyPix) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/body-pix@2.2.0/dist/body-pix.min.js');
    }

    return window.bodyPix.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2,
    });
  })();

  return bodyPixPromise;
}

function drawCover(ctx, img, width, height) {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const scaledWidth = img.naturalWidth * scale;
  const scaledHeight = img.naturalHeight * scale;
  ctx.drawImage(img, (width - scaledWidth) / 2, (height - scaledHeight) / 2, scaledWidth, scaledHeight);
}

function applyPersonMask(ctx, video, segment, width, height) {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskContext = maskCanvas.getContext('2d');
  maskContext.drawImage(video, 0, 0, width, height);

  const imageData = maskContext.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const segmentX = Math.floor((x * segment.width) / width);
      const segmentY = Math.floor((y * segment.height) / height);
      const isPerson = segment.data[(segmentY * segment.width) + segmentX] === 1;

      if (!isPerson) {
        pixels[((y * width) + x) * 4 + 3] = 0;
      }
    }
  }

  maskContext.putImageData(imageData, 0, 0);
  ctx.drawImage(maskCanvas, 0, 0, width, height);
}

function createProcessor({ mode, blurAmount = 12, bgImage = null, bgColor = '#1a1f36' }) {
  const state = {
    canvas: null,
    video: null,
    rafId: null,
    stream: null,
    sourceStream: null,
    net: null,
    segment: null,
    frame: 0,
    destroyed: false,
  };

  const render = async () => {
    if (state.destroyed || !state.video || !state.canvas) return;

    if (state.video.readyState < 2) {
      state.rafId = requestAnimationFrame(render);
      return;
    }

    const width = state.video.videoWidth || 1280;
    const height = state.video.videoHeight || 720;
    const canvas = state.canvas;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    state.frame += 1;
    if (state.net && state.frame % SEGMENT_INTERVAL === 0) {
      try {
        state.segment = await state.net.segmentPerson(state.video, {
          flipHorizontal: false,
          internalResolution: 'medium',
          segmentationThreshold: 0.7,
        });
      } catch {
        state.segment = null;
      }
    }

    if (!state.segment) {
      ctx.drawImage(state.video, 0, 0, width, height);
    } else if (mode === 'blur') {
      ctx.filter = `blur(${blurAmount}px)`;
      ctx.drawImage(state.video, 0, 0, width, height);
      ctx.filter = 'none';
      applyPersonMask(ctx, state.video, state.segment, width, height);
    } else if (mode === 'image' && bgImage) {
      drawCover(ctx, bgImage, width, height);
      applyPersonMask(ctx, state.video, state.segment, width, height);
    } else if (mode === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      applyPersonMask(ctx, state.video, state.segment, width, height);
    } else {
      ctx.drawImage(state.video, 0, 0, width, height);
    }

    state.rafId = requestAnimationFrame(render);
  };

  return {
    name: 'meetra-livekit-virtual-background',
    processedTrack: undefined,
    async init({ track }) {
      state.destroyed = false;
      state.canvas = document.createElement('canvas');
      state.video = document.createElement('video');
      state.video.autoplay = true;
      state.video.playsInline = true;
      state.video.muted = true;
      state.sourceStream = new MediaStream([track]);
      state.video.srcObject = state.sourceStream;

      if (mode !== 'none') {
        state.net = await loadBodyPix();
      }

      await state.video.play().catch(() => {});
      state.stream = state.canvas.captureStream(FPS);
      this.processedTrack = state.stream.getVideoTracks()[0];
      state.rafId = requestAnimationFrame(render);
    },
    async restart(options) {
      await this.destroy();
      await this.init(options);
    },
    async destroy() {
      state.destroyed = true;
      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
      }
      state.stream?.getTracks().forEach((track) => track.stop());
      state.sourceStream = null;
      state.stream = null;
      state.video = null;
      state.canvas = null;
      state.segment = null;
      this.processedTrack = undefined;
    },
  };
}

export function useLiveKitVirtualBackground(localVideoTrack) {
  const [mode, setMode] = useState('none');
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [blurAmount, setBlurAmount] = useState(12);
  const [bgColor, setBgColor] = useState('#1a1f36');
  const processorRef = useRef(null);

  const applyProcessor = useCallback(async (nextMode, options = {}) => {
    if (!localVideoTrack?.setProcessor) {
      setError('La piste camera LiveKit n’est pas encore disponible.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Preparation du fond virtuel LiveKit...');
    setError('');

    try {
      const processor = createProcessor({ mode: nextMode, ...options });
      await localVideoTrack.setProcessor(processor, true);
      processorRef.current = processor;
      setMode(nextMode);
      setActive(nextMode !== 'none');
    } catch {
      setError("Impossible d'activer l'arriere-plan virtuel LiveKit.");
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  }, [localVideoTrack]);

  const removeBackground = useCallback(async () => {
    if (!localVideoTrack?.stopProcessor) return;
    setLoading(true);
    setError('');
    try {
      await localVideoTrack.stopProcessor();
      processorRef.current = null;
      setMode('none');
      setActive(false);
    } catch {
      setError("Impossible de retirer l'arriere-plan virtuel LiveKit.");
    } finally {
      setLoading(false);
    }
  }, [localVideoTrack]);

  const applyBlur = useCallback((intensity = 12) => {
    setBlurAmount(intensity);
    applyProcessor('blur', { blurAmount: intensity });
  }, [applyProcessor]);

  const applyImage = useCallback((imgElement) => {
    applyProcessor('image', { bgImage: imgElement });
  }, [applyProcessor]);

  const applyColor = useCallback((color) => {
    setBgColor(color);
    applyProcessor('color', { bgColor: color });
  }, [applyProcessor]);

  return {
    mode,
    active,
    loading,
    loadingMessage,
    error,
    blurAmount,
    bgColor,
    applyBlur,
    applyImage,
    applyColor,
    removeBackground,
  };
}
