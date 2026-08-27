import StatsPageClient from '@/components/staff/StatsPageClient';

// Stats are read on the client by the authenticated owner or staff, the same
// way the queue is.
export const dynamic = 'force-dynamic';

export default function StatsPage() {
  return <StatsPageClient />;
}
