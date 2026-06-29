# Repository Guidelines

## Project Structure & Module Organization

This repository stores OpenHuman Rive mascots and the tooling that turns them into a production manifest. Mascot source lives in `mascots/<kebab-case-id>/`; each folder must contain `mascot.json`, one compiled runtime `.riv`, and one Rive Studio source `.rev`. The generated manifest is `dist/mascots.json`. Validation scripts live in `scripts/`, the JSON schema is in `schemas/mascots.schema.json`, and the local visual tester is a Next.js app under `app/`.

## Build, Test, and Development Commands

Use Node 20 or newer.

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run build`: regenerate `dist/mascots.json` from `mascots/**`.
- `npm run check`: verify the generated manifest is current.
- `npm test`: run asset-pair, schema, manifest, and ready-mascot state-engine checks.
- `npm run test:state-engine:all`: also validate draft mascots against the state-engine contract.
- `npm run preview`: start the local Next.js mascot tester.
- `npm run test:preview`: compile the preview app with `next build`.

## Coding Style & Naming Conventions

JavaScript uses ES modules, two-space indentation, double quotes, and semicolons. Keep scripts small and explicit; prefer structured JSON parsing over ad hoc string handling. Mascot folder IDs must be lowercase kebab-case, for example `tiny-mascot`. Rive asset filenames must be lower camelCase with matching stems, for example `tinyMascot.riv` and `tinyMascot.rev`; do not use snake_case.

## Testing Guidelines

Run `npm test` before submitting changes that touch `mascots/`, `scripts/`, `schemas/`, or `dist/`. If you edit mascot metadata or assets, run `npm run build` first and commit the resulting `dist/mascots.json` change. Mascots with `"status": "ready"` must satisfy the state-engine test; drafts may be checked with `npm run test:state-engine:all` before promotion.

## Commit & Pull Request Guidelines

Recent history uses short, imperative Conventional Commit-style messages such as `chore: update mascot manifest` and `fix: keep manifest check stable after CI`. Keep PRs focused, describe the mascot or tooling change, list commands run, and include screenshots or recordings from `npm run preview` when visual behavior changes.

## Agent-Specific Instructions

Do not overwrite existing mascot assets. Preserve generated manifest stability: after any mascot change, run `npm run build` followed by `npm run check`.
