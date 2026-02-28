import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CustomChefCard } from "@/components/CustomChefCard";

const chef = {
  channelId: "UCtest",
  channelName: "Test Chef",
  channelThumbnail: "https://example.com/thumb.jpg",
};

describe("CustomChefCard", () => {
  it("renders the channel name", () => {
    render(<CustomChefCard chef={chef} />);
    expect(screen.getByText("Test Chef")).toBeInTheDocument();
  });

  it("renders the thumbnail image", () => {
    render(<CustomChefCard chef={chef} />);
    const img = screen.getByRole("img", { name: "Test Chef" });
    expect(img).toHaveAttribute("src", "https://example.com/thumb.jpg");
  });

  it("shows remove button when onRemove is provided", () => {
    render(<CustomChefCard chef={chef} onRemove={() => {}} />);
    expect(screen.getByRole("button", { name: /remove test chef/i })).toBeInTheDocument();
  });

  it("does not show remove button when onRemove is not provided", () => {
    render(<CustomChefCard chef={chef} />);
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    render(<CustomChefCard chef={chef} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: /remove test chef/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows Add button when onAdd is provided", () => {
    render(<CustomChefCard chef={chef} onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: /add test chef/i })).toBeInTheDocument();
  });

  it("does not show Add button when onAdd is not provided", () => {
    render(<CustomChefCard chef={chef} />);
    expect(screen.queryByRole("button", { name: /^add/i })).not.toBeInTheDocument();
  });

  it("calls onAdd when Add button is clicked", () => {
    const onAdd = vi.fn();
    render(<CustomChefCard chef={chef} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /add test chef/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
