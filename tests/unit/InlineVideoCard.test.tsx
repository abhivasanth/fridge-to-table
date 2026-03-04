import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineVideoCard } from "@/components/v3/InlineVideoCard";
import type { ChefVideoResult } from "@/types/recipe";

const notFoundResult: ChefVideoResult = {
  chefId: "gordon-ramsay",
  chefName: "Gordon Ramsay",
  chefEmoji: "🍳",
  found: false,
};

const foundResult: ChefVideoResult = {
  chefId: "gordon-ramsay",
  chefName: "Gordon Ramsay",
  chefEmoji: "🍳",
  found: true,
  video: {
    videoId: "abc123",
    title: "Perfect Steak",
    thumbnail: "https://img.youtube.com/vi/abc123/mqdefault.jpg",
  },
};

describe("InlineVideoCard", () => {
  it("shows not-found message when result.found is false", () => {
    render(<InlineVideoCard result={notFoundResult} />);
    expect(screen.getByText("No video found for these ingredients.")).toBeInTheDocument();
  });

  it("shows thumbnail and play button when result is found", () => {
    render(<InlineVideoCard result={foundResult} />);
    expect(screen.getByAltText("Perfect Steak")).toBeInTheDocument();
    expect(screen.getByText("▶ Tap to play")).toBeInTheDocument();
  });

  it("renders embedded player after tapping thumbnail", () => {
    render(<InlineVideoCard result={foundResult} />);
    fireEvent.click(screen.getByRole("button"));
    const iframe = screen.getByTitle("Perfect Steak");
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("src")).toContain("?autoplay=1");
  });

  it("returns to thumbnail after tapping Close", () => {
    render(<InlineVideoCard result={foundResult} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("✕ Close"));
    expect(screen.getByText("▶ Tap to play")).toBeInTheDocument();
  });

  it("resets player size to normal when Close is tapped after going Bigger", () => {
    render(<InlineVideoCard result={foundResult} />);
    fireEvent.click(screen.getByRole("button")); // open player
    fireEvent.click(screen.getByText("↗ Bigger")); // go bigger
    fireEvent.click(screen.getByText("✕ Close")); // close
    fireEvent.click(screen.getByRole("button")); // reopen
    expect(screen.getByText("↗ Bigger")).toBeInTheDocument(); // should be back to normal
  });
});
