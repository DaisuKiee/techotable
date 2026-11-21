import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Crop, RotateCw, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { ModalShell, ModalHeader, ModalFooter, ModalButton, useModalTitleId } from './modal/ModalShell';

/**
 * Square crop for a profile photo.
 *
 * Avatars are shown as circles with `object-cover`, so whatever is uploaded is
 * centre-cropped by the browser anyway - a tall phone photo loses its top and
 * bottom with no say in the matter. This lets the person choose the square
 * first: drag to move, pinch or scroll to zoom, rotate a quarter turn at a
 * time for photos that came off a phone sideways.
 *
 * Written against the canvas directly rather than pulling in a crop library:
 * the whole job is one transform, and the output has to satisfy the server's
 * own rules (2 MB, and an extension AND mime type matching jpeg/jpg/png/gif),
 * which is easier to guarantee when we encode it ourselves.
 *
 * The preview and the exported canvas use the SAME transform, derived once in
 * `geometry()`, so what is inside the circle is exactly what gets uploaded.
 */

const OUTPUT_PX = 512;   // what we upload: plenty for a 128px avatar on a 2x screen
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const JPEG_QUALITY = 0.9;
const NUDGE_PX = 12;     // arrow-key step

/** Clamp a number into a range. */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const AvatarCropper = ({ file, onCancel, onCropped, busy = false }) => {
  const titleId = useModalTitleId();
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const [src, setSrc] = useState(null);
  const [natural, setNatural] = useState(null); // { w, h }
  const [loadError, setLoadError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0 | 90 | 180 | 270
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [boxSize, setBoxSize] = useState(320);
  const [working, setWorking] = useState(false);

  /* ----------------------------------------------------- load the file --- */

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The crop box is square and responsive; measure it so the maths below and
  // the exported canvas agree about what "the box" is.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setBoxSize(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [src]);

  /* ------------------------------------------------------------ geometry -- */

  /**
   * The single source of truth for how the image sits in the box.
   *
   * `cover` is the scale at which the image exactly fills the square at zoom 1
   * (accounting for a quarter turn, which swaps width and height). `max`
   * is how far the image may be dragged before a corner would show.
   */
  const geometry = useCallback(() => {
    if (!natural) return null;
    const turned = rotation === 90 || rotation === 270;
    const w = turned ? natural.h : natural.w;
    const h = turned ? natural.w : natural.h;
    const cover = Math.max(boxSize / w, boxSize / h);
    const scale = cover * zoom;
    return {
      scale,
      // Half the overhang on each axis: the furthest the centre may move.
      maxX: Math.max(0, (w * scale - boxSize) / 2),
      maxY: Math.max(0, (h * scale - boxSize) / 2),
    };
  }, [natural, rotation, zoom, boxSize]);

  /** Keep the image covering the box after any zoom or rotation change. */
  const clampOffset = useCallback((next) => {
    const g = geometry();
    if (!g) return { x: 0, y: 0 };
    return { x: clamp(next.x, -g.maxX, g.maxX), y: clamp(next.y, -g.maxY, g.maxY) };
  }, [geometry]);

  useEffect(() => {
    setOffset((o) => clampOffset(o));
  }, [zoom, rotation, boxSize, clampOffset]);

  /* -------------------------------------------------------- interaction -- */

  const onPointerDown = (e) => {
    if (!natural) return;
    // Record the drag BEFORE asking for pointer capture: capture throws for a
    // pointer the browser does not consider active, and when that happened
    // first the drag was never registered at all and the photo would not move.
    // Capture is an optimisation (it keeps the drag alive if the cursor leaves
    // the box), not a requirement.
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: offset };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* no capture available; the element's own handlers still track the drag */
    }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset(clampOffset({
      x: d.from.x + (e.clientX - d.x),
      y: d.from.y + (e.clientY - d.y),
    }));
  };

  const endDrag = (e) => {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
  };

  const onWheel = (e) => {
    if (!natural) return;
    e.preventDefault();
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_ZOOM, MAX_ZOOM));
  };

  const onKeyDown = (e) => {
    if (!natural) return;
    const step = e.shiftKey ? NUDGE_PX * 3 : NUDGE_PX;
    const moves = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    };
    if (moves[e.key]) {
      e.preventDefault();
      setOffset((o) => clampOffset({ x: o.x + moves[e.key].x, y: o.y + moves[e.key].y }));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoom((z) => clamp(z + 0.15, MIN_ZOOM, MAX_ZOOM));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setZoom((z) => clamp(z - 0.15, MIN_ZOOM, MAX_ZOOM));
    }
  };

  const reset = () => { setZoom(1); setRotation(0); setOffset({ x: 0, y: 0 }); };

  /* ------------------------------------------------------------- export -- */

  const exportBlob = () => new Promise((resolve, reject) => {
    const g = geometry();
    const img = imgRef.current;
    if (!g || !img) return reject(new Error('The photo is still loading.'));

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('This browser cannot prepare the image.'));

    // A JPEG has no transparency, so fill first: a transparent PNG would
    // otherwise come out with black corners.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX);
    ctx.imageSmoothingQuality = 'high';

    // Same transform as the preview, scaled from box pixels to output pixels.
    const k = OUTPUT_PX / boxSize;
    ctx.translate(OUTPUT_PX / 2 + offset.x * k, OUTPUT_PX / 2 + offset.y * k);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(g.scale * k, g.scale * k);
    ctx.drawImage(img, -natural.w / 2, -natural.h / 2, natural.w, natural.h);

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the image.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  const apply = async () => {
    setWorking(true);
    try {
      const blob = await exportBlob();
      // The server checks the extension as well as the mime type, so the name
      // has to end in .jpg whatever the original was called.
      const base = (file?.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
      onCropped(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
    } catch (err) {
      setLoadError(err.message || 'Could not prepare the image.');
      setWorking(false);
    }
  };

  /* --------------------------------------------------------------- view -- */

  const g = geometry();
  const transform = g
    ? `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${g.scale})`
    : undefined;
  const disabled = !natural || working || busy;

  return (
    <ModalShell onClose={disabled ? undefined : onCancel} size="md" labelledBy={titleId} busy={working || busy}>
      <ModalHeader
        id={titleId}
        icon={Crop}
        title="Position your photo"
        subtitle="Drag to move, scroll or pinch to zoom. Only the circle is saved."
        onClose={onCancel}
        closeDisabled={working || busy}
      />

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/60 p-5 dark:bg-gray-900/40 sm:p-6">
        {loadError ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {loadError}
          </p>
        ) : (
          <>
            {/* Crop stage. The image is moved with a transform; the ring and
                dimmed corners show what will survive the crop. */}
            <div
              ref={boxRef}
              role="application"
              aria-label="Photo position. Use the arrow keys to move, plus and minus to zoom."
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onWheel={onWheel}
              onKeyDown={onKeyDown}
              className="relative mx-auto aspect-square w-full max-w-sm cursor-grab touch-none overflow-hidden rounded-xl bg-gray-900 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500 active:cursor-grabbing dark:ring-offset-gray-900"
            >
              {src && (
                <img
                  ref={imgRef}
                  src={src}
                  alt=""
                  draggable={false}
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                    setLoadError(null);
                  }}
                  onError={() => setLoadError('That image could not be opened. Try a different file.')}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none origin-center select-none"
                  style={{
                    width: natural ? `${natural.w}px` : undefined,
                    height: natural ? `${natural.h}px` : undefined,
                    marginLeft: natural ? `${-natural.w / 2}px` : undefined,
                    marginTop: natural ? `${-natural.h / 2}px` : undefined,
                    transform,
                  }}
                />
              )}

              {/* Circular mask: everything outside the circle is dimmed. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 0 49.5%, #000 50%)',
                  maskImage: 'radial-gradient(circle at 50% 50%, transparent 0 49.5%, #000 50%)',
                }}
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/70" />

              {!natural && !loadError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="mx-auto mt-5 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3">
                <ZoomOut className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  disabled={!natural}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label="Zoom"
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600 disabled:opacity-50 dark:bg-gray-700"
                />
                <ZoomIn className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={!natural}
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                  Rotate
                </button>
                <button
                  type="button"
                  disabled={!natural}
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Reset
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ModalFooter info={<span className="hidden sm:inline">Saved as a {OUTPUT_PX} × {OUTPUT_PX} square</span>}>
        <ModalButton variant="secondary" onClick={onCancel} disabled={working || busy}>
          Cancel
        </ModalButton>
        <ModalButton
          onClick={apply}
          loading={working || busy}
          loadingText="Saving…"
          disabled={disabled || !!loadError}
          icon={Crop}
        >
          Save photo
        </ModalButton>
      </ModalFooter>
    </ModalShell>
  );
};

export default AvatarCropper;
