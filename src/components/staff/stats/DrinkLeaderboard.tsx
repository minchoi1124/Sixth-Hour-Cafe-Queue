'use client';

import type { DrinkTotal } from '@/lib/stats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * All-time drinks made, per drink.
 *
 * Rendered as plain proportional bars rather than a chart component: it's a
 * ranked list where the labels matter more than the geometry, and a bar chart
 * would either truncate the names or turn them sideways.
 */
export function DrinkLeaderboard({ drinks }: { drinks: DrinkTotal[] }) {
  const max = drinks[0]?.drinks ?? 0;
  const total = drinks.reduce((n, d) => n + d.drinks, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Most made</CardTitle>
        <CardDescription className="text-lg">
          Every drink across all sessions. Counted by the name recorded at the time, so a drink
          renamed part-way through appears under both.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {drinks.length === 0 ? (
          <p className="py-6 text-center text-lg text-muted-foreground">
            No drink totals recorded yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {drinks.map((drink) => {
              const share = total > 0 ? (drink.drinks / total) * 100 : 0;
              return (
                <li key={drink.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-xl">{drink.name}</span>
                    <span className="flex-shrink-0 text-xl font-medium tabular-nums">
                      {drink.drinks}
                      <span className="ml-2 text-base font-normal text-muted-foreground">
                        {share.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${max > 0 ? (drink.drinks / max) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-base text-muted-foreground">
                    across {drink.sessions} session{drink.sessions === 1 ? '' : 's'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
