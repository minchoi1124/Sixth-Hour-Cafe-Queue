import { getMenu } from '@/lib/data';
import MenuManager from '@/components/staff/MenuManager';
import { AddDrinkForm } from '@/components/staff/AddDrinkForm';
import { Separator } from '@/components/ui/separator';
import CategoryManager from '@/components/staff/CategoryManager';

export const dynamic = 'force-dynamic';

export default async function MenuManagementPage() {
  const menu = await getMenu();
  const categories = await getCategories();

  return (
    <div className="container mx-auto p-4 sm:p-8 space-y-12">
      <div>
        <h1 className="text-5xl font-bold">Menu Management</h1>
        <p className="text-2xl text-muted-foreground">
          Update drink availability, names, and categories.
        </p>
      </div>
      <MenuManager menu={menu} categories={categories} />
      
      <Separator />

      <div>
        <h2 className="text-4xl font-bold mb-4">Manage Categories</h2>
        <CategoryManager initialCategories={categories} />
      </div>

      <Separator />

      <div>
          <h2 className="text-4xl font-bold mb-4">Add a New Drink</h2>
          <AddDrinkForm categories={categories} />
      </div>
    </div>
  );
}
