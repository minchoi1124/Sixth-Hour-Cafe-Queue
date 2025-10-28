'use client';

import { saveMenu } from '@/lib/actions';
import type { MenuItem } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';
import { Input } from '../ui/input';

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
            description: "The menu has been successfully updated.",
        });
    }

  return (
    <form ref={formRef} action={formAction}>
      <Card>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="divide-y divide-border">
            {menu.map(item => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 py-6 px-4 sm:px-0">
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`item-${item.id}-name`} className="text-lg text-muted-foreground">Name</Label>
                    <Input
                        id={`item-${item.id}-name`}
                        name={`item-${item.id}-name`}
                        defaultValue={item.name}
                        className="text-2xl h-14"
                        required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`item-${item.id}-category`} className="text-lg text-muted-foreground">Category</Label>
                    <Input
                        id={`item-${item.id}-category`}
                        name={`item-${item.id}-category`}
                        defaultValue={item.category}
                        className="text-2xl h-14"
                        required
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-self-end gap-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-border">
                    <Label htmlFor={`item-${item.id}-instock`} className="text-2xl">
                        In Stock
                    </Label>
                    <Switch
                        id={`item-${item.id}-instock`}
                        name={`item-${item.id}-instock`}
                        defaultChecked={item.inStock}
                        className="data-[state=checked]:bg-green-500 scale-125"
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
