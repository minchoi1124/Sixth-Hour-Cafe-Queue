'use client';

import type { Throughput } from '@/lib/stats';
import { MIN_RELIABLE_DRINKS, MIN_RELIABLE_MINUTES } from '@/lib/stats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function duration(minutes: number | null): string {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * How fast each service ran, measured first order to last.
 *
 * Timed from the orders rather than the session's own start and end: most
 * sessions predate the sessions feature and had those times reconstructed by
 * the backfill, so only the order timestamps record what actually happened.
 */
export function ThroughputTable({
  rates,
  isLoading,
}: {
  rates: Throughput[];
  isLoading: boolean;
}) {
  const provisional = rates.filter((r) => !r.reliable).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Pace</CardTitle>
        <CardDescription className="text-lg">
          Drinks an hour, from the first order to the last. Timed from the orders themselves, not
          the session&apos;s start and end.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rates.length === 0 ? (
          <p className="py-6 text-center text-lg text-muted-foreground">Nothing to measure yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b text-lg text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Session</th>
                    <th className="py-2 pr-4 font-medium">Drinks</th>
                    <th className="py-2 pr-4 font-medium">Ran for</th>
                    <th className="py-2 font-medium">Per hour</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.sessionId} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <span className="text-xl">{rate.label}</span>
                        <span className="ml-2 text-base text-muted-foreground">
                          {rate.location}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xl tabular-nums">{rate.drinks}</td>
                      <td className="py-3 pr-4 text-xl tabular-nums">
                        {duration(rate.spanMinutes)}
                      </td>
                      <td className="py-3">
                        <span
                          className={cn(
                            'text-xl font-medium tabular-nums',
                            !rate.reliable && 'text-muted-foreground',
                          )}
                        >
                          {rate.perHour ? rate.perHour.toFixed(0) : '—'}
                        </span>
                        {!rate.reliable && rate.perHour && (
                          <span className="ml-2 text-base text-muted-foreground">provisional</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {provisional > 0 && (
              <p className="mt-4 text-base text-muted-foreground">
                Sessions under {MIN_RELIABLE_MINUTES} minutes or {MIN_RELIABLE_DRINKS} drinks are
                marked provisional and ranked last — dividing a handful of drinks by a few minutes
                produces a rate that looks fast but means little.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
