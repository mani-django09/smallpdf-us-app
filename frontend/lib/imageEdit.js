// Client-side image editing helpers used by the image-converter preview pages.
// Rotation (0/90/180/270) and a small set of CSS-style filters are previewed
// live on the thumbnail and then "baked" into a fresh image File right before
// upload, so the converted output reflects what the user saw.

export const IMAGE_FILTERS = [
  { id: "none", label: "Original", css: "none" },
  { id: "grayscale", label: "Grayscale", css: "grayscale(1)" },
  { id: "sepia", label: "Sepia", css: "sepia(0.85)" },
  { id: "bright", label: "Bright", css: "brightness(1.25)" },
  { id: "contrast", label: "Contrast", css: "contrast(1.3)" },
  { id: "warm", label: "Warm", css: "saturate(1.4) sepia(0.2)" },
  { id: "cool", label: "Cool", css: "saturate(1.15) hue-rotate(-12deg)" },
  { id: "invert", label: "Invert", css: "invert(1)" },
]

export function filterCssById(id) {
  const f = IMAGE_FILTERS.find((x) => x.id === id)
  return f ? f.css : "none"
}

// True when a transform actually changes the image (so we can skip the
// expensive canvas re-encode when the user left everything at defaults).
export function hasTransform(rotation = 0, filterId = "none") {
  return ((rotation % 360) + 360) % 360 !== 0 || (filterId && filterId !== "none")
}

function guessMime(name = "") {
  const ext = (name.split(".").pop() || "").toLowerCase()
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  return "image/jpeg"
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    // Object URLs and data URLs are same-origin; crossOrigin keeps remote ones tainted-free.
    img.crossOrigin = "anonymous"
    img.src = src
  })
}

// Bake rotation + filter into a new image. Returns { blob, file, dataUrl }.
// `src` is any displayable image source (object URL, data URL, or remote URL).
export async function bakeImageTransform({
  src,
  fileName = "image.png",
  rotation = 0,
  filterId = "none",
  mimeType,
  quality = 0.92,
}) {
  const img = await loadImage(src)
  const deg = ((rotation % 360) + 360) % 360
  const swap = deg === 90 || deg === 270
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height

  const canvas = document.createElement("canvas")
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h

  const ctx = canvas.getContext("2d")
  ctx.filter = filterCssById(filterId)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2)

  const type = mimeType || guessMime(fileName)
  const blob = await new Promise((res) => canvas.toBlob(res, type, quality))
  const file = new File([blob], fileName, { type, lastModified: Date.now() })
  const dataUrl = canvas.toDataURL(type, quality)
  return { blob, file, dataUrl }
}
