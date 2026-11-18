## Staff sign in with a passcode

Pop-ups kept stalling when the person with the login wasn't there, and inviting helpers was hard for less technical owners. Staff no longer need an account.

- **Pick a location, type the passcode.** The main page lists every location; staff choose theirs and enter its staff passcode. The phone stays signed in after that.
- **Easy to type.** A passcode is any phrase of 6–40 characters. Capital letters and extra spaces don't matter, since phones capitalize the first letter on their own.
- **Default `000000`** until the owner changes it in **Settings → Staff passcode**, which also has a **Make one up** button. Changing it signs out every phone that used the old one.
- **Helpers can look it up** under **Passcode** at the top of the screen, to let others in when the owner isn't there. Only owners can change it.
- **Guessing is limited.** After 10 wrong passcodes, sign-in for that location pauses for 10 minutes.
- A one-time announcement on the main page explains the change.

## Staff accounts are now co-owners

Accounts from the old invite system keep working and now have the same access as the owner. Invite codes are retired.

- `scripts/promote-staff-to-owners.ts` gives every staff account the owner role (dry run by default).
- `scripts/remove-staff-invites.ts` deletes the leftover invite codes and leaves accounts alone.

## Under the hood

- Passcode sign-in goes through `/api/staff-signin` (App Check protected), which issues a Firebase custom token naming the location and its passcode version. The Firestore rules accept it only while that version matches the location's, so changing the passcode revokes every device at once.
- `npm run dev:emulator` runs a full local preview against the Firebase emulators with test data, isolated from production.
- Rules tests cover passcode sign-in, revocation, helper permissions and promoted accounts.

## Also since v1.2.0

- Readable database layout for multiple locations (#25)
- Customer screen link shown as a QR code
- "What's new" dialog for staff
- The customer kiosk resets itself between orders
- Staff and customer screens stay awake
- Optional chime for new orders
- Smoother add-ons and drink picking on the order form
- Daily order numbers
- In-app guide on how to use the app
- **Fixed:** the staff queue re-subscribes periodically while idle (#26)

---

**Full changelog:** https://github.com/minchoi1124/Sixth-Hour-Cafe-Queue/compare/v1.2.0...v1.3.0
