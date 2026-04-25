/**
 * useVirtualBackground.js
 *
 * Pipeline complet :
 *   Camera stream → <video> (hidden)
 *      → requestAnimationFrame loop
 *      → BodyPix segmentation (TF.js)
 *      → Canvas composite (person + bg)
 *      → canvas.captureStream(30)
 *      → remplace la track vidéo dans tous les RTCPeerConnection
 *
 * Modes supportés :
 *   'none'   - vidéo originale sans traitement
 *   'blur'   - arrière-plan flouté (intensité réglable)
 *   'image'  - remplacement par une image prédéfinie ou uploadée
 *   'color'  - couleur unie (solid color bg)
 */

import { useRef, useState, useCallback, useEffect } from 'react';

// ── Chargement paresseux de TensorFlow + BodyPix ─────────────
// On ne charge ces libs lourdes (~8 MB) que si l'user active la feature
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

        if (!window.bodyPix?.load) {
            throw new Error('BodyPix unavailable after script load');
        }

        const net = await window.bodyPix.load({
            architecture:       'MobileNetV1',
            outputStride:       16,
            multiplier:         0.75,   // vitesse vs précision
            quantBytes:         2,
        });
        return net;
    })();
    return bodyPixPromise;
}

// ── Constantes ────────────────────────────────────────────────
const FPS          = 24;
const FRAME_MS     = 1000 / FPS;
const SEG_INTERVAL = 3;   // segmenter 1 frame sur N pour les perfs

export function useVirtualBackground(localStream, peerConnections, onOutputStreamChange) {
    const [mode,        setMode]        = useState('none');   // 'none'|'blur'|'image'|'color'
    const [blurAmount,  setBlurAmount]  = useState(12);
    const [bgImage,     setBgImage]     = useState(null);     // HTMLImageElement | null
    const [bgColor,     setBgColor]     = useState('#1a1f36');
    const [loading,     setLoading]     = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error,       setError]       = useState('');
    const [active,      setActive]      = useState(false);    // pipeline en cours

    // Refs internes
    const netRef         = useRef(null);
    const rafRef         = useRef(null);
    const frameCountRef  = useRef(0);
    const segmentRef     = useRef(null);     // dernière segmentation
    const canvasRef      = useRef(null);     // canvas de sortie
    const hiddenVideoRef = useRef(null);     // <video> caché pour lire le stream
    const outputStreamRef= useRef(null);    // stream issu du canvas
    const origTrackRef   = useRef(null);    // track vidéo originale

    // ── Créer les éléments DOM cachés une seule fois ──────────
    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.width  = 1280;
        canvas.height = 720;
        canvasRef.current = canvas;

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        hiddenVideoRef.current = video;

        return () => {
            stopPipeline();
        };
    }, []);

    // ── Attacher le stream local à la vidéo cachée ───────────
    useEffect(() => {
        if (!hiddenVideoRef.current || !localStream) return;
        hiddenVideoRef.current.srcObject = localStream;
        hiddenVideoRef.current.play().catch(() => {});
    }, [localStream]);

    useEffect(() => {
        if (active && outputStreamRef.current) {
            onOutputStreamChange?.(outputStreamRef.current);
            return;
        }
        onOutputStreamChange?.(localStream);
    }, [active, localStream, onOutputStreamChange]);

    // ── Boucle de rendu ───────────────────────────────────────
    const renderLoop = useCallback(async () => {
        const video  = hiddenVideoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(renderLoop);
            return;
        }

        const ctx = canvas.getContext('2d');
        canvas.width  = video.videoWidth  || 1280;
        canvas.height = video.videoHeight || 720;
        const W = canvas.width;
        const H = canvas.height;

        frameCountRef.current++;

        // Segmentation toutes les SEG_INTERVAL frames
        if (
            netRef.current &&
            mode !== 'none' &&
            frameCountRef.current % SEG_INTERVAL === 0
        ) {
            try {
                segmentRef.current = await netRef.current.segmentPerson(video, {
                    flipHorizontal:      false,
                    internalResolution:  'medium',
                    segmentationThreshold: 0.7,
                });
            } catch {}
        }

        // ── Rendu selon le mode ───────────────────────────────
        if (mode === 'none' || !segmentRef.current) {
            ctx.drawImage(video, 0, 0, W, H);
        } else {
            const seg = segmentRef.current;

            if (mode === 'blur') {
                // 1. Dessiner le bg flouté
                ctx.filter = `blur(${blurAmount}px)`;
                ctx.drawImage(video, 0, 0, W, H);
                ctx.filter = 'none';

                // 2. Masque personne par-dessus
                applyPersonMask(ctx, video, seg, W, H);

            } else if (mode === 'image' && bgImage) {
                // 1. Bg image (cover)
                drawCover(ctx, bgImage, W, H);

                // 2. Masque personne
                applyPersonMask(ctx, video, seg, W, H);

            } else if (mode === 'color') {
                // 1. Fond uni
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, W, H);

                // 2. Masque personne
                applyPersonMask(ctx, video, seg, W, H);

            } else {
                ctx.drawImage(video, 0, 0, W, H);
            }
        }

        rafRef.current = requestAnimationFrame(renderLoop);
    }, [mode, blurAmount, bgImage, bgColor]);

    // ── Démarrer le pipeline ──────────────────────────────────
    const startPipeline = useCallback(async (newMode) => {
        setLoading(true);
        setLoadingMessage('Préparation du fond virtuel…');
        setError('');

        try {
            // Charger BodyPix si pas encore fait
            if (!netRef.current && newMode !== 'none') {
                setLoadingMessage('Chargement du moteur de segmentation…');
                netRef.current = await loadBodyPix();
            }

            // Sauvegarder la track originale
            if (!origTrackRef.current && localStream) {
                origTrackRef.current = localStream.getVideoTracks()[0];
            }

            // Créer le stream de sortie depuis le canvas
            if (!outputStreamRef.current) {
                setLoadingMessage('Initialisation du rendu vidéo…');
                outputStreamRef.current = canvasRef.current.captureStream(FPS);
            }

            // Remplacer la track vidéo dans tous les PeerConnections
            const canvasTrack = outputStreamRef.current.getVideoTracks()[0];
            if (canvasTrack && peerConnections?.current) {
                peerConnections.current.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(canvasTrack).catch(() => {});
                });
            }

            setActive(true);
            setMode(newMode);

            // Démarrer la boucle
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(renderLoop);

        } catch (err) {
            setError("Impossible d'activer l'arrière-plan virtuel. Vérifiez votre connexion ou réessayez sur un appareil plus puissant.");
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    }, [localStream, peerConnections, renderLoop]);

    // ── Arrêter et restaurer la track originale ───────────────
    const stopPipeline = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        // Restaurer la track vidéo originale dans tous les PCs
        const origTrack = origTrackRef.current;
        if (origTrack && peerConnections?.current) {
            peerConnections.current.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(origTrack).catch(() => {});
            });
        }

        setActive(false);
        setMode('none');
        segmentRef.current = null;
        frameCountRef.current = 0;
        onOutputStreamChange?.(localStream);
    }, [peerConnections]);

    // Redémarrer la boucle quand renderLoop change (mode/blur/image/color)
    useEffect(() => {
        if (!active) return;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(renderLoop);
    }, [renderLoop, active]);

    // ── API publique ──────────────────────────────────────────
    const applyBlur = useCallback((intensity = 12) => {
        setBlurAmount(intensity);
        startPipeline('blur');
    }, [startPipeline]);

    const applyImage = useCallback((imgElement) => {
        setBgImage(imgElement);
        startPipeline('image');
    }, [startPipeline]);

    const applyColor = useCallback((color) => {
        setBgColor(color);
        startPipeline('color');
    }, [startPipeline]);

    const removeBackground = useCallback(() => {
        stopPipeline();
    }, [stopPipeline]);

    // Stream de sortie (à utiliser à la place du stream local pour l'aperçu)
    const getOutputStream = useCallback(() => {
        if (active && outputStreamRef.current) return outputStreamRef.current;
        return localStream;
    }, [active, localStream]);

    return {
        mode, active, loading, loadingMessage, error,
        blurAmount, bgColor,
        applyBlur, applyImage, applyColor, removeBackground,
        getOutputStream,
        canvasRef,
    };
}

// ── Helpers de rendu ──────────────────────────────────────────

/** Dessine la personne segmentée par-dessus le fond */
function applyPersonMask(ctx, video, seg, W, H) {
    // Créer un canvas temporaire pour le masque
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width  = W;
    maskCanvas.height = H;
    const mCtx = maskCanvas.getContext('2d');

    // Dessiner la vidéo complète
    mCtx.drawImage(video, 0, 0, W, H);

    // Appliquer le masque : effacer les pixels non-personne
    const imageData = mCtx.getImageData(0, 0, W, H);
    const { data } = imageData;
    const { data: segData } = seg;

    // segData est un Uint8Array : 1 = personne, 0 = fond
    // On doit redimensionner si nécessaire
    const segW = seg.width;
    const segH = seg.height;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const segX = Math.floor(x * segW / W);
            const segY = Math.floor(y * segH / H);
            const segIdx = segY * segW + segX;
            const isPerson = segData[segIdx] === 1;

            if (!isPerson) {
                // Pixel de fond → transparent
                const idx = (y * W + x) * 4;
                data[idx + 3] = 0;
            }
        }
    }

    mCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(maskCanvas, 0, 0, W, H);
}

/** Dessine une image en mode "cover" sur le canvas */
function drawCover(ctx, img, W, H) {
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = img.naturalWidth  * scale;
    const sh = img.naturalHeight * scale;
    const sx = (W - sw) / 2;
    const sy = (H - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh);
}
