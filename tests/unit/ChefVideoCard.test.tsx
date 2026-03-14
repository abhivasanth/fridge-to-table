import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChefVideoCard } from "@/components/ChefVideoCard";

const video = {
  title: "Gordon's Perfect Pasta",
  thumbnail: "https://img.youtube.com/vi/abc123/mqdefault.jpg",
  videoId: "abc123",
};

describe("ChefVideoCard", () => {
  it("renders video thumbnail and title", () => {
    render(
      <ChefVideoCard video={video} chefName="Gordon Ramsay" chefEmoji="🍳" onPlay={vi.fn()} />
    );
    expect(screen.getByText("Gordon's Perfect Pasta")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", video.thumbnail);
  });

  it("calls onPlay with video and chef info when clicked", () => {
    const onPlay = vi.fn();
    render(
      <ChefVideoCard video={video} chefName="Gordon Ramsay" chefEmoji="🍳" onPlay={onPlay} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onPlay).toHaveBeenCalledWith({
      ...video,
      chefName: "Gordon Ramsay",
      chefEmoji: "🍳",
    });
  });

  it("does not render a link to YouTube", () => {
    render(
      <ChefVideoCard video={video} chefName="Gordon Ramsay" chefEmoji="🍳" onPlay={vi.fn()} />
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows play icon overlay on thumbnail", () => {
    render(
      <ChefVideoCard video={video} chefName="Gordon Ramsay" chefEmoji="🍳" onPlay={vi.fn()} />
    );
    expect(screen.getByLabelText("Play video")).toBeInTheDocument();
  });
});
