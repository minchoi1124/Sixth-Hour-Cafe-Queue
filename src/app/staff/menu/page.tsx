import { getMenu } from '@/lib/data';
import MenuManager from '@/components/staff/MenuManager';

export default async function MenuManagementPage() {
  const menu = await getMenu();

  return (
    <div className="container mx-auto p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-5xl font-bold">Menu Management</h1>
        <p className="text-2xl text-muted-foreground">
          Update drink availability. Changes will be live on the customer page immediately.
        </p>
      </div>
      <MenuManager menu={menu} />
    </div>
  );
}
