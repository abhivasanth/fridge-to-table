import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PantryPage } from "@/components/PantryPage";

const { mockUseQuery, mockAddToPantry, mockRemoveFromPantry } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockAddToPantry: vi.fn(),
  mockRemoveFromPantry: vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    pantry: {
      getPantryItems: "getPantryItems",
      addToPantry: mockAddToPantry,
      removeFromPantry: mockRemoveFromPantry,
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (ref: unknown) => ref,
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      id: "user_test",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      firstName: "Test",
      lastName: "User",
    },
    isLoaded: true,
  }),
  UserButton: () => null,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockPantryItems = [
  { _id: "p1", name: "olive oil", normalizedName: "olive oil", category: "oils_fats", createdAt: 1, updatedAt: 1 },
  { _id: "p2", name: "cumin", normalizedName: "cumin", category: "spices_powders", createdAt: 2, updatedAt: 2 },
  { _id: "p3", name: "soy sauce", normalizedName: "soy sauce", category: "sauces_condiments", createdAt: 3, updatedAt: 3 },
  { _id: "p4", name: "salt", normalizedName: "salt", category: "basics", createdAt: 4, updatedAt: 4 },
];

describe("PantryPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockAddToPantry.mockReset();
    mockRemoveFromPantry.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the page title and subtitle", () => {
    mockUseQuery.mockReturnValue(mockPantryItems);
    render(<PantryPage />);
    expect(screen.getByText("My pantry")).toBeInTheDocument();
    expect(screen.getByText(/Items here will show as already owned/)).toBeInTheDocument();
  });

  it("renders empty state when pantry is empty", () => {
    mockUseQuery.mockReturnValue([]);
    render(<PantryPage />);
    expect(screen.getByText(/Your pantry is empty/)).toBeInTheDocument();
  });

  it("renders items grouped by category", () => {
    mockUseQuery.mockReturnValue(mockPantryItems);
    render(<PantryPage />);
    expect(screen.getByText("Oils & fats")).toBeInTheDocument();
    expect(screen.getByText("Spices & powders")).toBeInTheDocument();
    expect(screen.getByText("Sauces & condiments")).toBeInTheDocument();
    expect(screen.getByText("Basics")).toBeInTheDocument();
    expect(screen.getByText("olive oil")).toBeInTheDocument();
    expect(screen.getByText("cumin")).toBeInTheDocument();
    expect(screen.getByText("soy sauce")).toBeInTheDocument();
    expect(screen.getByText("salt")).toBeInTheDocument();
  });

  it("displays item count badge", () => {
    mockUseQuery.mockReturnValue(mockPantryItems);
    render(<PantryPage />);
    expect(screen.getByText("4 items")).toBeInTheDocument();
  });

  it("displays singular 'item' for one item", () => {
    mockUseQuery.mockReturnValue([mockPantryItems[0]]);
    render(<PantryPage />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("calls addToPantry when Add button is clicked", async () => {
    mockUseQuery.mockReturnValue([]);
    mockAddToPantry.mockResolvedValue({ alreadyExists: false });
    render(<PantryPage />);
    const input = screen.getByPlaceholderText("Add an item to your pantry...");
    fireEvent.change(input, { target: { value: "butter" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Add"));
    });
    expect(mockAddToPantry).toHaveBeenCalledWith({
      name: "butter",
    });
  });

  it("calls addToPantry when Enter is pressed", async () => {
    mockUseQuery.mockReturnValue([]);
    mockAddToPantry.mockResolvedValue({ alreadyExists: false });
    render(<PantryPage />);
    const input = screen.getByPlaceholderText("Add an item to your pantry...");
    fireEvent.change(input, { target: { value: "butter" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(mockAddToPantry).toHaveBeenCalledWith({
      name: "butter",
    });
  });

  it("clears input after successful add", async () => {
    mockUseQuery.mockReturnValue([]);
    mockAddToPantry.mockResolvedValue({ alreadyExists: false });
    render(<PantryPage />);
    const input = screen.getByPlaceholderText("Add an item to your pantry...");
    fireEvent.change(input, { target: { value: "butter" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Add"));
    });
    expect(input).toHaveValue("");
  });

  it("shows duplicate message when item already exists", async () => {
    mockUseQuery.mockReturnValue(mockPantryItems);
    mockAddToPantry.mockResolvedValue({ alreadyExists: true, existingId: "p1" });
    render(<PantryPage />);
    const input = screen.getByPlaceholderText("Add an item to your pantry...");
    fireEvent.change(input, { target: { value: "olive oil" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Add"));
    });
    expect(screen.getByText("olive oil is already in your pantry")).toBeInTheDocument();
  });

  it("disables Add button when input is empty", () => {
    mockUseQuery.mockReturnValue([]);
    render(<PantryPage />);
    const addBtn = screen.getByText("Add");
    expect(addBtn).toBeDisabled();
  });

  it("shows undo toast when item is removed", () => {
    mockUseQuery.mockReturnValue(mockPantryItems);
    render(<PantryPage />);
    fireEvent.click(screen.getByLabelText("Remove olive oil"));
    expect(screen.getByText(/Removed/)).toBeInTheDocument();
    expect(screen.getByText("Undo")).toBeInTheDocument();
  });

  it("hides removed item from display while pending", () => {
    mockUseQuery.mockReturnValue(mockPantryItems);
    render(<PantryPage />);
    fireEvent.click(screen.getByLabelText("Remove olive oil"));
    const pills = screen.queryAllByText("olive oil");
    // The only "olive oil" should be in the undo toast message
    expect(pills.every((el) => el.closest('[class*="fixed"]'))).toBe(true);
  });

  it("cancels remove when Undo is clicked", () => {
    mockUseQuery.mockReturnValue(mockPantryItems);
    render(<PantryPage />);
    fireEvent.click(screen.getByLabelText("Remove olive oil"));
    fireEvent.click(screen.getByText("Undo"));
    // Item should reappear as a pill
    expect(screen.getByLabelText("Remove olive oil")).toBeInTheDocument();
    // Toast should be gone
    expect(screen.queryByText("Undo")).not.toBeInTheDocument();
  });

  it("renders back link to search page", () => {
    mockUseQuery.mockReturnValue([]);
    render(<PantryPage />);
    const backLink = screen.getByText(/Back to search/);
    expect(backLink.closest("a")).toHaveAttribute("href", "/");
  });
});
