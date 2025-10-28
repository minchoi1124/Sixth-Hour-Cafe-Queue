import { getMenu } from '@/lib/data';
import MenuManager from '@/components/staff/MenuManager';
import { AddDrinkForm } from '@/components/staff/AddDrinkForm';
import { Separator } from '@/components/ui/separator';

export const dynamic = 'force-dynamic';

export default async function MenuManagementPage() {
  const menu = await getMenu();

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-5xl font-bold">Menu Management</h1>
        <p className="text-2xl text-muted-foreground">
          Update drink availability, names, and categories.
        </p>
      </div>
      <MenuManager menu={menu} />
      
      <Separator className="my-12" />

      <div className="mt-8">
          <h2 className="text-4xl font-bold mb-4">Add a New Drink</h2>
          <AddDrinkForm />
      </div>
    </div>
  );
}
