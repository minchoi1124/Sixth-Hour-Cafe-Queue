'use client';

import { useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { Check, Copy, Link2, Loader2, LogOut, UserMinus } from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { membersCol, ownerInvitesCol } from '@/lib/cafe-paths';
import type { Member, OwnerInvite } from '@/lib/definitions';
import { callOwnersApi, inviteUrl } from '@/lib/owners-client';
import { toDate } from '@/lib/sessions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

const shortDate = (date: Date | null) =>
  date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

/** Remove another owner, or leave yourself, after confirming. */
function RemoveOwnerButton({
  cafeId,
  locationName,
  member,
  isSelf,
  isOnlyOwner,
}: {
  cafeId: string;
  locationName: string;
  member: Member;
  isSelf: boolean;
  isOnlyOwner: boolean;
}) {
  const { user } = useUser();
  const [isRemoving, setIsRemoving] = useState(false);
  const who = member.email ?? 'this person';

  const handleRemove = async () => {
    if (!user) return;
    setIsRemoving(true);
    try {
      await callOwnersApi('remove', { locationId: cafeId, uid: member.id }, user);
      // Leaving moves this account to another location it owns (or to setting
      // one up); the staff layout follows on its own.
      toast({ title: isSelf ? `You left ${locationName}` : `${who} was removed` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not remove', description: (e as Error).message });
    } finally {
      setIsRemoving(false);
    }
  };

  if (isOnlyOwner) {
    return (
      <span className="text-sm text-muted-foreground" title="A location needs at least one owner">
        Only owner
      </span>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-base text-muted-foreground hover:text-destructive" disabled={isRemoving}>
          {isRemoving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isSelf ? (
            <LogOut className="mr-2 h-4 w-4" />
          ) : (
            <UserMinus className="mr-2 h-4 w-4" />
          )}
          {isSelf ? 'Leave' : 'Remove'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isSelf ? `Leave ${locationName}?` : `Remove ${who}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {isSelf
              ? 'You’ll lose access to its menu, queue, history and settings. Another owner can invite you back.'
              : `They’ll lose access to ${locationName} straight away. Its menu, history and staff passcode stay as they are. You can invite them back later.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove} variant="destructive">
            {isSelf ? 'Yes, leave' : 'Yes, remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shows a freshly made link. It can't be shown again: only its hash is stored. */
function NewInviteDialog({ link, onClose }: { link: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy', description: 'Select the link and copy it instead.' });
    }
  };

  return (
    <Dialog
      open={link !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">Send this link to your co-owner</DialogTitle>
          <DialogDescription className="text-base">
            Whoever opens it and signs in becomes an owner, so send it only to them. It works once and
            expires in 7 days. Copy it now: it won’t be shown again.
          </DialogDescription>
        </DialogHeader>
        <span className="select-all break-all rounded-md bg-muted p-3 font-mono text-sm">{link}</span>
        <Button onClick={handleCopy} className="py-6 text-lg">
          {copied ? <Check className="mr-2 h-5 w-5" /> : <Copy className="mr-2 h-5 w-5" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Settings → Owners: who owns this location, invite links for new co-owners,
 * and removing or leaving. Joining and removing run on the server
 * (src/lib/owners.ts), which never lets the last owner go.
 */
export function OwnersCard({ cafeId, locationName }: { cafeId: string; locationName: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);

  const membersRef = useMemoFirebase(() => membersCol(firestore, cafeId), [firestore, cafeId]);
  const invitesRef = useMemoFirebase(() => ownerInvitesCol(firestore, cafeId), [firestore, cafeId]);
  const { data: members } = useCollection<Member>(membersRef);
  const { data: invites } = useCollection<OwnerInvite>(invitesRef);

  const owners = (members ?? [])
    .filter((member) => member.role === 'owner')
    .sort((a, b) => (toDate(a.joinedAt)?.getTime() ?? 0) - (toDate(b.joinedAt)?.getTime() ?? 0));
  const now = Date.now();
  const pending = (invites ?? [])
    .filter((invite) => !invite.usedBy && (toDate(invite.expiresAt)?.getTime() ?? 0) > now)
    .sort((a, b) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0));

  const handleCreate = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const { token } = await callOwnersApi<{ token: string }>('invite', { locationId: cafeId }, user);
      setNewLink(inviteUrl(window.location.origin, cafeId, token));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not make a link', description: (e as Error).message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (invite: OwnerInvite) => {
    try {
      await deleteDoc(doc(invitesRef, invite.id));
      toast({ title: 'Link revoked', description: 'It no longer works.' });
    } catch (e) {
      console.error('Failed to revoke invite:', e);
      toast({ variant: 'destructive', title: 'Could not revoke', description: 'Please try again.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Owners</CardTitle>
        <CardDescription className="text-lg">
          Owners sign in with their own account and can do everything you can, including changing
          settings and inviting or removing owners. Helpers don’t need this; they use the staff passcode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {members === null ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          <ul className="divide-y rounded-md border">
            {owners.map((member) => {
              const isSelf = member.id === user?.uid;
              return (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-lg">{member.email ?? 'No email'}</span>
                      {isSelf && <Badge variant="secondary">You</Badge>}
                    </div>
                    {member.joinedAt && (
                      <span className="text-sm text-muted-foreground">
                        Owner since {shortDate(toDate(member.joinedAt))}
                      </span>
                    )}
                  </div>
                  <RemoveOwnerButton
                    cafeId={cafeId}
                    locationName={locationName}
                    member={member}
                    isSelf={isSelf}
                    isOnlyOwner={owners.length <= 1}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {pending.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Links not used yet</h3>
            <ul className="divide-y rounded-md border">
              {pending.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="text-base text-muted-foreground">
                    Made {shortDate(toDate(invite.createdAt))}
                    {invite.createdByEmail ? ` by ${invite.createdByEmail}` : ''} · expires{' '}
                    {shortDate(toDate(invite.expiresAt))}
                  </span>
                  <Button variant="ghost" className="text-base" onClick={() => handleRevoke(invite)}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button onClick={handleCreate} disabled={isCreating} className="py-6 text-xl">
          {isCreating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Link2 className="mr-2 h-5 w-5" /> Invite a co-owner
            </>
          )}
        </Button>
        <NewInviteDialog link={newLink} onClose={() => setNewLink(null)} />
      </CardContent>
    </Card>
  );
}
