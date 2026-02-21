// UUID v4 format regex for validating stored session IDs
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Uses the Web Crypto API — available in all modern browsers and Node 19+
// More secure than Math.random() for generating session identifiers
function generateUUID(): string {
  return crypto.randomUUID();
}

// Returns the anonymous session ID for this browser.
// On first visit, generates a new UUID and saves it to localStorage.
// On subsequent visits, returns the stored UUID.
// If the stored value is corrupt or invalid, generates a fresh one.
// This ties favourites to a browser without requiring a login.
export function getSessionId(): string {
  const key = "fridge_session_id";
  const existing = localStorage.getItem(key);
  if (existing && UUID_V4_RE.test(existing)) return existing;
  const newId = generateUUID();
  localStorage.setItem(key, newId);
  return newId;
}
