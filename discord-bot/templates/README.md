# Business Card Template

Place your business card background image as `business-card.png` in this directory.

## Text Positioning

The `/card` command mirrors the PHMC Tools website layout
(`src/components/UI/BusinessCard.jsx` `overlayStyles`). Positions are
percentages of the template size; font sizes are px at the website's 750px
reference width and scale automatically:

| Field          | Left  | Top    | Font (ref) | Color   |
|----------------|-------|--------|------------|---------|
| Character Name | 2.75% | 23.44% | 35px black | #000000 |
| Rank / Title   | 3.31% | 31.92% | 15px       | #cb1212 |
| Phone Number   | 12.56%| 54.60%* | 15px black | #000000 |

\* Website value is 52.77% — the bot uses 54.60% to compensate for the
canvas-`top` vs SVG-`hanging` baseline difference, centering the text on
the phone icon (verified pixel-exact against the template).

Typeface: `LufgaMedium.ttf` (bundled here, same file as the website's
`src/assets/LufgaMedium.ttf`), Arial fallback.

To adjust positions, change the website first, then mirror the percentages
into the `LAYOUT` object in `services/cardGenerator.js`.
