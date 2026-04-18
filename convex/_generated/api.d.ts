/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as chefs from "../chefs.js";
import type * as customChefs from "../customChefs.js";
import type * as favourites from "../favourites.js";
import type * as migrations from "../migrations.js";
import type * as pantry from "../pantry.js";
import type * as photos from "../photos.js";
import type * as recipes from "../recipes.js";
import type * as shoppingList from "../shoppingList.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  chefs: typeof chefs;
  customChefs: typeof customChefs;
  favourites: typeof favourites;
  migrations: typeof migrations;
  pantry: typeof pantry;
  photos: typeof photos;
  recipes: typeof recipes;
  shoppingList: typeof shoppingList;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
