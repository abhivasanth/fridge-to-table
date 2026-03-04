import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExpandableRecipeCard } from "@/components/v3/ExpandableRecipeCard";
import type { Recipe } from "@/types/recipe";

const mockRecipe: Recipe = {
  title: "Egg Fried Rice",
  description: "A quick and tasty dish.",
  cuisineType: "Chinese",
  difficulty: "easy",
  cookingTime: 20,
  servings: 2,
  ingredients: [
    { name: "eggs", amount: "2", inFridge: true },
    { name: "rice", amount: "1 cup", inFridge: false },
  ],
  steps: ["Beat the eggs.", "Fry the rice."],
  shoppingList: [],
};

describe("ExpandableRecipeCard", () => {
  it("renders recipe title and collapsed by default", () => {
    render(<ExpandableRecipeCard recipe={mockRecipe} />);
    expect(screen.getByText("Egg Fried Rice")).toBeInTheDocument();
    expect(screen.queryByText("Ingredients")).not.toBeInTheDocument();
  });

  it("expands to show ingredients on first tap", () => {
    render(<ExpandableRecipeCard recipe={mockRecipe} />);
    fireEvent.click(screen.getByRole("button", { name: /egg fried rice/i }));
    expect(screen.getByText("Ingredients")).toBeInTheDocument();
    expect(screen.getByText(/2 eggs/)).toBeInTheDocument();
  });

  it("shows full recipe steps after tapping View Full Recipe", () => {
    render(<ExpandableRecipeCard recipe={mockRecipe} />);
    fireEvent.click(screen.getByRole("button", { name: /egg fried rice/i }));
    fireEvent.click(screen.getByText("View Full Recipe →"));
    expect(screen.getByText("Instructions")).toBeInTheDocument();
    expect(screen.getByText("Beat the eggs.")).toBeInTheDocument();
  });

  it("collapses when Collapse is tapped", () => {
    render(<ExpandableRecipeCard recipe={mockRecipe} />);
    fireEvent.click(screen.getByRole("button", { name: /egg fried rice/i }));
    fireEvent.click(screen.getByText("View Full Recipe →"));
    fireEvent.click(screen.getByText("Collapse"));
    expect(screen.queryByText("Instructions")).not.toBeInTheDocument();
  });
});
