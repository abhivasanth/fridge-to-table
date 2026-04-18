import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

function withUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId });
}

describe("pantry", () => {
  test("addToPantry stores an item for the authenticated user", async () => {
    const t = convexTest(schema);

    const result = await withUser(t, "user_alice").mutation(
      api.pantry.addToPantry,
      { name: "Olive Oil" }
    );

    expect(result.alreadyExists).toBe(false);

    const items = await withUser(t, "user_alice").query(
      api.pantry.getPantryItems,
      {}
    );
    expect(items).toHaveLength(1);
    expect(items[0].normalizedName).toBe("olive oil");
  });

  test("addToPantry is idempotent on duplicate normalized name", async () => {
    const t = convexTest(schema);

    await withUser(t, "user_alice").mutation(api.pantry.addToPantry, {
      name: "Tomatoes",
    });
    const second = await withUser(t, "user_alice").mutation(
      api.pantry.addToPantry,
      { name: "tomato" }
    );

    expect(second.alreadyExists).toBe(true);

    const items = await withUser(t, "user_alice").query(
      api.pantry.getPantryItems,
      {}
    );
    expect(items).toHaveLength(1);
  });

  test("getPantryItems only returns items for the authenticated user", async () => {
    const t = convexTest(schema);

    await withUser(t, "user_alice").mutation(api.pantry.addToPantry, {
      name: "salt",
    });

    const bobItems = await withUser(t, "user_bob").query(
      api.pantry.getPantryItems,
      {}
    );
    expect(bobItems).toHaveLength(0);
  });

  test("removeFromPantry deletes the item when the caller owns it", async () => {
    const t = convexTest(schema);
    const { id } = (await withUser(t, "user_alice").mutation(
      api.pantry.addToPantry,
      { name: "pepper" }
    )) as { alreadyExists: false; id: Awaited<ReturnType<typeof t.run>> };

    await withUser(t, "user_alice").mutation(api.pantry.removeFromPantry, {
      id: id as never,
    });

    const items = await withUser(t, "user_alice").query(
      api.pantry.getPantryItems,
      {}
    );
    expect(items).toHaveLength(0);
  });

  test("removeFromPantry throws Forbidden when caller doesn't own the item", async () => {
    const t = convexTest(schema);
    const aliceAdd = (await withUser(t, "user_alice").mutation(
      api.pantry.addToPantry,
      { name: "rice" }
    )) as { alreadyExists: false; id: Awaited<ReturnType<typeof t.run>> };

    await expect(
      withUser(t, "user_bob").mutation(api.pantry.removeFromPantry, {
        id: aliceAdd.id as never,
      })
    ).rejects.toThrow(/Forbidden/);

    // Alice's item still present
    const aliceItems = await withUser(t, "user_alice").query(
      api.pantry.getPantryItems,
      {}
    );
    expect(aliceItems).toHaveLength(1);
  });

  test("removeFromPantry is a silent no-op for unknown IDs (does not throw, does not leak existence)", async () => {
    const t = convexTest(schema);
    // Create and delete an item to get a valid-looking Id<"pantryItems">
    const add = (await withUser(t, "user_alice").mutation(
      api.pantry.addToPantry,
      { name: "basil" }
    )) as { alreadyExists: false; id: Awaited<ReturnType<typeof t.run>> };
    await withUser(t, "user_alice").mutation(api.pantry.removeFromPantry, {
      id: add.id as never,
    });

    // Second delete with the now-stale ID should not throw
    await withUser(t, "user_alice").mutation(api.pantry.removeFromPantry, {
      id: add.id as never,
    });
  });

  test("unauthenticated callers can't query getPantryItems", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.pantry.getPantryItems, {})).rejects.toThrow(
      /Not authenticated/
    );
  });

  test("unauthenticated callers can't call addToPantry", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.pantry.addToPantry, { name: "salt" })
    ).rejects.toThrow(/Not authenticated/);
  });
});
