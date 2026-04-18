import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ShoppingListPage } from "@/components/ShoppingListPage";

const { mockUseQuery, mockAddToShoppingList, mockRemoveFromShoppingList } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockAddToShoppingList: vi.fn(),
  mockRemoveFromShoppingList: vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    shoppingList: {
      getShoppingListItems: "getShoppingListItems",
      addToShoppingList: mockAddToShoppingList,
      removeFromShoppingList: mockRemoveFromShoppingList,
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

const mockShoppingItems = [
  { _id: "s1", name: "tomatoes", normalizedName: "tomato", source: "manual", createdAt: 1, updatedAt: 1 },
  { _id: "s2", name: "chicken breast", normalizedName: "chicken breast", source: "recipe", createdAt: 2, updatedAt: 2 },
  { _id: "s3", name: "basil", normalizedName: "basil", source: "manual", createdAt: 3, updatedAt: 3 },
];

describe("ShoppingListPage", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockAddToShoppingList.mockReset();
    mockRemoveFromShoppingList.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the page title", () => {
    mockUseQuery.mockReturnValue(mockShoppingItems);
    render(<ShoppingListPage />);
    expect(screen.getByText("My shopping list")).toBeInTheDocument();
  });

  it("renders empty state when list is empty", () => {
    mockUseQuery.mockReturnValue([]);
    render(<ShoppingListPage />);
    expect(screen.getByText(/Your shopping list is empty/)).toBeInTheDocument();
  });

  it("renders all shopping list items", () => {
    mockUseQuery.mockReturnValue(mockShoppingItems);
    render(<ShoppingListPage />);
    expect(screen.getByText("tomatoes")).toBeInTheDocument();
    expect(screen.getByText("chicken breast")).toBeInTheDocument();
    expect(screen.getByText("basil")).toBeInTheDocument();
  });

  it("displays item count badge", () => {
    mockUseQuery.mockReturnValue(mockShoppingItems);
    render(<ShoppingListPage />);
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("displays singular 'item' for one item", () => {
    mockUseQuery.mockReturnValue([mockShoppingItems[0]]);
    render(<ShoppingListPage />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("calls addToShoppingList when Add button is clicked", async () => {
    mockUseQuery.mockReturnValue([]);
    mockAddToShoppingList.mockResolvedValue({ alreadyExists: false });
    render(<ShoppingListPage />);
    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "milk" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Add"));
    });
    expect(mockAddToShoppingList).toHaveBeenCalledWith({
      userId: "user_test",
      name: "milk",
    });
  });

  it("calls addToShoppingList when Enter is pressed", async () => {
    mockUseQuery.mockReturnValue([]);
    mockAddToShoppingList.mockResolvedValue({ alreadyExists: false });
    render(<ShoppingListPage />);
    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "milk" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(mockAddToShoppingList).toHaveBeenCalledWith({
      userId: "user_test",
      name: "milk",
    });
  });

  it("clears input after successful add", async () => {
    mockUseQuery.mockReturnValue([]);
    mockAddToShoppingList.mockResolvedValue({ alreadyExists: false });
    render(<ShoppingListPage />);
    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "milk" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Add"));
    });
    expect(input).toHaveValue("");
  });

  it("shows duplicate message when item already exists", async () => {
    mockUseQuery.mockReturnValue(mockShoppingItems);
    mockAddToShoppingList.mockResolvedValue({ alreadyExists: true, existingId: "s1" });
    render(<ShoppingListPage />);
    const input = screen.getByPlaceholderText("Add an item...");
    fireEvent.change(input, { target: { value: "tomatoes" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Add"));
    });
    expect(screen.getByText("tomatoes is already on your list")).toBeInTheDocument();
  });

  it("disables Add button when input is empty", () => {
    mockUseQuery.mockReturnValue([]);
    render(<ShoppingListPage />);
    const addBtn = screen.getByText("Add");
    expect(addBtn).toBeDisabled();
  });

  it("shows remove button for each item", () => {
    mockUseQuery.mockReturnValue(mockShoppingItems);
    render(<ShoppingListPage />);
    const removeButtons = screen.getAllByText("remove");
    expect(removeButtons).toHaveLength(3);
  });

  it("renders back link to search page", () => {
    mockUseQuery.mockReturnValue([]);
    render(<ShoppingListPage />);
    const backLink = screen.getByText(/Back to search/);
    expect(backLink.closest("a")).toHaveAttribute("href", "/");
  });
});
