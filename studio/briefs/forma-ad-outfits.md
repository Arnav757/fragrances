# Outfit pictures for the FORMA 15 s ad

Made to drop into `studio/reels/forma_ad.py`. Two kinds of picture:

- **A. Arjun looks (A1–A6):** full length, on pure white. These swap into the grid, the half-beat montage and
  the "MAKE IT YOURS." wipe. They all use the same pose and framing, so any look can wipe into any other.
- **B. Art plates (B1–B4):** no face. Clothes treated like the pack's paper, glass and sculpture plates, so
  the outfits belong to the same visual world as the art.

Attach `img0_reference.png` (Arjun's reference sheet) to every A prompt. Generate everything at
**1024×1536 portrait** and send the original PNGs, not a PDF or screenshot.

## Consistency block for A1–A6

Paste this at the top of every A prompt.

```
Use the attached reference image of Arjun. Keep his face, skin tone, hair, beard, body proportions and height exactly the same. Photorealistic editorial fashion photo, 9:16 portrait. Full length, head to toe, both shoes fully visible, subject centred and filling 85% of the frame height, standing straight facing camera, arms relaxed slightly away from the body so there is clear background between arms and torso. Pure white seamless background (#FFFFFF), evenly lit, no floor shadow, no gradient, no vignette. Soft key light from front-left, sharp focus, natural skin texture. Trousers are full length with the hem resting on the shoes. No text, no logos, no brand marks, no watermark.
```

The pure white, the gap between arms and body, and "no floor shadow" are what let the edit cut him out cleanly.
The cutouts in the current ad came from grey backdrops, which is why their edges are soft.

## A. Arjun looks

**A1: weekend** (`a1_weekend.png`) · refs R7, R1
```
[Consistency block]
Outfit: navy linen popover shirt with a short button placket open at the neck, long sleeves pushed to the forearm, hem ending at the hip; light-wash straight-leg jeans; cognac leather penny loafers; thin gold chain; tortoiseshell sunglasses hooked into the placket. Relaxed half-smile.
```

**A2: office** (`a2_office.png`) · refs R6, R26
```
[Consistency block]
Outfit: camel brushed-wool crew-neck sweater with a crisp white T-shirt hem showing 2 cm below it; taupe double-pleated high-rise wide-leg trousers; cognac leather penny loafers; brown leather-strap watch. Calm, focused expression.
```

**A3: summer** (`a3_summer.png`) · refs R25, R21
```
[Consistency block]
Outfit: off-white slub-cotton long-sleeve henley, boxy and ending at the belt, two buttons open, sleeves pushed up; mid-wash flared jeans; cognac leather penny loafers; red-brown tinted sunglasses on. Relaxed, mid-laugh.
```

**A4: wedding** (`a4_wedding.png`) · refs R31, R30
```
[Consistency block]
Outfit: ivory (not stark white) short bandhgala jacket with a mandarin collar and tonal buttons, ending at the hip; a single deep red rose brooch on the left chest; black flared trousers; polished black leather loafers. Warm, proud smile. Keep the ivory clearly distinguishable from the white background with soft edge shading.
```

**A5: knit** (`a5_knit.png`) · refs R15, R23
```
[Consistency block]
Outfit: mid-grey boxy crew-neck sweater with a white T-shirt hem showing below it; ecru wide-leg jeans; dark brown leather belt; black suede Chelsea boots; thin silver ring. Neutral, confident.
```

**A6: tonal navy** (`a6_tonal.png`) · refs R13, R10 (navy instead of black, because it suits his warm skin)
```
[Consistency block]
Outfit: head-to-toe deep navy: fine-gauge knit crew-neck sweater tucked into navy pleated wide trousers that pool slightly over the shoes; dark brown woven leather loafers; an oversized navy leather tote on one shoulder. Calm half-smile.
```

## B. Art plates (no face, same world as the pack)

**B1: paper studio flat-lay** (`b1_flatlay.png`)
```
Overhead editorial flat-lay on a pure white surface, 9:16 portrait. A neatly arranged men's outfit: pale blue cotton shirt folded with the collar open, navy pinstripe wide trousers folded lengthwise, dark brown leather penny loafers, brown leather belt coiled, a thin gold chain. Around and partly under the clothes: bold cut-paper shapes in cobalt blue (#2557FF), signal orange (#FF4F2A) and acid lime (#C7FF43): a half-circle, a crescent, a triangle, a thick brush-stroke arc. Two real hands entering from the top right, placing the loafers. Bright even daylight, crisp soft shadows, tactile paper texture. No text, no logos.
```

**B2: sculptural plinth** (`b2_plinth.png`)
```
Minimal studio installation, 9:16 portrait, pure white room with a white cube plinth. On the plinth stands a headless tailor's form wearing a pale blue open-collar shirt tucked into navy pinstripe wide trousers that fall to the plinth. Behind it, a large cobalt blue arch and a translucent orange glass disc, a thin lime ring orbiting at an angle on a steel rod. Hard daylight from the left casting clean blue and orange coloured shadows across the white floor. Photorealistic, sharp. No text, no logos.
```

**B3: fabric chips** (`b3_swatches.png`)
```
Close-up product photo, 9:16 portrait, pure white background. A fan of rectangular fabric swatches spread like paint chips: pale blue oxford, navy pinstripe wool, camel brushed wool, olive cotton twill, ecru denim, ivory raw silk, cognac suede. Each swatch has a clean cut edge and visible weave texture. One cobalt glass sphere and one orange glass sphere resting on the fan. Soft daylight, crisp shadow. No text, no labels, no logos.
```

**B4: hem and shoe macro** (`b4_hem.png`)
```
Close-up editorial photo from the knee down, 9:16 portrait, pure white seamless floor and background. Navy pinstripe wide-leg trouser hem falling over a dark brown leather penny loafer with a soft single break, one foot stepping slightly forward so the fabric swings. A single swoosh of glossy cobalt blue paint on the white floor beside the shoe. Sharp focus, soft daylight. No text, no logos.
```

## Where each goes in the ad

| Picture | Where it goes |
|---|---|
| A1, A3, A5 | Grid windows in "MANY LOOKS." (5.4–7.9 s): each window circle-wipes from an art plate to a look |
| A2, A4, A6 | The half-beat montage (7.9–9.5 s), plus a three-up of small windows |
| A4 | Swap target in "MAKE IT YOURS." (the lime-disc wipe), replacing the olive look |
| B1 | Replaces the paper plate in the first grid window |
| B2 | Replaces the kinetic installation as the montage's last full-bleed frame |
| B3 | Behind "YOUR COLOURS." as a quick 0.2 s insert |
| B4 | Replaces the current hem crop in the montage |

## Checks before sending

- Same face in every A image. If one drifts, re-attach the reference and add "his face must match the
  reference exactly".
- Feet and hem visible, nothing cropped at the top or bottom.
- Background truly white, with no grey floor or shadow.
- No text anywhere. Ask Gemini explicitly for "no text on screen".
