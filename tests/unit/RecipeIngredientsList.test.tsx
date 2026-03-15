import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecipeIngredientsList } from "@/components/RecipeIngredientsList";

const mockUseQuery = vi.fn();

vi.mock("@/convex/_generated/api", () => ({
  api: {
    pantry: {
      getPantryItems: "getPantryItems",
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@/lib/session", () => ({
  getSessionId: () => "test-session-123",
}));

const baseIngredients = [
  { name: "olive oil", amount: "2 tbsp", inFridge: false },
  { name: "garlic", amount: "3 cloves", inFridge: true },
  { name: "salt", amount: "to taste", inFridge: false },
];

describe("RecipeIngredientsList", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("renders all ingredients", () => {
    mockUseQuery.mockReturnValue([]);
    render(<RecipeIngredientsList ingredients={baseIngredients} />);
    expect(screen.getByText("Ingredients")).toBeInTheDocument();
    expect(screen.getByText(/olive oil/)).toBeInTheDocument();
    expect(screen.getByText(/garlic/)).toBeInTheDocument();
    expect(screen.getByText(/salt/)).toBeInTheDocument();
  });

  it("shows green checkmark for user-input ingredients (inFridge=true)", () => {
    mockUseQuery.mockReturnValue([]);
    render(<RecipeIngredientsList ingredients={baseIngredients} />);
    const items = screen.getAllByRole("listitem");
    const garlicItem = items.find((el) => el.textContent?.includes("garlic"));
    expect(garlicItem?.textContent).toContain("\u2713");
  });

  it("shows grey circle for missing ingredients not in pantry", () => {
    mockUseQuery.mockReturnValue([]);
    render(<RecipeIngredientsList ingredients={baseIngredients} />);
    const items = screen.getAllByRole("listitem");
    const saltItem = items.find((el) => el.textContent?.includes("salt"));
    expect(saltItem?.textContent).toContain("\u25CB");
  });

  it("shows green dot for ingredients found in pantry", () => {
    mockUseQuery.mockReturnValue([
      { _id: "p1", normalizedName: "olive oil" },
    ]);
    render(<RecipeIngredientsList ingredients={baseIngredients} />);
    const items = screen.getAllByRole("listitem");
    const oilItem = items.find((el) => el.textContent?.includes("olive oil"));
    expect(oilItem?.textContent).toContain("\u2022");
  });

  it("renders amounts in bold", () => {
    mockUseQuery.mockReturnValue([]);
    render(<RecipeIngredientsList ingredients={baseIngredients} />);
    const strongElements = screen.getAllByText("2 tbsp");
    expect(strongElements[0].tagName).toBe("STRONG");
  });

  it("handles pantry data still loading (undefined)", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<RecipeIngredientsList ingredients={baseIngredients} />);
    expect(screen.getByText(/olive oil/)).toBeInTheDocument();
  });
});
