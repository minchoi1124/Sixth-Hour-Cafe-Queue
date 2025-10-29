
import { getMenu } from '@/lib/data';
import CustomerPageClient from '@/components/customer/CustomerPageClient';

export default async function CustomerPage() {
  const menu = await getMenu();
  const availableMenu = menu.filter(item => item.inStock);

  return <CustomerPageClient menu={availableMenu} />;
}
