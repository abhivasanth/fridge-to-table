// Compresses an image File to a maximum width/height in pixels.
// Returns a base64 data URL (JPEG at 85% quality).
//
// WHY: Convex Action arguments have an 8MB limit.
// Phone photos are commonly 4-10MB. We resize to ≤1024px before sending.
// This runs entirely in the browser using the Canvas API — no server round-trip.
export function compressImage(
  file: File,
  maxDimension: number = 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Only process image files
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions, preserving the aspect ratio
        let { naturalWidth: width, naturalHeight: height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // Draw the resized image onto an in-memory canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG at 85% quality — good balance of size vs. quality
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };

      img.src = e.target!.result as string;
    };

    reader.readAsDataURL(file);
  });
}
