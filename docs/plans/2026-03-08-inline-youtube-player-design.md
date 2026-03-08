# Inline YouTube Video Player — Design

## Goal

Replace the "open in new tab" behavior on Chef's Table video cards with an in-app modal player, so users can watch recipe videos without leaving the app.

## Current State

- Chef video results render as `ChefVideoCard` components in a grid on `/chef-results`
- Each card is an `<a>` tag linking to `https://www.youtube.com/watch?v={videoId}` with `target="_blank"`
- Tapping opens YouTube in a new browser tab

## Design

### Interaction Flow

1. User taps a video card → modal overlay opens → video autoplays via YouTube iframe embed
2. User closes modal (X button, tap backdrop, or Escape key) → iframe unmounts, modal closes, back to grid
3. User can tap another card to watch a different video — one video at a time

### Modal Layout

- **Backdrop:** semi-transparent dark overlay (`bg-black/60`) covering the full screen
- **Modal container:** centered, nearly full-width on mobile, max-width on desktop
- **Close button:** white X icon with dark pill background (`bg-black/50 rounded-full`) in top-right corner — always visible regardless of video content
- **Video player:** YouTube iframe embed (`autoplay=1&rel=0`), 16:9 aspect ratio
- **Loading state:** spinner overlay with card thumbnail as placeholder until iframe loads
- **Below the player:** video title (bold) + chef name with emoji
- **"Watch on YouTube" link:** small text link below title for users who want the full YouTube experience

### Sizing

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile (<768px) | 95% viewport width | Nearly full-width, vertically centered |
| Desktop (>=768px) | 800px max-width | Centered with generous backdrop visible |

Video height derived from width at 16:9 aspect ratio.

### Technical Approach

- **New component:** `VideoModal` — accepts `videoId`, `title`, `chefName`, `chefEmoji`, `thumbnail`, `onClose`
- **YouTube embed URL:** `https://www.youtube.com/embed/{videoId}?autoplay=1&rel=0`
- **ChefVideoCard:** replace `<a>` tag with `onClick` handler that sets active video in parent state
- **chef-results page:** manages `activeVideo` state (`ChefVideoResult | null`), renders `VideoModal` when non-null
- **Iframe lifecycle:** unmount iframe on close (prevents audio bleed, clean teardown)
- **Scroll lock:** mobile only (reuse Sidebar pattern), desktop relies on backdrop
- **Autoplay caveat:** `autoplay=1` works most of the time; iOS Safari may block it — the player's built-in play button handles the fallback naturally

### Accessibility

- `role="dialog"` and `aria-modal="true"` on modal container
- `aria-label` on close button
- Focus trap while modal is open
- Return focus to the triggering card on close
- Escape key listener to close

### No Functional Changes

- Video search logic, results grid layout, card thumbnails — all unchanged
- Only the tap behavior changes (modal instead of new tab)
