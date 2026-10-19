// Las 4 fotos las incrusta el build desde assets/photos/. Si faltan, se usan tarjetas de relleno.
import photoData from 'virtual:photos';

export async function loadPhotos() {
  return Promise.all([0, 1, 2, 3].map(async (i) => {
    const src = photoData[i];
    if (!src) return null;
    const img = new Image();
    img.src = src;
    try { await img.decode(); return img; } catch (_) { return null; }
  }));
}

export const HAS_PHOTOS = photoData.length;
