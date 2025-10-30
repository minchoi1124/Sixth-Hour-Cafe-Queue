
import { getMenu } from '@/lib/data';
import CustomerPageClient from '@/components/customer/CustomerPageClient';

// Revalidate every 30 seconds to ensure menu updates are reflected on the published site
export const revalidate = 30;

export default async function CustomerPage() {
  const menu = await getMenu();
  const availableMenu = menu.filter(item => item.inStock);

  return <CustomerPageClient menu={availableMenu} />;
}
