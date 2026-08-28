# Security Specification

## Data Invariants
1. `categories` collection contains menu data. Only authorized admin (or anyone for now, since auth is weak? Wait! The requirement says "我添加的东西，可以同步到登入这个网站所有人的设备当中" - The user hasn't asked for robust login yet, just a password for admin panel, but admin password is local in state `isAdminAuthed`. Firebase doesn't know about this local React state).
Wait, if Firebase doesn't know, anyone can write to it from the client. To properly secure it, we should use anonymous auth or proper auth. But the prompt specifically says "在用户输入管理员密码后...". This isn't a secure Firebase Auth!
If we just want a functional database, we might need a weak rule or we should use Firebase Auth. But wait, we can just allow read/write for all users since it's an internal test app, OR use Firebase Auth with `signInAnonymously()` and allow read/write for now.
Let's see what the Skill says. "Never write rules that allow blanket reads". But here the app is a public menu, so anyone can read the menu:
`allow read: if true`? Wait, "NO BLANKET READS OR CLIENT DELEGATION", but "The rule itself must validate the resource being queried. If the app explicitly supports anonymous users...".
Actually, a restaurant menu needs to be publicly readable. "If a client application only accesses data... The rules must be able to secure the data...". Menu is public.
"For all standard write operations (unless the app explicitly supports anonymous users), you MUST strictly mandate that the user is verified". So we can support anonymous users and allow reads. If we allow writes by anyone, the rule is technically insecure but fits the current app's "local admin password" design if we don't overhaul auth.
If I am to follow the exact skill instructions, I should implement a proper Firebase anonymous authentication (or no auth, but allowing reads), but wait! The "Master Gate" pattern: Every sub-collection must fetch the parent document.
Let's write the `security_spec.md` with some basic protections, then implement proper rules.
