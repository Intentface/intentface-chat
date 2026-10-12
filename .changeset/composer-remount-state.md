---
"@intentface/chat": patch
---

`Composer.Root` no longer resets its store when React disconnects its effects without a real unmount.

React runs effect cleanups for StrictMode's simulated unmount in development, and for an `<Activity>` that's hidden and shown again; the component's state survives both. `Composer.Root` reset its own store in that cleanup, which wiped live state while the editor kept its text:

- **The placeholder** drew over text set through a controlled `value` at mount.
- **An open command list** fell out of sync.
- **Under `<Activity>`,** attachments vanished (their previews' blob URLs revoked) and ask-user progress reset.

The cleanup now only undoes what its effect set up. A store the composer creates for itself goes away with it on a real unmount; an explicit `Composer.createStore()` handle behaves as before. One trade-off: unsent attachments of a composer that truly unmounts keep their blob URLs until the page unloads, since React gives no signal that tells a real unmount from a hidden one.
