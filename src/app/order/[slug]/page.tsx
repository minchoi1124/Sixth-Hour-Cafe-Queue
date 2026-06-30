
import { notFound } from 'next/navigation';
import { getCafeBySlug, getMenuForCafe } from '@/lib/data';
import CustomerPageClient from '@/components/customer/CustomerPageClient';

// Force dynamic rendering to ensure menu data is always fresh from Firestore
export const dynamic = 'force-dynamic';

export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cafe = await getCafeBySlug(slug);

  if (!cafe) {
    notFound();
  }

  const menu = await getMenuForCafe(cafe.id);

  return <CustomerPageClient cafeId={cafe.id} location={cafe.location} menu={menu} />;
}
