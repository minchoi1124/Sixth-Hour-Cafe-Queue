import StaffPageClient from '@/components/staff/StaffPageClient';

// Owner data is read on the client by the authenticated owner via real-time
// listeners, so there's no server-side prefetch here.
export const dynamic = 'force-dynamic';

export default function StaffPage() {
  return <StaffPageClient />;
}
