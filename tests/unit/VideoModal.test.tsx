import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoModal } from "@/components/VideoModal";

const props = {
  videoId: "abc123",
  title: "Gordon's Perfect Pasta",
  chefName: "Gordon Ramsay",
  chefEmoji: "🍳",
  thumbnail: "https://img.youtube.com/vi/abc123/mqdefault.jpg",
  onClose: vi.fn(),
};

describe("VideoModal", () => {
  it("renders a YouTube iframe with the correct embed URL", () => {
    render(<VideoModal {...props} />);
    const iframe = screen.getByTitle(props.title);
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/abc123?autoplay=1&rel=0"
    );
  });

  it("renders the video title and chef info", () => {
    render(<VideoModal {...props} />);
    expect(screen.getByText("Gordon's Perfect Pasta")).toBeInTheDocument();
    expect(screen.getByText("Gordon Ramsay")).toBeInTheDocument();
    expect(screen.getByText("🍳")).toBeInTheDocument();
  });

  it("renders a Watch on YouTube link", () => {
    render(<VideoModal {...props} />);
    const link = screen.getByRole("link", { name: /watch on youtube/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abc123"
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<VideoModal {...props} onClose={onClose} />);
    const closeBtn = screen.getByLabelText("Close video");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<VideoModal {...props} onClose={onClose} />);
    const backdrop = screen.getByTestId("video-modal-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<VideoModal {...props} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has correct ARIA attributes for dialog", () => {
    render(<VideoModal {...props} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("renders a copy link button", () => {
    render(<VideoModal {...props} />);
    const copyBtn = screen.getByLabelText("Copy video link");
    expect(copyBtn).toBeInTheDocument();
    expect(screen.getByText("Copy link")).toBeInTheDocument();
  });

  it("copies YouTube URL to clipboard when copy link is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<VideoModal {...props} onClose={vi.fn()} />);
    const copyBtn = screen.getByLabelText("Copy video link");
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abc123");
  });
});
