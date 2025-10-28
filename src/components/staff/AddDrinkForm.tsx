
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { addNewDrink, type AddDrinkFormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';


const initialState: AddDrinkFormState = { message: '', errors: {}, success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto text-xl py-6 px-8">
      {pending ? 'Adding...' : 'Add Drink'}
    </Button>
  );
}

export function AddDrinkForm() {
  const [state, dispatch] = useActionState(addNewDrink, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      toast({
        title: "Drink Added!",
        description: state.message,
      })
    }
  }, [state]);


  return (
    <form action={dispatch} ref={formRef}>
        <Card>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-xl">Drink Name</Label>
                        <Input id="name" name="name" placeholder="e.g. Iced Caramel Macchiato" required className="text-2xl h-14"/>
                        {state.errors?.name && (
                            <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                                <AlertCircle className="h-5 w-5" /> {state.errors.name}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category" className="text-xl">Category</Label>
                        <Input id="category" name="category" placeholder="e.g. Coffee" required className="text-2xl h-14" />
                        {state.errors?.category && (
                            <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                                <AlertCircle className="h-5 w-5" /> {state.errors.category}
                            </p>
                        )}
                    </div>
                    <div className="sm:mt-8 sm:justify-self-end">
                        <SubmitButton />
                    </div>
                </div>
                {state.message && !state.success && (
                    <p className="text-destructive text-center text-lg mt-4">{state.message}</p>
                )}
            </CardContent>
        </Card>
    </form>
  );
}
