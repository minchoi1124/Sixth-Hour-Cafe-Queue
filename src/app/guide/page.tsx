import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const metadata: Metadata = {
  title: 'How to use the app · Sixth Hour Cafe',
};

// Public on purpose: people read it before they have an account or have
// joined a location. Keep it in step with the app when features change.

const OwnerOnly = () => (
  <Badge variant="secondary" className="text-sm font-normal">
    Owner only
  </Badge>
);

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-6">{children}</ol>;
}

function Points({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border-l-4 border-primary bg-primary/5 p-3">{children}</p>
  );
}

const SECTIONS: { id: string; title: React.ReactNode; body: React.ReactNode }[] = [
  {
    id: 'how-it-works',
    title: 'How the app works',
    body: (
      <>
        <p>The app runs on two devices that stay in sync:</p>
        <Points>
          <li>
            <strong>Customer screen</strong>: an iPad facing the line. Customers type their name, pick a
            drink and order. They don’t need an account.
          </li>
          <li>
            <strong>Staff queue</strong>: a second device for whoever is making drinks. New orders appear
            as cards within a second or two, with no refreshing.
          </li>
        </Points>
        <p>
          Customers can only order while a <strong>session</strong> is running. A session is one
          service: you start it when you open and end it when you close. The rest of the time the
          customer screen says you’re closed and shows when you open next.
        </p>
        <p>
          There are two roles. <strong>Owners</strong> create a location and control its settings
          and staff. <strong>Staff</strong> run the queue and edit the menu.
        </p>
      </>
    ),
  },
  {
    id: 'first-time',
    title: 'Getting set up for the first time',
    body: (
      <>
        <p className="font-semibold">If you’re starting a new location</p>
        <Steps>
          <li>Go to the app, choose <strong>Get started</strong> and sign in with Google or an email and password.</li>
          <li>Name your location (for example “MSU Campus”) and pick a short public link. Customers never need to type it; you’ll scan a QR code instead.</li>
          <li>Open <strong>Menu</strong> and add your drinks (see “Building your menu” below).</li>
          <li>Invite your helpers from <strong>Settings</strong> (see “Adding staff”).</li>
        </Steps>
        <p className="font-semibold">If you’re joining as staff</p>
        <Steps>
          <li>Ask the owner for an invite code or join link.</li>
          <li>Sign in with your own account.</li>
          <li>Open the join link, or choose <strong>Enter an invite code</strong> and type the code.</li>
        </Steps>
      </>
    ),
  },
  {
    id: 'before-service',
    title: 'Before each service: checklist',
    body: (
      <Steps>
        <li>
          On the staff device, open <strong>Queue</strong> and tap <strong>Start Session</strong>.
          Pick where you are, the start time and which menu to serve. A start time later today
          schedules it instead, and the customer screen shows when you open.
        </li>
        <li>
          Tap <strong>Customer screen</strong> in the top bar and scan the QR code with the customer
          iPad’s camera. No camera? Type the link shown under the code.
        </li>
        <li>On the customer iPad, check the ordering page shows your drinks.</li>
        <li>
          Back on the staff device, tap the <strong>bell</strong> next to the drink counter if you want a
          chime for each new order. Make sure the iPad isn’t muted.
        </li>
      </Steps>
    ),
  },
  {
    id: 'during-service',
    title: 'Running the queue during service',
    body: (
      <>
        <Points>
          <li>
            Each order is a card with its <strong>number</strong> (counting from #1 each day), the
            customer’s name and their drink with any add-ons. Oldest orders come first.
          </li>
          <li>When a drink is handed over, tap <strong>Mark as Done</strong>. The card leaves the queue and counts towards the session.</li>
          <li>
            Wrong or duplicate order? Tap the <strong>trash icon</strong> on the card. Tap{' '}
            <strong>Undo</strong> in the pop-up if you didn’t mean to.
          </li>
          <li>
            Ran out of something? In <strong>Today’s Menu</strong> above the queue, flip that
            drink’s switch to <strong>Out of stock</strong>. Customers see it greyed out. It only
            affects this session.
          </li>
          <li>Forgot how a drink is made? Tap its name in Today’s Menu to open its recipe.</li>
          <li>
            Need to add or remove a drink for today? Use <strong>Edit</strong> on Today’s Menu. To
            keep that change for next time, tap <strong>Save to preset</strong>.
          </li>
          <li>The full-screen button in the top bar hides the menu bar so the queue has more room.</li>
        </Points>
        <Tip>
          When you close, tap <strong>End session</strong>. The customer screen switches to
          “closed” and the session’s totals are saved to History and Stats.
        </Tip>
      </>
    ),
  },
  {
    id: 'customer-ipad',
    title: 'Setting up the customer iPad',
    body: (
      <>
        <Steps>
          <li>Open the ordering page by scanning the QR code from <strong>Customer screen</strong>.</li>
          <li>
            Tap Safari’s <strong>Share</strong> button, then <strong>Add to Home Screen</strong>. Next
            time, just tap the icon; there’s nothing to type.
          </li>
          <li>
            Optional: turn on <strong>Guided Access</strong> (iPad Settings → Accessibility → Guided
            Access), then triple-click the side button on the ordering page. Customers can’t leave the
            app until you triple-click again.
          </li>
        </Steps>
        <p>What customers see:</p>
        <Points>
          <li>They enter a name (one letter is fine), pick a drink and choose any add-ons.</li>
          <li>
            After ordering they see their order number. The screen resets itself after a few seconds,
            or the next person taps <strong>Next in line? Tap to order</strong>.
          </li>
          <li>If someone walks away halfway through, the form clears itself after a minute.</li>
          <li>The screen stays awake while the ordering page is open.</li>
        </Points>
      </>
    ),
  },
  {
    id: 'menu',
    title: 'Building your menu',
    body: (
      <>
        <p>
          Open <strong>Menu</strong> in the top bar. Everything saves automatically; look for
          “All changes saved”.
        </p>
        <Points>
          <li>
            <strong>Drink Library</strong>: every drink you ever serve. Add a name, category, short
            description and any add-ons (for example oat milk or an extra shot). An add-on can be ticked
            by default. Use Move Up and Move Down to set the order customers see.
          </li>
          <li><strong>Categories</strong>: group drinks (for example Lattes or Tea) so the customer screen stays tidy.</li>
          <li>
            <strong>Menu presets</strong>: saved sets of drinks, like “Fall Menu”. You pick one
            when you start a session, so you don’t build the menu from scratch each time.
          </li>
          <li>
            <strong>Recipes</strong>: open a drink and fill in “How to make it”. Only staff
            see recipes, from Today’s Menu during service.
          </li>
        </Points>
      </>
    ),
  },
  {
    id: 'history-stats',
    title: 'History and stats',
    body: (
      <Points>
        <li>The <strong>History</strong> tab on the Queue page lists past sessions with what was made.</li>
        <li>The <strong>Σ</strong> button shows every drink ever made at your location.</li>
        <li><strong>Stats</strong> shows totals, your busiest session, fastest service and when rushes happen.</li>
      </Points>
    ),
  },
  {
    id: 'staff',
    title: (
      <>
        Adding and removing staff
        <OwnerOnly />
      </>
    ),
    body: (
      <Steps>
        <li>Open <strong>Settings</strong> and tap <strong>Create invite code</strong>.</li>
        <li>Send your helper the code, or copy the join link and send that.</li>
        <li>They sign in with their own account and enter the code. They then appear under <strong>Current staff</strong>.</li>
        <li>To take away someone’s access, remove them from Current staff.</li>
      </Steps>
    ),
  },
  {
    id: 'settings',
    title: (
      <>
        Location settings
        <OwnerOnly />
      </>
    ),
    body: (
      <Points>
        <li><strong>Location name</strong>: shown on the customer screen.</li>
        <li>
          <strong>Customer ordering link</strong>: changing it breaks the old link. Re-open the
          ordering page on the customer iPad afterwards (scan the new QR code), and replace any
          printed codes.
        </li>
        <li><strong>Timezone</strong>: used for session times and for when order numbers restart.</li>
        <li><strong>Instagram QR</strong>: shows a small code after customers order so they can follow you.</li>
      </Points>
    ),
  },
  {
    id: 'troubleshooting',
    title: 'Something isn’t working',
    body: (
      <div className="space-y-4">
        <div>
          <p className="font-semibold">The customer screen says “We’re closed right now”.</p>
          <p>No session is running. Tap <strong>Start Session</strong> on the Queue page. A scheduled session only opens at its start time.</p>
        </div>
        <div>
          <p className="font-semibold">A customer ordered but nothing showed up on the queue.</p>
          <p>
            Check both devices are on the internet. Make sure the customer iPad was opened from{' '}
            <em>your</em> location’s QR code. Then reload the staff page.
          </p>
        </div>
        <div>
          <p className="font-semibold">The chime doesn’t play.</p>
          <p>
            Check the bell is on and the iPad isn’t muted or in silent mode. After opening or
            reloading the page, tap anywhere on it once; iPads only allow sound after a tap.
          </p>
        </div>
        <div>
          <p className="font-semibold">A drink is missing from the customer screen.</p>
          <p>It isn’t on today’s menu. Add it with Edit on Today’s Menu. If it shows as out of stock, flip its switch back.</p>
        </div>
        <div>
          <p className="font-semibold">I deleted an order by mistake.</p>
          <p>Tap <strong>Undo</strong> in the pop-up straight away. If it’s gone, ask the customer to order again.</p>
        </div>
        <div>
          <p className="font-semibold">The customer iPad shows “page not found”.</p>
          <p>The ordering link was probably changed in Settings. Scan the QR code from Customer screen again.</p>
        </div>
        <div>
          <p className="font-semibold">I can’t see Settings.</p>
          <p>Settings are for owners only. Ask your location’s owner.</p>
        </div>
      </div>
    ),
  },
];

export default function GuidePage() {
  return (
    <main className="container mx-auto max-w-3xl p-4 sm:p-8">
      <Button asChild variant="ghost" className="mb-6 gap-2 px-2 text-lg">
        <Link href="/staff">
          <ArrowLeft className="h-5 w-5" />
          Back to the app
        </Link>
      </Button>

      <div className="mb-8 flex items-center gap-4">
        <Logo className="h-16 w-16 flex-shrink-0" />
        <div>
          <h1 className="text-4xl font-bold sm:text-5xl">How to use the app</h1>
          <p className="mt-1 text-xl text-muted-foreground">
            Everything you need to run a Sixth Hour Cafe location. Tap a topic to open it.
          </p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['how-it-works']} className="rounded-lg border bg-card px-4 sm:px-6">
        {SECTIONS.map((section) => (
          <AccordionItem key={section.id} value={section.id} id={section.id}>
            <AccordionTrigger className="text-left text-2xl">
              {/* One child, so the trigger keeps a badge beside the title instead of spreading them apart. */}
              <span className="flex flex-wrap items-center gap-3">{section.title}</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 text-lg leading-relaxed">{section.body}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </main>
  );
}
