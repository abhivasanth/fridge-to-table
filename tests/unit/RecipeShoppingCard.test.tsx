import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RecipeShoppingCard } from "@/components/RecipeShoppingCard";

const {
  mockUseQuery,
  mockAddToPantry,
  mockAddToShoppingList,
  mockRemoveFromShoppingList,
} = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockAddToPantry: vi.fn().mockResolvedValue(undefined),
  mockAddToShoppingList: vi.fn().mockResolvedValue(undefined),
  mockRemoveFromShoppingList: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    pantry: {
      getPantryItems: "getPantryItems",
      addToPantry: mockAddToPantry,
    },
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

vi.mock("@/lib/session", () => ({
  getSessionId: () => "test-session-123",
}));

const shoppingList = [
  "2 cups flour",
  "1 tsp cumin",
  "to taste salt and pepper",
  "3 tomatoes",
];

describe("RecipeShoppingCard", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockAddToShoppingList.mockClear().mockResolvedValue(undefined);
    mockRemoveFromShoppingList.mockClear().mockResolvedValue(undefined);
    mockAddToPantry.mockClear().mockResolvedValue(undefined);
  });

  function setupMocks(
    pantryItems: { _id: string; normalizedName: string }[] = [],
    shoppingItems: { _id: string; normalizedName: string }[] = []
  ) {
    mockUseQuery.mockImplementation((apiRef: unknown) => {
      if (apiRef === "getPantryItems") return pantryItems;
      if (apiRef === "getShoppingListItems") return shoppingItems;
      return undefined;
    });
  }

  it("renders shopping list heading and items", () => {
    setupMocks();
    render(<RecipeShoppingCard shoppingList={shoppingList} />);
    expect(screen.getByText("🛒 Shopping List")).toBeInTheDocument();
    expect(screen.getByText("2 cups flour")).toBeInTheDocument();
    expect(screen.getByText("1 tsp cumin")).toBeInTheDocument();
  });

  it("returns null when shoppingList is empty", () => {
    setupMocks();
    const { container } = render(<RecipeShoppingCard shoppingList={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows + button and 'already have it' for default state items", () => {
    setupMocks();
    render(<RecipeShoppingCard shoppingList={shoppingList} />);
    const addButtons = screen.getAllByLabelText(/Add .* to shopping list/);
    expect(addButtons.length).toBeGreaterThan(0);
    const haveItLinks = screen.getAllByText("already have it");
    expect(haveItLinks.length).toBeGreaterThan(0);
  });

  it("hides items that are in the pantry", () => {
    setupMocks([
      { _id: "p1", normalizedName: "flour" },
      { _id: "p2", normalizedName: "cumin" },
    ]);
    render(<RecipeShoppingCard shoppingList={shoppingList} />);
    expect(screen.queryByText("2 cups flour")).not.toBeInTheDocument();
    expect(screen.queryByText("1 tsp cumin")).not.toBeInTheDocument();
    expect(screen.getByText("3 tomatoes")).toBeInTheDocument();
  });

  it("hides compound ingredient when all parts are in pantry", () => {
    setupMocks([
      { _id: "p1", normalizedName: "salt" },
      { _id: "p2", normalizedName: "pepper" },
    ]);
    render(<RecipeShoppingCard shoppingList={shoppingList} />);
    expect(screen.queryByText("to taste salt and pepper")).not.toBeInTheDocument();
  });

  it("returns null when all items are in pantry", () => {
    setupMocks([
      { _id: "p1", normalizedName: "flour" },
      { _id: "p2", normalizedName: "cumin" },
      { _id: "p3", normalizedName: "salt" },
      { _id: "p4", normalizedName: "pepper" },
      { _id: "p5", normalizedName: "tomatoe" },
    ]);
    const { container } = render(
      <RecipeShoppingCard shoppingList={shoppingList} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows checkmark and 'added to list' for items in shopping list", () => {
    setupMocks([], [{ _id: "s1", normalizedName: "flour" }]);
    render(<RecipeShoppingCard shoppingList={shoppingList} />);
    expect(screen.getByLabelText(/Remove flour.* from shopping list/)).toBeInTheDocument();
    expect(screen.getByText("added to list")).toBeInTheDocument();
  });

  it("calls addToShoppingList when + button is clicked", async () => {
    setupMocks();
    render(<RecipeShoppingCard shoppingList={["3 tomatoes"]} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/Add .* to shopping list/));
    });
    expect(mockAddToShoppingList).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "test-session-123", source: "recipe" })
    );
  });

  it("calls addToPantry when 'already have it' is clicked", async () => {
    setupMocks();
    render(<RecipeShoppingCard shoppingList={["3 tomatoes"]} />);
    await act(async () => {
      fireEvent.click(screen.getByText("already have it"));
    });
    expect(mockAddToPantry).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "test-session-123" })
    );
  });

  it("handles loading state (undefined queries) without crashing", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<RecipeShoppingCard shoppingList={shoppingList} />);
    expect(screen.getByText("🛒 Shopping List")).toBeInTheDocument();
  });
});
