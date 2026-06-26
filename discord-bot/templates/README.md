# Business Card Template

Place your business card background image as `business-card.png` in this directory.

## Text Positioning

The `/card` command overlays text at these coordinates on the template:

| Field           | X (px) | Y (px) | Font           | Color  |
|-----------------|--------|--------|----------------|--------|
| Character Name  | 200    | 150    | Bold 28px      | #000000|
| Rank / Title    | 200    | 190    | Regular 20px   | #555555|

To adjust positions, edit `services/cardGenerator.js` — the `TEXT_POSITIONS` object.
