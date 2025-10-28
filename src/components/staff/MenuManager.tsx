'use client';

import { saveMenu } from '@/lib/actions';
import type { MenuItem } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useFormStatus } from 'react-dom';
import { toast } from '@/hooks/use-toast';
import { useRef } from 'react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full text-2xl py-7 sm:w-auto sm:px-10">
      {pending ? 'Saving...' : 'Save Changes'}
    </Button>
  );
}

export default function MenuManager({ menu }: { menu: MenuItem[] }) {
    const formRef = useRef<HTMLFormElement>(null);
    const formAction = async (formData: FormData) => {
        await saveMenu(formData);
        toast({
            title: "Menu Updated",
            description: "The customer ordering page has been updated.",
        });
    }

  return (
    <form ref={formRef} action={formAction}>
      <Card>
        <CardContent className="p-6">
          <div className="divide-y divide-border">
            {menu.map(item => (
              <div key={item.id} className="flex items-center justify-between py-6">
                <span className="text-3xl font-medium">{item.name}</span>
                <div className="flex items-center gap-4">
                    <Label htmlFor={`item-${item.id}-instock`} className="text-2xl text-muted-foreground">
                        In Stock
                    </Label>
                    <Switch
                        id={`item-${item.id}-instock`}
                        name={`item-${item.id}-instock`}
                        defaultChecked={item.inStock}
                        className="data-[state=checked]:bg-green-500"
                    />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
