
import { notFound } from 'next/navigation';
import { getCafeBySlug, getMenuForCafe, getNextOpening } from '@/lib/data';
import CustomerPageClient from '@/components/customer/CustomerPageClient';
import { cafeTimezone } from '@/lib/timezone';

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

  // The library, not the menu: what customers can order comes from the active
  // session's liveMenu, resolved against this list on the client.
  const menu = await getMenuForCafe(cafe.id);

  // Only needed when closed, but the cafe can close between this render and the
  // client subscribing, so always resolve it.
  const nextOpening = await getNextOpening(cafe.id);

  const instagramUrl =
    cafe.instagramEnabled && cafe.instagramUrl ? cafe.instagramUrl : null;

  return (
    <CustomerPageClient
      cafeId={cafe.id}
      location={cafe.location}
      menu={menu}
      instagramUrl={instagramUrl}
      initialLiveMenu={cafe.liveMenu ?? null}
      nextOpening={nextOpening}
      timezone={cafeTimezone(cafe.timezone)}
    />
  );
}
