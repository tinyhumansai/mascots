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

## Rive contract

OpenHuman's current Rive runtime expects the same contract as `tiny_mascot.riv`:

- state machine: `MascotSM`
- view model: `ViewModel1`
- enum input: `pose`
- enum input: `mouthVisemeCode`
- color input: `primaryColor`
- color input: `secondaryColor`
- pose enum name: `poses`
- viseme enum name: `visme_codes`

Required pose values:

```text
idle
thinking
celebration
bookreading
coffeedrink
writing
bobbateadrink
recording
hand_wave
dancing
```

Required viseme values:

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

Mascots with `"status": "ready"` are production candidates and must pass the contract test. Mascots with `"status": "draft"` are kept in the manifest for review but should not be shown as production-ready in OpenHuman.

## Add a mascot

1. Create `mascots/<kebab-case-id>/`.
2. Add `<id>.riv` and `<id>.rev`.
3. Add `mascot.json` using `mascots/tiny-mascot/mascot.json` as the reference.
4. Run the checks.

```sh
npm run build
npm test
```

To check draft mascots against the OpenHuman Rive contract too:

```sh
npm run test:contract:all
```

## Generated manifest

The manifest contains one entry per mascot, including:

- metadata (`id`, `name`, `description`, `status`, `tags`)
- OpenHuman Rive contract metadata
- file entries with `role`, repository path, raw GitHub URL, SHA-256 hash, and byte size

GitHub Actions rebuilds `dist/mascots.json` on changes to `mascots/**` and commits the generated file back to `main`.
