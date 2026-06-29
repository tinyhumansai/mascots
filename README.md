# OpenHuman mascots

Community-driven Rive mascots for the OpenHuman app.

Each mascot lives in its own folder under `mascots/<id>/` and must include:

- `mascot.json` metadata
- one compiled runtime `.riv`
- one Rive Studio source `.rev`

`dist/mascots.json` is generated from those folders and can be read by OpenHuman in production:

```text
https://raw.githubusercontent.com/tinyhumansai/mascots/main/dist/mascots.json
```

## State Engine

The manifest exposes a small typed state engine. OpenHuman can keep its Rive view model and renderer wiring internal; mascot entries only need to describe the states and viseme values the runtime should drive.

Each `mascot.json` defines:

- `stateEngine.visemeCodes`: mouth shape codes supported by the asset
- `stateEngine.states.idle`: the resting state
- `stateEngine.states.thinking`: the thinking state
- `stateEngine.idlePoseCycle`: idle poses OpenHuman can cycle through before returning to idle

Required viseme codes:

```text
sil
PP
FF
TH
DD
kk
CH
SS
nn
RR
aa
E
ih
oh
ou
```

The default idle pose cycle is:

```text
idle
bookreading
coffeedrink
writing
bobbateadrink
hand_wave
dancing
```

Mascots with `"status": "ready"` are production candidates and must pass the state-engine test. Mascots with `"status": "draft"` are kept in the manifest for review but should not be shown as production-ready in OpenHuman.

Rive asset filenames must use lower camelCase, for example `tinyMascot.riv` and `tinyMascot.rev`. Do not use snake_case filenames like `tiny_mascot.riv`.

## Add a mascot

1. Create `mascots/<kebab-case-id>/`.
2. Add lower camelCase `.riv` and `.rev` files with the same stem.
3. Add `mascot.json` using `mascots/tiny-mascot/mascot.json` as the reference.
4. Run the checks.

```sh
npm run build
npm test
```

To check draft mascots against the OpenHuman Rive state engine too:

```sh
npm run test:state-engine:all
```

## Local Tester

This repo includes a small Next.js tester for local visual QA:

```sh
npm run preview
```

The tester reads `dist/mascots.json`, lists available runtime `.riv` files, serves local assets from `mascots/**`, and renders the selected mascot with controls for:

- idle state
- thinking state
- viseme code
- idle pose cycling

Draft mascots remain selectable for debugging, but `npm test` only requires ready mascots to pass the state-engine check.

## Generated manifest

The manifest contains one entry per mascot, including:

- metadata (`id`, `name`, `description`, `status`, `tags`)
- OpenHuman state-engine metadata
- file entries with `role`, repository path, raw GitHub URL, SHA-256 hash, and byte size

GitHub Actions rebuilds `dist/mascots.json` on changes to `mascots/**` and commits the generated file back to `main`.

## Scripts

- `npm run build`: regenerate `dist/mascots.json`
- `npm run check`: verify the generated manifest is current
- `npm run test:schema`: validate the manifest against `schemas/mascots.schema.json`
- `npm run test:pairs`: verify `.riv` / `.rev` pairs and lower camelCase asset names
- `npm run test:state-engine`: verify ready mascots expose the required state-engine strings
- `npm run test:state-engine:all`: run the state-engine check against drafts too
- `npm run preview`: start the local Next.js Rive tester
