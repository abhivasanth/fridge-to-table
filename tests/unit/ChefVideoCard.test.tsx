import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChefVideoCard } from "@/components/ChefVideoCard";
import type { ChefVideoResult } from "@/types/recipe";

const foundResult: ChefVideoResult = {
  chefId: "gordon-ramsay",
  chefName: "Gordon Ramsay",
  chefEmoji: "🍳",
  found: true,
  video: {
    title: "Gordon's Perfect Pasta",
    thumbnail: "https://img.youtube.com/vi/abc123/mqdefault.jpg",
    videoId: "abc123",
  },
};

const notFoundResult: ChefVideoResult = {
  chefId: "jamie-oliver",
  chefName: "Jamie Oliver",
  chefEmoji: "🍕",
  found: false,
};

describe("ChefVideoCard", () => {
  it("renders video thumbnail and title when found", () => {
    render(<ChefVideoCard result={foundResult} onPlay={vi.fn()} />);
    expect(screen.getByText("Gordon's Perfect Pasta")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      foundResult.video!.thumbnail
    );
  });

  it("calls onPlay with the result when clicked", () => {
    const onPlay = vi.fn();
    render(<ChefVideoCard result={foundResult} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onPlay).toHaveBeenCalledWith(foundResult);
  });

  it("does not render a link to YouTube", () => {
    render(<ChefVideoCard result={foundResult} onPlay={vi.fn()} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows play icon overlay on thumbnail", () => {
    render(<ChefVideoCard result={foundResult} onPlay={vi.fn()} />);
    expect(screen.getByLabelText("Play video")).toBeInTheDocument();
  });

  it("shows no result state when not found", () => {
    render(<ChefVideoCard result={notFoundResult} onPlay={vi.fn()} />);
    expect(screen.getByText("Jamie Oliver")).toBeInTheDocument();
    expect(screen.getByText(/no video found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
