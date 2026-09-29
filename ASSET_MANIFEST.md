# Fake-News Checker Game Asset Pack

This workspace contains separate production assets based on `ASSETS.md`.

## Art-generation method

- The two learning-room backgrounds and all recurring-character poses were generated with the built-in image generation tool.
- Character pose prompts used one fixed master reference per character and explicitly preserved identity, wardrobe, proportions, lighting, and transparent backgrounds.
- Icons, cards, controls, progress pieces, messages, result panels, badges, weight cards, and style cards are generated deterministically by `scripts/generate-ui-assets.ps1` so labels, colors, dimensions, and spacing remain exact.

## Shared image prompt

> Create a polished 2.5D cartoon educational-game asset for Grade 6, matching a warm family learning-room world. Use soft cinematic lighting from upper left, rounded friendly forms, clean edges, smooth materials, gentle shading, deep navy accents, and warm color temperature. Kid-friendly but not childish. Keep consistent character proportions, camera perspective, and material style. No logo or watermark.

Each character variant additionally instructs the generator to preserve the exact face, skin tone, hair, clothing, body proportions, lighting, and material style of its master reference and to return genuine transparent alpha.

## Folder map

- `assets/backgrounds/` — 16:9 room backgrounds
- `assets/characters/` — the character poses used in the game
- `assets/decor/` — message illustrations and the phone frame
- `assets/icons/` — clue icons and prompt notes
- `assets/messages/` — the eight message cards
- `assets/badges/` — three achievement badges
- `assets/weights/` — star icons
- `assets/skai/` — SKAI setup-screen assets; `assets/skai/v2/` holds the HUD, CTA plates, sound menu and cards from Figma
- `assets/fonts/` — local Chakra Petch, Fredoka One and Inter fonts

Unused artwork (old buttons, panels, style cards, progress pieces, spare poses and the `_source_refs` masters) was removed on 29 Sep 2026; it can be restored from git history if needed. `scripts/generate-ui-assets.ps1` still recreates the deterministic UI images.

The built-in image generator created five separate transparent 2.5D icons in `assets/icons/`: `icon_source_3d.png`, `icon_date_3d.png`, `icon_image_3d.png`, `icon_urgent_words_3d.png`, and `icon_school_rain_3d.png`. The updated school message card is `assets/messages/message_school_closure_3d.png`. Original artwork is retained. Prompt details are saved in `assets/icons/GENERATED_PROMPTS.md`. The game uses the four new clue icons and the updated school card.

## Modern message workspace

Five new built-in image-generation assets power the checking screen: `assets/backgrounds/bg_message_studio.png` and `assets/decor/message_prize.png`, `message_flood.png`, `message_health.png`, `message_weather.png`. Each is saved separately. Message text is rendered as accessible HTML beside the artwork. Prompts are documented in `assets/decor/MODERN_MESSAGE_PROMPTS.md`.

## Regeneration commands

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-ui-assets.ps1
```

The deterministic script regenerates only UI/icon/message assets. AI-generated backgrounds and character art are already saved in the project and are not overwritten by the script.
