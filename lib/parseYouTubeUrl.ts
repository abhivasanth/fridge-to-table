// lib/parseYouTubeUrl.ts
// Pure function — no browser or Node.js APIs. Safe to import from Convex actions.

export type ParseResult =
  | { type: "handle"; value: string }
  | { type: "channelId"; value: string }
  | { type: "error" };

export function parseYouTubeInput(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { type: "error" };

  // Bare @handle: e.g. "@babish"
  if (/^@[\w.-]+$/.test(trimmed)) {
    return { type: "handle", value: trimmed.slice(1) };
  }

  try {
    const urlStr = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const url = new URL(urlStr);

    if (url.hostname !== "youtube.com" && url.hostname !== "www.youtube.com") {
      return { type: "error" };
    }

    // youtube.com/@handle
    const handleMatch = url.pathname.match(/^\/@([\w.-]+)/);
    if (handleMatch) {
      return { type: "handle", value: handleMatch[1] };
    }

    // youtube.com/channel/UCxxxxxx
    const channelMatch = url.pathname.match(/^\/channel\/(UC[\w-]+)/);
    if (channelMatch) {
      return { type: "channelId", value: channelMatch[1] };
    }

    return { type: "error" };
  } catch {
    return { type: "error" };
  }
}
