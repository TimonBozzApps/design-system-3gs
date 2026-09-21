# Changesets

Every user-facing change to `@3gs/ui` ships with a changeset:

```bash
pnpm changeset            # pick the bump (patch / minor / major) and describe it
pnpm changeset:version   # (release step) bumps versions + writes CHANGELOG.md
pnpm release              # builds and publishes what changed
```

The `site` package is private and ignored.
