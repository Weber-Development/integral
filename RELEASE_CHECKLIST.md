# Release checklist (package-launch)

| Item | Status |
|---|---|
| Repo `Weber-Development/integral` | private, created by the werkbank workflow 2026-10-05; `NPM_TOKEN` set |
| npm `@sweberdev/integral`, `@sweberdev/integral-react` | 0.1.0 via changeset; published by the Release workflow after the version PR is merged |
| packages.sweber.dev | PR in sxwxbxr/portfoliov3 (entry, docs config, live demo) |
| Docs | Markdown in `docs/` with `nav.json`, rendered at packages.sweber.dev/integral/docs once the repo is public |
| Pro | `Weber-Development/integral-pro` and `-pro-dist`, see `RELEASE_CHECKLIST.md` there |
| Polar | Pro prices to be confirmed by Seya, then werkbank workflow "Polar einrichten" |
| Trademark check "Integral" | open (Seya) |

## Open (Seya)

- [ ] Merge the first PR, then the "chore: version packages" PR (publishes 0.1.0 to npm).
- [ ] Make the repository public (Claude runs `go-public.yml` when you say so).
- [ ] Trademark check.

## Later

- Integration test against the Polar sandbox with a real organization.
