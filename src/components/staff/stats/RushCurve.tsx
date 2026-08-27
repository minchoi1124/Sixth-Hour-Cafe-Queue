'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { Order, Session } from '@/lib/definitions';
import { BUCKET_MINUTES, peakBucket, rushCurve } from '@/lib/stats';
import { toDate } from '@/lib/sessions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const config = {
  drinks: { label: 'Drinks', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

/**
 * When the orders actually landed within one service, in 15-minute windows.
 *
 * Shown for one session at a time rather than averaged across all of them: the
 * services start at different hours (autumn ones ran early afternoon, March ran
 * evening), so an average would smear two different shapes into a meaningless
 * hump.
 */
export function RushCurve({
  sessions,
  ordersBySession,
  formatLabel,
  formatTime,
  isLoading,
}: {
  sessions: Session[];
  ordersBySession: Map<string, Order[]>;
  formatLabel: (date: Date) => string;
  formatTime: (date: Date) => string;
  isLoading: boolean;
}) {
  // Sessions arrive newest-first, so the default selection is the most recent
  // service that actually has orders to draw.
  const withOrders = useMemo(
    () => sessions.filter((s) => (ordersBySession.get(s.id)?.length ?? 0) > 0),
    [sessions, ordersBySession],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = withOrders.find((s) => s.id === selectedId) ?? withOrders[0] ?? null;

  const buckets = useMemo(
    () => (selected ? rushCurve(ordersBySession.get(selected.id) ?? [], formatTime) : []),
    [selected, ordersBySession, formatTime],
  );
  const peak = peakBucket(buckets);

  const optionLabel = (session: Session) => {
    const date = toDate(session.startsAt);
    return `${date ? formatLabel(date) : 'Undated'} · ${session.location}`;
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-3xl">Rush curve</CardTitle>
            <CardDescription className="text-lg">
              Drinks ordered per {BUCKET_MINUTES} minutes.
              {peak && ` Busiest window was ${peak.label} with ${peak.drinks}.`}
            </CardDescription>
          </div>
          {withOrders.length > 1 && selected && (
            <Select value={selected.id} onValueChange={setSelectedId}>
              <SelectTrigger className="h-12 w-full text-lg sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {withOrders.map((session) => (
                  <SelectItem key={session.id} value={session.id} className="text-lg">
                    {optionLabel(session)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : buckets.length === 0 ? (
          <p className="py-6 text-center text-lg text-muted-foreground">
            No order times recorded for this session.
          </p>
        ) : (
          <ChartContainer config={config} className="h-[300px] w-full">
            <AreaChart data={buckets} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval="preserveStartEnd"
                minTickGap={24}
                className="text-base"
              />
              <YAxis tickLine={false} axisLine={false} width={40} className="text-base" />
              <ChartTooltip content={<ChartTooltipContent labelKey="label" />} />
              <Area
                dataKey="drinks"
                type="monotone"
                stroke="var(--color-drinks)"
                fill="var(--color-drinks)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
