import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LoadingChef } from "@/components/LoadingChef";

describe("LoadingChef", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the chef emoji", () => {
    render(<LoadingChef />);
    expect(screen.getByText("👨‍🍳")).toBeInTheDocument();
  });

  it("shows the first message initially", () => {
    render(<LoadingChef />);
    expect(screen.getByText("Checking your fridge...")).toBeInTheDocument();
  });

  it("cycles to the second message after 2 seconds", () => {
    render(<LoadingChef />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Consulting the chef...")).toBeInTheDocument();
  });

  it("cycles to the third message after 4 seconds", () => {
    render(<LoadingChef />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("Almost ready...")).toBeInTheDocument();
  });
});
