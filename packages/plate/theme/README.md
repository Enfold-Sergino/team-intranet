# @team-intranet/plate-theme

`delta/` is a snapshot of the Plate theme the intranet uses: `building-blocks/<slug>.json` and
`content-types/<slug>.json`, fetched with the Delta CLI. Don't edit these files by hand: change the
theme in Plate and sync.

`pnpm test` checks the snapshot against the core contract (`packages/core/src/schemas.ts`): every
block and item type the site renders exists in Plate with a field for each prop, and every Plate
block has a component.

## Sync from Plate

Once: install the CLI, copy `.env.example` to `.env` in this package and set `PLATE_THEME_PRN` (the
full PRN, not just the ID).

```sh
pnpm add -g @lars-plate/delta-cli
```

After every change to building blocks or content types in Plate:

```sh
pnpm plate:sync && pnpm test
```

The sync goes to a scratch folder and only a complete theme replaces `delta/`, because the CLI
(0.2.11) links content types by PRN and fetches only the organisation's 10 newest content types.
It also writes Vue components the site doesn't use; the sync deletes them.
