// Generates a UUID v4 string using Math.random (no external dependencies needed)
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Returns the anonymous session ID for this browser.
// On first visit, generates a new UUID and saves it to localStorage.
// On subsequent visits, returns the stored UUID.
// This ties favourites to a browser without requiring a login.
export function getSessionId(): string {
  const key = "fridge_session_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const newId = generateUUID();
  localStorage.setItem(key, newId);
  return newId;
}
