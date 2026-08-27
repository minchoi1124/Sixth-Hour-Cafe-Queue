'use client';

import type { Recipe } from '@/lib/definitions';
import { instructionLines } from '@/lib/recipes';

/**
 * Read-only how-to-make view: ingredients, then steps.
 *
 * Sized for reading at arm's length mid-service rather than for browsing, which
 * is why the steps are numbered and the type is large.
 */
export function RecipeCard({ recipe }: { recipe: Recipe | null | undefined }) {
  const ingredients = recipe?.ingredients ?? [];
  const steps = instructionLines(recipe?.instructions);

  if (ingredients.length === 0 && steps.length === 0) {
    return (
      <p className="text-lg text-muted-foreground">
        No recipe yet. Add one from the Drink Library.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-5">
      {ingredients.length > 0 && (
        <div className="sm:col-span-2">
          <h4 className="mb-2 text-lg font-semibold uppercase tracking-wide text-muted-foreground">
            Ingredients
          </h4>
          <ul className="space-y-1">
            {ingredients.map((line, i) => (
              <li key={i} className="text-xl leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {steps.length > 0 && (
        <div className="sm:col-span-3">
          <h4 className="mb-2 text-lg font-semibold uppercase tracking-wide text-muted-foreground">
            Steps
          </h4>
          {/* Rendered verbatim, line breaks preserved. The stored text already
              carries its own numbering and headings ("Iced:"), and re-numbering
              it here would fight that rather than help. */}
          <p className="whitespace-pre-line text-xl leading-snug">
            {steps.join('\n')}
          </p>
        </div>
      )}
    </div>
  );
}
