# "One Rule, Five Looks": Arjun lookbook reel

**Format:** 9:16 Reel, about 45 seconds. This is the follow-up to *Arjun's Outfit Glowup*, with the
same character, studio and badge style.

**Idea:** take the trend from the mood board (`studio/references/outfits.md`) and show it fitted to
one real body and one real colouring. The fit is long wide trousers, a short or tucked top and
leather shoes. That is our pitch: we take the trend you saw on Pinterest and fit it to you.

**Why it works for Arjun:**
- He's an inverted triangle, so wide, full-length trousers balance his shoulders. That makes the
  rule a real lesson, not just a vibe.
- His skin is warm, so every look is a **warm-friendly version** of a reference. Navy replaces black,
  ivory replaces stark white, and cognac leather appears throughout.
- One pair of cognac loafers appears in three of the five looks, so it also teaches a small capsule
  wardrobe.

| Look | Occasion | Built from refs | Outfit |
|---|---|---|---|
| 1 | Weekend | R7, R1 | Navy linen popover · light-wash straight jeans · cognac loafers · tortoiseshell sunglasses in placket |
| 2 | Office | R6, R15, R26 | Camel crewneck, white tee hem showing · taupe pleated wide trousers · cognac loafers |
| 3 | Date night | R8, R5 | Pale blue shirt, 3 buttons open, tucked · navy pinstripe wide trousers · dark brown belt and loafers |
| 4 | Wedding | R31, R30 | Ivory bandhgala · deep red rose brooch · black flared trousers · black loafers |
| 5 | Summer | R25, R21 | Off-white slub henley · mid-wash flared jeans · cognac loafers · brown suede shoulder bag |

---

## Workflow

1. **Reuse from the first shoot:** `img0_reference.png` (Arjun reference sheet) and `img1_before.png`
   (tight tee and skinny jeans).
2. **ChatGPT:** attach `img0_reference.png` to every prompt and start with the consistency block for
   that shot type. Make every image **1024×1536 portrait**. **No text, logos or brand marks.**
3. **Gemini / Veo:** image-to-video, 9:16, 5–6 s, ignore the generated audio. The rule morph uses a
   first and a last frame.
4. **Send everything back** named exactly as below. I'll edit it, add badges, captions and the grid,
   remove the watermark and verify the sync.

> **Keep the leg line honest.** In every look the trouser hem must touch or break on the shoe and the
> feet must be visible. If ChatGPT crops the feet or shortens the trousers, regenerate. The reel's
> whole point lives below the knee.

---

## 1 · ChatGPT image prompts

### Studio consistency block (IMG_R only)
```
Use the attached reference image of Arjun. Keep his face, skin tone, hair, beard, body proportions and height exactly the same. Photorealistic editorial photo, 9:16 portrait. Full-length, head to toe, feet visible, subject centred, standing straight facing camera, arms relaxed. Seamless light warm-grey studio backdrop (#E6E4E1) with a soft floor shadow, soft even key light from front-left, 50mm lens look at chest height, sharp focus, natural skin texture. No text, no logos, no graphics, no watermark.
```

### Street consistency block (LOOK1–LOOK5)
```
Use the attached reference image of Arjun. Keep his face, skin tone, hair, beard, body proportions and height exactly the same. Photorealistic candid street-style photo, 9:16 portrait, full length from head to toe with both shoes fully visible, Arjun centred and walking slowly towards the camera mid-stride. Natural light, shot at hip height on a 35mm lens, shallow depth of field, slight film grain, colours true to life, not posed like a catalogue. The trousers are full length: the hem falls on and slightly over the shoes. No text, no logos, no brand marks, no readable signage, no watermark.
```

### IMG_R: the rule, "after" (`imgR_rule.png`)
Attach `img0_reference.png` **and** `img1_before.png`.
```
[Studio consistency block]
Identical to the attached before image (same pose, framing, light and face) except the clothes: a plain white heavyweight crew-neck T-shirt tucked into high-rise ecru wide-leg trousers with a single pleat, the hem breaking over the shoes; brown leather belt; cognac leather penny loafers. His legs now look long and his shoulders balanced. Neutral, slightly confident expression.
```

### LOOK1: Weekend (`look1_weekend.png`)
```
[Street consistency block]
Setting: a sunny old-town lane with a warm ochre plaster wall and a dark green wooden door, late-morning sun.
Outfit: navy linen popover shirt with a short button placket open at the neck, long sleeves loosely pushed to the forearm, untucked but short, ending at the hip; light-wash straight-leg jeans, full length; cognac leather penny loafers; a thin gold chain; tortoiseshell sunglasses hooked into the shirt placket. Relaxed half-smile.
```

### LOOK2: Office (`look2_office.png`)
```
[Street consistency block]
Setting: outside a modern office building in Mumbai or Bengaluru, pale stone wall and steel railing, soft overcast morning light.
Outfit: camel brushed-wool crew-neck sweater with a crisp white T-shirt hem showing 2 cm below it; taupe double-pleated wide-leg trousers, high rise, hem breaking over the shoes; cognac leather penny loafers; brown leather-strap watch; a tan leather tote on one shoulder. Calm, focused expression.
```

### LOOK3: Date night (`look3_date.png`)
```
[Street consistency block]
Setting: a city street at blue hour beside a dark parked car and warm restaurant windows, soft glowing bokeh.
Outfit: pale blue cotton shirt with the top three buttons open and sleeves rolled twice, tucked in; navy pinstripe high-rise wide-leg trousers, hem over the shoes; dark brown leather belt with a simple silver buckle; dark brown leather loafers; dark sunglasses held in one hand. Confident, easy smile.
```

### LOOK4: Wedding (`look4_wedding.png`)
```
[Street consistency block, but replace "street-style" with "event", and "walking" with "standing, one hand in pocket"]
Setting: a heritage haveli courtyard with carved arches and warm evening lamps.
Outfit: ivory (not stark white) short bandhgala jacket with a mandarin collar and tonal buttons; a single deep red rose brooch on the left chest; black flared trousers, full length, hem over the shoes; polished black leather loafers; black leather-strap watch. Warm, proud smile.
```

### LOOK5: Summer (`look5_summer.png`)
```
[Street consistency block]
Setting: a bright seaside promenade in Goa, whitewashed wall, strong late-afternoon sun and hard shadows.
Outfit: off-white slub-cotton long-sleeve henley, boxy and ending at the belt, two buttons open, sleeves pushed up; mid-wash flared jeans, full length; cognac leather penny loafers; a dark brown suede shoulder bag; red-brown tinted sunglasses on. Relaxed, mid-laugh.
```

*If his face drifts in any look, re-attach `img0_reference.png` and add "his face must match the reference exactly".*

---

## 2 · Gemini / Veo animation prompts

| File | Input | Length | Prompt |
|---|---|---|---|
| `vR_rule_morph.mp4` | `img1_before` → `imgR_rule` (first + last frame) | 4 s | *Locked-off static camera. The man stands still while his outfit smoothly re-tailors: the tight black tee becomes a white tee tucked into his waistband, and his black skinny jeans widen and lengthen into ecru wide-leg trousers that fall over his shoes, which become brown loafers. Face and pose identical. Clean, satisfying fabric transformation. No text.* |
| `vL1_weekend.mp4` | `look1_weekend` | 5 s | *Slow backwards tracking shot as he walks towards camera down the sunny lane; the light jeans swing naturally with each step; he touches the sunglasses in his placket and smiles. Realistic motion. No text, no readable signage.* |
| `vL2_office.mp4` | `look2_office` | 5 s | *Static camera, slight push-in. He walks two steps towards camera, then tugs the sweater hem down over the white tee and adjusts the tote strap. The wide trousers move softly. No text.* |
| `vL3_date.mp4` | `look3_date` | 5 s | *Slow orbit from front to three-quarter. He rolls one sleeve a little higher, then puts on the sunglasses and looks into camera. City bokeh flickers warmly behind. No text, no readable signage.* |
| `vL4_wedding.mp4` | `look4_wedding` | 5 s | *Gentle push-in. He straightens the rose brooch, buttons the top of the bandhgala and smiles towards someone off-camera. Lamp light flickers softly. No text.* |
| `vL5_summer.mp4` | `look5_summer` | 5 s | *Handheld feel. He walks past the camera along the promenade, the flared jeans flaring with each stride, sea breeze moving the henley; he laughs and glances back. No text.* |

*Wide trousers must swing with the walk, not stay stiff. If they look rigid, add: "the fabric of the wide trousers moves and flares naturally with each step".*

---

## 3 · Shot list and voiceover (about 45 s)

| Time | Picture | Voiceover | On-screen text (added in edit) |
|---|---|---|---|
| 0.0–1.6 | Quick flash of all 5 looks, 0.3 s each | "One rule. Five outfits." | **ONE RULE · FIVE LOOKS** |
| 1.6–4.5 | `img1_before` with shoulder and ankle measuring lines | "Arjun's shoulders are broad, so skinny jeans make him look top-heavy." | **TOP-HEAVY ✗** |
| 4.5–9.0 | `vR_rule_morph` | "The rule: long leg line. Wide trousers, hem on the shoe, top tucked in." | Title card **THE RULE** → tiles ✗ SKINNY / ✓ LONG LINE |
| 9.0–15.0 | `vL1_weekend` | "Weekend. Navy linen, light denim, cognac loafers. Navy, not black: black drains warm skin." | **01 WEEKEND** · swatches navy / light denim / cognac |
| 15.0–21.0 | `vL2_office` | "Office. Camel crewneck, a white tee peeking out, pleated taupe trousers." | **02 OFFICE** · swatches camel / white / taupe |
| 21.0–27.0 | `vL3_date` | "Date night. Pale blue shirt, three buttons open, navy pinstripes." | **03 DATE NIGHT** |
| 27.0–33.5 | `vL4_wedding` | "Wedding. Ivory bandhgala, black flares, one red rose. Ivory, never stark white." | **04 WEDDING** · ✗ STARK WHITE / ✓ IVORY |
| 33.5–39.0 | `vL5_summer` | "Summer. Slub henley, flared jeans, and the same cognac loafers. Third look, one pair." | **05 SUMMER** · loafer icon "×3" |
| 39.0–42.5 | 5-up grid of all looks, each tile sliding in | "Five looks, one rule, built for his frame and his colours." | **BUILT FOR HIS FRAME** |
| 42.5–45.0 | End card | "Get yours. Link in bio." | Brand name + "Your personal style system" |

**Voiceover as one take** (for Chatterbox or your own recording):
```
One rule. Five outfits.
Arjun's shoulders are broad, so skinny jeans make him look top-heavy.
The rule: long leg line. Wide trousers, hem on the shoe, top tucked in.
Weekend. Navy linen, light denim, cognac loafers. Navy, not black: black drains warm skin.
Office. Camel crewneck, a white tee peeking out, pleated taupe trousers.
Date night. Pale blue shirt, three buttons open, navy pinstripes.
Wedding. Ivory bandhgala, black flares, one red rose. Ivory, never stark white.
Summer. Slub henley, flared jeans, and the same cognac loafers. Third look, one pair.
Five looks, one rule, built for his frame and his colours.
Get yours. Link in bio.
```

**Caption idea:** "Saw the wide-leg trend on Pinterest? Here's how it works on a broad-shouldered,
warm-skinned guy. Save this for your next shopping trip."

**Music:** a warm, unhurried lo-fi or bossa beat around 95 BPM, with cuts on the beat at each look
change.
