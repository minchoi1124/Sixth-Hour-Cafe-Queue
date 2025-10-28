'use client';

import type { MenuItem } from '@/lib/definitions';
import { useFormState, useFormStatus } from 'react-dom';
import { submitOrder } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import {
  AppleCiderChaiIcon,
  DalgonaCoffeeIcon,
  LondonFogIcon,
  MapleMatchaLatteIcon,
} from '@/components/icons/CafeIcons';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const initialState = { message: '', errors: {}, success: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full text-3xl py-8">
      {pending ? 'Placing Order...' : 'Place My Order'}
    </Button>
  );
}

const drinkIcons: { [key: string]: React.ReactNode } = {
  'Maple Matcha Latte': <MapleMatchaLatteIcon className="w-10 h-10" />,
  'Dalgona Whipped Coffee': <DalgonaCoffeeIcon className="w-10 h-10" />,
  'London Fog': <LondonFogIcon className="w-10 h-10" />,
  'Apple Cider Chai': <AppleCiderChaiIcon className="w-10 h-10" />,
};

export default function OrderForm({ menu }: { menu: MenuItem[] }) {
  const [state, dispatch] = useFormState(submitOrder, initialState);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      const timer = setTimeout(() => {
        setFormKey(k => k + 1); // This resets the form state by changing the key
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.success]);
  
  if (state.success && formKey > 0) {
    return (
      <Alert className="border-primary/50 text-center">
        <CheckCircle className="h-4 w-4" />
        <AlertTitle className="text-3xl font-bold">Order Submitted!</AlertTitle>
        <AlertDescription className="text-xl">
          {state.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form ref={formRef} action={dispatch} key={formKey} className="space-y-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-4xl">1. What's your name?</CardTitle>
          <CardDescription className="text-xl">So we know who to call when it's ready.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="customerName" className="sr-only">Your Name</Label>
          <Input
            id="customerName"
            name="customerName"
            placeholder="e.g. Alex"
            className="text-3xl h-16"
            required
            aria-describedby="name-error"
          />
          {state.errors?.customerName && (
            <p id="name-error" className="text-destructive mt-2 text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {state.errors.customerName}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-4xl">2. Choose your drinks</CardTitle>
          <CardDescription className="text-xl">Select one or more from our menu.</CardDescription>
        </CardHeader>
        <CardContent>
          <div id="drink-options" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {menu.map((item) => (
              <div key={item.id}>
                <Checkbox
                  id={`item-${item.id}`}
                  name="itemIds"
                  value={item.id}
                  className="sr-only peer"
                  aria-labelledby={`label-item-${item.id}`}
                />
                <Label
                  htmlFor={`item-${item.id}`}
                  id={`label-item-${item.id}`}
                  className={cn(
                    'flex flex-col items-center justify-center p-6 text-center rounded-lg border-2 border-primary/20 cursor-pointer',
                    'transition-all duration-200 ease-in-out',
                    'bg-background hover:bg-accent',
                    'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground'
                  )}
                >
                  <div className="w-16 h-16 flex items-center justify-center mb-4">
                    {drinkIcons[item.name] || <DalgonaCoffeeIcon className="w-10 h-10" />}
                  </div>
                  <span className="text-2xl font-medium">{item.name}</span>
                </Label>
              </div>
            ))}
          </div>
          {state.errors?.itemIds && (
            <p id="items-error" className="text-destructive mt-4 text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {state.errors.itemIds}
            </p>
          )}
        </CardContent>
      </Card>
      
      <SubmitButton />

      {state.message && !state.success && (
        <p className="text-destructive text-center text-lg">{state.message}</p>
      )}
    </form>
  );
}
