/**
 * How-to-make recipes: ingredients and steps for each drink.
 *
 * Staff-only. A recipe document is keyed by the drink's id, so `recipes` mirrors
 * `drinks` one-to-one and a lookup is a map hit rather than a query. Recipes are
 * separate documents rather than fields on the drink because they're read by
 * different people at different times — customers read the drink, staff read the
 * recipe — and keeping them apart is what lets the security rules deny the
 * recipe to the public while the drink stays world-readable.
 */
import {
  type Firestore,
  deleteDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { recipeDoc } from '@/lib/cafe-paths';
import type { Recipe } from '@/lib/definitions';

/** Index recipes by drink id for rendering against a library. */
export function recipesByDrink(recipes: Recipe[] | null | undefined): Map<string, Recipe> {
  return new Map((recipes ?? []).map((r) => [r.id, r]));
}

/** True when a recipe has anything worth showing. */
export function hasContent(recipe: Recipe | null | undefined): boolean {
  if (!recipe) return false;
  return recipe.ingredients.length > 0 || recipe.instructions.trim().length > 0;
}

/**
 * Split a textarea's contents into ingredient lines.
 *
 * Blank lines are dropped so trailing newlines and double-spacing while typing
 * don't become empty bullets.
 */
export function parseIngredients(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Ingredient lines back into textarea text. */
export function formatIngredients(ingredients: string[] | undefined): string {
  return (ingredients ?? []).join('\n');
}

/** Instruction text split into steps for display, blank lines dropped. */
export function instructionLines(instructions: string | undefined): string[] {
  return (instructions ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Create or replace the recipe for a drink.
 *
 * `setDoc` with the drink id, not `addDoc`: writing twice for the same drink
 * must overwrite rather than create a second recipe.
 */
export async function saveRecipe(
  db: Firestore,
  cafeId: string,
  drinkId: string,
  ingredients: string[],
  instructions: string,
): Promise<void> {
  await setDoc(recipeDoc(db, cafeId, drinkId), {
    ingredients,
    instructions: instructions.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecipe(
  db: Firestore,
  cafeId: string,
  drinkId: string,
): Promise<void> {
  await deleteDoc(recipeDoc(db, cafeId, drinkId));
}
