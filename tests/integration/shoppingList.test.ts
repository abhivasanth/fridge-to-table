import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

function withUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId });
}

describe("shoppingList", () => {
  test("addToShoppingList stores an item for the authenticated user", async () => {
    const t = convexTest(schema);

    const result = await withUser(t, "user_alice").mutation(
      api.shoppingList.addToShoppingList,
      { name: "Lemons" }
    );

    expect(result.alreadyExists).toBe(false);

    const items = await withUser(t, "user_alice").query(
      api.shoppingList.getShoppingListItems,
      {}
    );
    expect(items).toHaveLength(1);
    expect(items[0].normalizedName).toBe("lemon");
    expect(items[0].source).toBe("manual");
  });

  test("addToShoppingList is idempotent on duplicate normalized name", async () => {
    const t = convexTest(schema);

    await withUser(t, "user_alice").mutation(
      api.shoppingList.addToShoppingList,
      { name: "tomato" }
    );
    const second = await withUser(t, "user_alice").mutation(
      api.shoppingList.addToShoppingList,
      { name: "Tomatoes" }
    );

    expect(second.alreadyExists).toBe(true);

    const items = await withUser(t, "user_alice").query(
      api.shoppingList.getShoppingListItems,
      {}
    );
    expect(items).toHaveLength(1);
  });

  test("getShoppingListItems only returns items for the authenticated user", async () => {
    const t = convexTest(schema);

    await withUser(t, "user_alice").mutation(
      api.shoppingList.addToShoppingList,
      { name: "flour" }
    );

    const bobItems = await withUser(t, "user_bob").query(
      api.shoppingList.getShoppingListItems,
      {}
    );
    expect(bobItems).toHaveLength(0);
  });

  test("removeFromShoppingList deletes the item when the caller owns it", async () => {
    const t = convexTest(schema);
    const { id } = (await withUser(t, "user_alice").mutation(
      api.shoppingList.addToShoppingList,
      { name: "milk" }
    )) as { alreadyExists: false; id: Awaited<ReturnType<typeof t.run>> };

    await withUser(t, "user_alice").mutation(
      api.shoppingList.removeFromShoppingList,
      { id: id as never }
    );

    const items = await withUser(t, "user_alice").query(
      api.shoppingList.getShoppingListItems,
      {}
    );
    expect(items).toHaveLength(0);
  });

  test("removeFromShoppingList throws Forbidden when caller doesn't own the item", async () => {
    const t = convexTest(schema);
    const aliceAdd = (await withUser(t, "user_alice").mutation(
      api.shoppingList.addToShoppingList,
      { name: "butter" }
    )) as { alreadyExists: false; id: Awaited<ReturnType<typeof t.run>> };

    await expect(
      withUser(t, "user_bob").mutation(
        api.shoppingList.removeFromShoppingList,
        { id: aliceAdd.id as never }
      )
    ).rejects.toThrow(/Forbidden/);

    // Alice's item still present
    const aliceItems = await withUser(t, "user_alice").query(
      api.shoppingList.getShoppingListItems,
      {}
    );
    expect(aliceItems).toHaveLength(1);
  });

  test("removeFromShoppingList is a silent no-op for unknown IDs (does not throw, does not leak existence)", async () => {
    const t = convexTest(schema);
    const add = (await withUser(t, "user_alice").mutation(
      api.shoppingList.addToShoppingList,
      { name: "sugar" }
    )) as { alreadyExists: false; id: Awaited<ReturnType<typeof t.run>> };
    await withUser(t, "user_alice").mutation(
      api.shoppingList.removeFromShoppingList,
      { id: add.id as never }
    );

    // Second delete with the now-stale ID should not throw
    await withUser(t, "user_alice").mutation(
      api.shoppingList.removeFromShoppingList,
      { id: add.id as never }
    );
  });

  test("unauthenticated callers can't query getShoppingListItems", async () => {
    const t = convexTest(schema);
    await expect(
      t.query(api.shoppingList.getShoppingListItems, {})
    ).rejects.toThrow(/Not authenticated/);
  });

  test("unauthenticated callers can't call addToShoppingList", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.shoppingList.addToShoppingList, { name: "salt" })
    ).rejects.toThrow(/Not authenticated/);
  });
});
