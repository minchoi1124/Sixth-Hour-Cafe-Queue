
import { getMenu } from '@/lib/data';
import CustomerPageClient from '@/components/customer/CustomerPageClient';

// Force dynamic rendering to ensure menu data is always fresh from Firestore
export const dynamic = 'force-dynamic';

export default async function CustomerPage() {
  const menu = await getMenu();
  const availableMenu = menu.filter(item => item.inStock);

  return <CustomerPageClient menu={availableMenu} />;
}
