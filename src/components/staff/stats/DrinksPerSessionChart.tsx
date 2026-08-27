'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { SessionPoint } from '@/lib/stats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
 * Drinks made per session, oldest first.
 *
 * Deliberately a categorical axis, not a time axis: services cluster (eight in
 * six weeks, then a four-month gap) and a real date scale would compress every
 * session into one corner of the chart.
 */
export function DrinksPerSessionChart({ points }: { points: SessionPoint[] }) {
  const total = points.reduce((n, p) => n + p.drinks, 0);
  const average = points.length > 0 ? Math.round(total / points.length) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Drinks per session</CardTitle>
        <CardDescription className="text-lg">
          Every finished session, oldest to newest. Averaging {average} drinks a service.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[320px] w-full">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-base"
            />
            <YAxis tickLine={false} axisLine={false} width={40} className="text-base" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelKey="label"
                  formatter={(value, _name, item) => (
                    <div className="flex flex-col">
                      <span className="font-medium">{value} drinks</span>
                      <span className="text-muted-foreground">
                        {(item?.payload as SessionPoint)?.location}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="drinks" fill="var(--color-drinks)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
