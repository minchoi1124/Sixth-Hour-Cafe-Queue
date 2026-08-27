'use client';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import type { Recipe } from '@/lib/definitions';
import {
  deleteRecipe,
  formatIngredients,
  hasContent,
  parseIngredients,
  saveRecipe,
} from '@/lib/recipes';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Trash2 } from 'lucide-react';

/**
 * Edit a drink's recipe.
 *
 * Explicitly saved rather than autosaved, unlike the drink fields beside it: a
 * recipe is a block of prose someone types in one sitting, and debouncing it
 * would write a dozen half-finished versions of the steps.
 */
export function RecipeEditor({
  cafeId,
  drinkId,
  drinkName,
  recipe,
}: {
  cafeId: string;
  drinkId: string;
  drinkName: string;
  recipe: Recipe | null | undefined;
}) {
  const firestore = useFirestore();
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset when the row is opened for a different drink, or when the stored
  // recipe changes underneath (another device saved it).
  useEffect(() => {
    setIngredients(formatIngredients(recipe?.ingredients));
    setInstructions(recipe?.instructions ?? '');
  }, [drinkId, recipe?.ingredients, recipe?.instructions]);

  const parsed = parseIngredients(ingredients);
  const isDirty =
    parsed.join('\n') !== formatIngredients(recipe?.ingredients) ||
    instructions.trim() !== (recipe?.instructions ?? '').trim();
  const isEmpty = parsed.length === 0 && instructions.trim().length === 0;

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      // Clearing both fields deletes the recipe rather than storing an empty
      // one, so "no recipe" has a single representation.
      if (isEmpty) {
        await deleteRecipe(firestore, cafeId, drinkId);
        toast({ title: 'Recipe removed', description: `"${drinkName}" no longer has a recipe.` });
      } else {
        await saveRecipe(firestore, cafeId, drinkId, parsed, instructions);
        toast({ title: 'Recipe saved', description: `How to make "${drinkName}" is up to date.` });
      }
    } catch (e) {
      console.error('Failed to save recipe:', e);
      toast({
        variant: 'destructive',
        title: 'Could not save recipe',
        description: 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-xl font-semibold">How to make it</h4>
        <Button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          variant={isEmpty && hasContent(recipe) ? 'destructive' : 'default'}
          className="text-base"
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isEmpty && hasContent(recipe) ? (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Remove recipe
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save recipe
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <Label htmlFor={`recipe-${drinkId}-ingredients`} className="text-lg text-muted-foreground">
            Ingredients — one per line
          </Label>
          <Textarea
            id={`recipe-${drinkId}-ingredients`}
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            className="min-h-[160px] text-xl"
            placeholder={'matcha powder (1/2 tbsp)\nmaple syrup (1 tbsp)\nmilk (2/3 of cup)'}
          />
        </div>
        <div className="md:col-span-3">
          <Label htmlFor={`recipe-${drinkId}-instructions`} className="text-lg text-muted-foreground">
            Steps
          </Label>
          <Textarea
            id={`recipe-${drinkId}-instructions`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-[160px] text-xl"
            placeholder={'Iced:\n1. sift matcha powder into cup\n2. add water\n3. whisk until foamy'}
          />
        </div>
      </div>

      {isDirty && (
        <p className="text-base text-muted-foreground">
          Unsaved changes — the rest of this drink autosaves, the recipe does not.
        </p>
      )}
    </div>
  );
}
