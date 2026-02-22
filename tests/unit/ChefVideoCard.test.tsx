import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
    render(<ChefVideoCard result={foundResult} />);
    expect(screen.getByText("Gordon's Perfect Pasta")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      foundResult.video!.thumbnail
    );
  });

  it("links to YouTube when found", () => {
    render(<ChefVideoCard result={foundResult} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abc123"
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows no result state when not found", () => {
    render(<ChefVideoCard result={notFoundResult} />);
    expect(screen.getByText("Jamie Oliver")).toBeInTheDocument();
    expect(screen.getByText(/no video found/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
