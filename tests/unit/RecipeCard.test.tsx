import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RecipeCard } from "@/components/RecipeCard";
import type { Recipe } from "@/types/recipe";

const mockRecipe: Recipe = {
  title: "Tomato Pasta",
  description: "A simple Italian classic.",
  cookingTime: 20,
  difficulty: "easy",
  servings: 2,
  cuisineType: "Italian",
  ingredients: [
    { name: "pasta", amount: "200g", inFridge: true },
    { name: "parmesan", amount: "30g", inFridge: false },
  ],
  steps: ["Boil pasta", "Make sauce", "Combine"],
  shoppingList: ["parmesan"],
};

describe("RecipeCard", () => {
  it("renders the recipe title", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    expect(screen.getByText("Tomato Pasta")).toBeInTheDocument();
  });

  it("renders cooking time", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    expect(screen.getByText("20 min")).toBeInTheDocument();
  });

  it("renders difficulty badge", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    expect(screen.getByText("easy")).toBeInTheDocument();
  });

  it("renders cuisine type", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    expect(screen.getByText("Italian")).toBeInTheDocument();
  });

  it("links to the correct recipe detail page", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/recipe/set-1/0");
  });
});
