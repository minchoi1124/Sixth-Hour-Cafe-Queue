'use client';

import type { MenuItem } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { z } from 'zod';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

const OrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Please enter a name (at least 2 characters)'),
  itemId: z.string().min(1, 'Please select a drink'),
});

const drinkIcons: { [key: string]: React.ReactNode } = {
  'Maple Matcha Latte': <MapleMatchaLatteIcon className="w-10 h-10" />,
  'Dalgona Whipped Coffee': <DalgonaCoffeeIcon className="w-10 h-10" />,
  'London Fog': <LondonFogIcon className="w-10 h-10" />,
  'Apple Cider Chai': <AppleCiderChaiIcon className="w-10 h-10" />,
};

function DrinkOption({ item }: { item: MenuItem }) {
  return (
    <div>
      <RadioGroupItem
        value={item.id.toString()}
        id={`item-${item.id}`}
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
  )
}

export default function OrderForm({ menu }: { menu: MenuItem[] }) {
  const firestore = useFirestore();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [errors, setErrors] = useState<{ customerName?: string[], itemId?: string[] } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const categories = menu.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as { [key: string]: MenuItem[] });

  const resetForm = () => {
    setIsSuccess(false);
    setCustomerName('');
    setErrors(null);
    formRef.current?.reset();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setErrors(null);

    if (!firestore) {
      toast({ variant: "destructive", title: "Error", description: "Could not connect to database." });
      setIsPending(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const validatedFields = OrderSchema.safeParse({
      customerName: formData.get('customerName'),
      itemId: formData.get('itemId'),
    });

    if (!validatedFields.success) {
      setErrors(validatedFields.error.flatten().fieldErrors);
      setIsPending(false);
      return;
    }

    const selectedItem = menu.find(item => validatedFields.data.itemId === item.id);
    if (!selectedItem) {
      setErrors({ itemId: ['Invalid drink selected.'] });
      setIsPending(false);
      return;
    }

    try {
      const ordersCol = collection(firestore, 'orders');
      await addDoc(ordersCol, {
        customerName: validatedFields.data.customerName,
        items: [{ id: selectedItem.id, name: selectedItem.name }],
        createdAt: serverTimestamp(),
        status: 'pending',
      });
      
      setCustomerName(validatedFields.data.customerName);
      setIsSuccess(true);

    } catch (e: any) {
      console.error("Failed to submit order:", e);
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: "Could not place your order. Please try again."
      });
    } finally {
      setIsPending(false);
    }
  };
  
  if (isSuccess) {
    return (
      <div className="text-center space-y-8">
        <Alert className="border-primary/50 text-center">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle className="text-3xl font-bold">Order Submitted!</AlertTitle>
          <AlertDescription className="text-xl">
            Thanks, {customerName}! Your order is in.
          </AlertDescription>
        </Alert>
        <Button onClick={resetForm} className="text-2xl py-6">
            New Order
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-12">
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
          {errors?.customerName && (
            <p id="name-error" className="text-destructive mt-2 text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {errors.customerName}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-4xl">2. Choose your drink</CardTitle>
          <CardDescription className="text-xl">Select one of our drinks from our menu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <RadioGroup name="itemId" className="space-y-8" aria-describedby='items-error'>
            {Object.entries(categories).map(([category, items]) => (
                <div key={category}>
                    <h3 className="text-3xl font-semibold mb-4 text-primary">{category}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {items.map((item) => <DrinkOption key={item.id} item={item} />)}
                    </div>
                </div>
            ))}
          </RadioGroup>
          {errors?.itemId && (
            <p id="items-error" className="text-destructive mt-4 text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {errors.itemId}
            </p>
          )}
        </CardContent>
      </Card>
      
      <Button type="submit" disabled={isPending} className="w-full text-3xl py-8">
        {isPending ? 'Placing Order...' : 'Place My Order'}
      </Button>
    </form>
  );
}
