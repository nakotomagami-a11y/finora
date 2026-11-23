# Publishing checklist

This repository is public, and git history is close to permanent: once something is pushed, removing it means rewriting history everywhere it was copied, and pull requests keep their commits even after a force-push. So nothing questionable is published "for now".

Go through this list **before every commit, push, pull request, merge, PR description, PR or issue comment, and release**. The guard script automates most of it; the rest needs your eyes.

## 1. The guard is on

- [ ] `git config core.hooksPath` prints `.githooks`. If not, run `node scripts/guard/install.mjs`.
- [ ] `.guard/denylist.txt` exists and is current (ask a maintainer for the list).
- [ ] You never use `--no-verify`, and never disable or edit the hooks to get a commit through.

The hooks run `scripts/guard/guard.mjs` on staged changes (pre-commit), the commit message (commit-msg) and every commit being pushed (pre-push). CI runs it again on each pull request and on `main`.

## 2. Read your own diff

- [ ] `git diff --cached`: read every line you are about to commit, not just the files you meant to change.
- [ ] Generated files, lockfiles and snapshots changed only in expected ways.

## 3. No names

- [ ] No names of other companies, products or services we compare ourselves with, and no real companies used as examples. Examples use obviously made-up names ("Example Company A").
- [ ] No people's names, except contributors in git metadata.
- [ ] No context from other projects or workplaces: their names, paths, code or wording.

Data sources we integrate (public registries, official APIs) may be named where the code or docs need them.

The guard blocks names already on the private denylist. To find the ones nobody has listed yet, run the discovery sweep over your change before review (H4, C15):

```
node scripts/check-outside-names.mjs range <base> <head>    # a slice's commits
node scripts/check-outside-names.mjs tree                   # a full audit
```

It prints `file:line  class` (host, org, ticker, id, brand, binary) and a counts-only summary line, never the matched text. Resolve each hit by giving it a coded alias, removing it, or, for a public body, official registry, open standard, tool, licence, official field name or a plainly fictional test name, listing it in the private allowlist `.local/outside-names-allow.txt` as `<category> <host or phrase>`. It exits 1 while any hit is unresolved.

**In a fresh clone the allowlist is absent, because it is private**: it would itself name what it allows. There, the sweep reports every kept name as unresolved (about 900 in a full `tree` run), so a contributor cannot tell a real hit from a kept one. Run `range` over your own commits, and read each hit's class and line. The coordinator runs the sweep with the allowlist before every slice is accepted, and that run is the authority (qa's check, H4).

## 4. No personal or machine data

- [ ] No emails, phone numbers, personal codes or ID numbers, home addresses, or birth dates.
- [ ] No local paths (user profile folders, drive letters), machine names or usernames.
- [ ] Research output about real people or companies stays in the gitignored `research/.cache/` or `.local/`.

## 5. No secrets

- [ ] No API keys, tokens, passwords, private keys or `.env` files. Configuration is documented in `.env.example` with placeholder values.
- [ ] If a secret was ever committed, even on a branch that was never pushed, rotate it. Deleting the line is not enough.

## 6. No data that isn't ours to publish

- [ ] No downloaded datasets, database files or API responses. Tests use small synthetic fixtures under `fixtures/`.
- [ ] Nothing from a source whose licence forbids redistribution (market prices, for example).

## 7. Images and other binaries

- [ ] Open every image, PDF or video at full size and read all visible text: names, emails, paths, tabs, notifications, bookmarks.
- [ ] Then record it: `node scripts/guard/guard.mjs review <file>`, and stage `scripts/guard/reviewed-media.txt` with it. The guard blocks binaries that have not been recorded.

## 8. Text outside commits

PR titles and descriptions, comments, issues and release notes are public too, and no hook sees them.

- [ ] Check the text first: `node scripts/guard/guard.mjs text <file>` (or pipe it in with `-`).

## 9. Before merging

- [ ] The guard CI job is green.
- [ ] `node scripts/guard/guard.mjs range origin/main HEAD` is clean locally.

## If something leaked

1. Stop pushing.
2. Rotate any exposed secret immediately.
3. Tell a maintainer. A maintainer can switch the repository to private while it is cleaned.
4. A force-push does not remove commits that a pull request references. A clean history may require recreating the repository.
