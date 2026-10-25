
'use client';

import type { MenuItem } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { z } from 'zod';
import { getAppCheckToken } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import { DalgonaCoffeeIcon, AppleCiderChaiIcon, LondonFogIcon, MapleMatchaLatteIcon } from '../icons/CafeIcons';
import { Checkbox } from '../ui/checkbox';
import { QRCodeSVG } from 'qrcode.react';

const OrderSchema = z.object({
  // Matches the limits in /api/orders.
  customerName: z.string().trim().min(1, 'Please enter a name').max(60, 'Please keep your name under 60 characters'),
  itemId: z.string().min(1, 'Please select a drink'),
  modifications: z.array(z.string()),
});

// The thank-you screen clears itself for the next person in line; it stays up
// longer when there's an Instagram code to scan.
const SUCCESS_SECONDS = 8;
const SUCCESS_SECONDS_WITH_INSTAGRAM = 15;
// A half-filled order left on the kiosk is cleared after this long untouched.
const IDLE_RESET_MS = 60_000;

const drinkIcons: { [key: string]: React.FC<{ className?: string }> } = {
    "Maple Matcha Latte": MapleMatchaLatteIcon,
    "Dalgona Coffee": DalgonaCoffeeIcon,
    "London Fog": LondonFogIcon,
    "Apple Cider Chai": AppleCiderChaiIcon,
};

function DrinkOption({ item, soldOut }: { item: MenuItem; soldOut: boolean }) {
  const Icon = drinkIcons[item.name];
  return (
    <div>
      <RadioGroupItem
        value={item.id.toString()}
        id={`item-${item.id}`}
        className="sr-only peer"
        aria-labelledby={`label-item-${item.id}`}
        disabled={soldOut}
      />
      <Label
        htmlFor={`item-${item.id}`}
        id={`label-item-${item.id}`}
        className={cn(
          'flex flex-col items-center justify-between p-6 text-center rounded-lg border-2 border-primary/20',
          'transition-all duration-200 ease-in-out',
          // Sold out stays visible rather than vanishing mid-service: a customer
          // reading the board should see it's known-out, not wonder where it went.
          soldOut
            ? 'cursor-not-allowed bg-muted/40 opacity-60'
            : [
                'cursor-pointer bg-background hover:bg-accent',
                'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground',
              ]
        )}
      >
        <div className="flex items-start gap-4 w-full">
            {Icon && <div className="h-14 w-14 flex-shrink-0 mt-1"><Icon /></div>}
            <div className="text-left flex-1">
                <span className="block text-2xl font-medium">
                  {item.name}
                  {soldOut && (
                    <span className="ml-3 align-middle text-lg font-normal text-muted-foreground">
                      Out of stock
                    </span>
                  )}
                </span>
                <p className="text-lg opacity-80 mt-1">{item.description}</p>
            </div>
        </div>
      </Label>
    </div>
  )
}

export default function OrderForm({
  cafeId,
  menu,
  soldOutIds,
  instagramUrl,
}: {
  cafeId: string;
  menu: MenuItem[];
  soldOutIds: string[];
  instagramUrl: string | null;
}) {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ customerName?: string[], itemId?: string[] } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hasTyped, setHasTyped] = useState(false);
  // Bumped to remount the form, which clears the name and the drink choice.
  const [formKey, setFormKey] = useState(0);
  const soldOut = useMemo(() => new Set(soldOutIds), [soldOutIds]);

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
    setSelectedItemId(null);
    setErrors(null);
    setHasTyped(false);
    setFormKey((key) => key + 1);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (!isSuccess) return;
    const tick = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(tick);
  }, [isSuccess]);

  useEffect(() => {
    if (isSuccess && secondsLeft <= 0) resetForm();
  }, [isSuccess, secondsLeft]);

  // Any touch, keypress or scroll restarts the idle countdown.
  const hasProgress = hasTyped || selectedItemId !== null;
  useEffect(() => {
    if (!hasProgress || isSuccess || isPending) return;
    let timer = setTimeout(resetForm, IDLE_RESET_MS);
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(resetForm, IDLE_RESET_MS);
    };
    const events = ['pointerdown', 'keydown', 'input', 'scroll'] as const;
    events.forEach((name) => window.addEventListener(name, restart, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, restart));
    };
  }, [hasProgress, isSuccess, isPending]);

  const selectedItem = menu.find(item => item.id === selectedItemId);
  const availableModifications = selectedItem?.modifications ?? [];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setErrors(null);

    const formData = new FormData(event.currentTarget);
    const selectedModifications = availableModifications
        .filter(mod => formData.get(`mod-${mod.id}`) === 'on')
        .map(mod => mod.name);
    
    const validatedFields = OrderSchema.safeParse({
      customerName: formData.get('customerName'),
      itemId: formData.get('itemId'),
      modifications: selectedModifications,
    });

    if (!validatedFields.success) {
      setErrors(validatedFields.error.flatten().fieldErrors);
      setIsPending(false);
      return;
    }

    const foundSelectedItem = menu.find(item => validatedFields.data.itemId === item.id);
    if (!foundSelectedItem) {
      setErrors({ itemId: ['Invalid drink selected.'] });
      setIsPending(false);
      return;
    }

    // Staff can mark a drink sold out while it's already selected here.
    if (soldOut.has(foundSelectedItem.id)) {
      setErrors({ itemId: [`Sorry, ${foundSelectedItem.name} just went out of stock. Please pick another.`] });
      setSelectedItemId(null);
      setIsPending(false);
      return;
    }

    try {
      const appCheckToken = await getAppCheckToken();
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
        },
        body: JSON.stringify({
          cafeId,
          customerName: validatedFields.data.customerName,
          items: [{
            id: foundSelectedItem.id,
            name: foundSelectedItem.name,
            modifications: validatedFields.data.modifications,
          }],
        }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        console.error('Order request failed', response.status, detail);
        throw new Error(`Order request failed with status ${response.status}: ${detail?.error ?? ''}`);
      }

      setCustomerName(validatedFields.data.customerName);
      setSecondsLeft(instagramUrl ? SUCCESS_SECONDS_WITH_INSTAGRAM : SUCCESS_SECONDS);
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

        {/* The next person in line walks up to this screen, so starting a new
            order is the biggest thing on it. */}
        <div className="space-y-3">
          <Button onClick={resetForm} className="h-auto w-full gap-3 py-10 text-3xl shadow-lg">
            <Plus className="h-9 w-9" />
            Next in line? Tap to order
          </Button>
          <p className="text-lg text-muted-foreground" aria-live="polite">
            Starting a new order in {Math.max(secondsLeft, 0)}…
          </p>
        </div>

        {/* Kept small so it isn't mistaken for a way to order. */}
        {instagramUrl && (
          <div className="mx-auto flex max-w-md items-center gap-4 rounded-lg border border-dashed p-4 text-left">
            <div className="flex-shrink-0 rounded bg-white p-2">
              <QRCodeSVG value={instagramUrl} size={120} />
            </div>
            <p className="text-lg text-muted-foreground">
              Follow us on Instagram for updates!
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} onInput={() => setHasTyped(true)} className="space-y-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-4xl">1. What&apos;s your name?</CardTitle>
          <CardDescription className="text-xl">So we know who to call when it&apos;s ready.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="customerName" className="sr-only">Your Name</Label>
          <Input
            id="customerName"
            name="customerName"
            className="text-3xl h-16 border-2 border-primary/20 focus-visible:border-primary"
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
          <RadioGroup 
            name="itemId" 
            className="space-y-8" 
            aria-describedby='items-error'
            onValueChange={setSelectedItemId}
          >
            {Object.entries(categories).map(([category, items]) => (
                <div key={category}>
                    <h3 className="text-4xl font-category mb-4 text-primary">{category}</h3>
                    <div className="grid grid-cols-1 gap-4">
                        {items.map((item) => (
                <DrinkOption key={item.id} item={item} soldOut={soldOut.has(item.id)} />
              ))}
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

      {selectedItemId && availableModifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-4xl">3. Any modifications?</CardTitle>
            <CardDescription className="text-xl">Optional add-ons for your drink.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableModifications.map(mod => (
              <div key={mod.id} className="items-top flex space-x-4 p-6 rounded-lg border-2 border-primary/20 bg-background hover:bg-accent transition-all cursor-pointer">
                  <Checkbox 
                    id={`mod-${mod.id}`} 
                    name={`mod-${mod.id}`}
                    defaultChecked={mod.default}
                    className="w-7 h-7 mt-1 border-2" 
                  />
                  <div className="grid gap-1.5 leading-none">
                      <label
                          htmlFor={`mod-${mod.id}`}
                          className="text-2xl font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                          {mod.name}
                      </label>
                  </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      <Button type="submit" disabled={isPending || !selectedItemId} className="w-full text-3xl py-8">
        {isPending ? 'Placing Order...' : 'Place My Order'}
      </Button>
    </form>
  );
}
