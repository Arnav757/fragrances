# "Arjun's Fit" series: one outfit per reel

**Format:** a series of 9:16 Reels, **one fit per reel**, each about 20 seconds. Every episode has
the same shape, so the series feels branded. Each fit is a warm-skin, broad-shoulder version of the
mood board (`studio/references/outfits.md`).

**Series rule (said in every episode):** a long leg line. Wide trousers, the hem on the shoe and the
top tucked in or ending at the belt. It balances Arjun's broad shoulders.

**Suggested posting order:** 1 Date night → 2 Weekend → 3 Office → 4 Summer → 5 Wedding. Lead with
the most aspirational looks and save the wedding for wedding season.

---

## Episode shape (about 20 s)

| Time | Beat | Picture |
|---|---|---|
| 0.0–1.5 | **Hook:** the finished fit | `epN_c_location` still, title "ARJUN'S {OCCASION} FIT" |
| 1.5–5.0 | **The mistake:** what most guys wear | `epN_a_before` with ✗ badges |
| 5.0–9.5 | **The fix:** outfit morphs | `vN_morph` (A → B) |
| 9.5–15.0 | **The breakdown:** piece by piece | `vN_detail` with labelled callouts and colour swatches |
| 15.0–19.0 | **The payoff:** in the real world | `vN_walk` |
| 19.0–21.0 | **End card** | Brand + "Your personal style system · link in bio" |

**Per episode you generate 3 images and 3 clips:**
- **A:** the before, in the studio
- **B:** the after, in the studio (same pose as A)
- **C:** the after, on location
- **Clips:** the A→B morph, a detail move on B, and a walk on C

---

## Shared blocks

Attach `img0_reference.png` (the Arjun reference sheet from the first shoot) to **every** image.
Make every image **1024×1536 portrait**. **No text, logos or brand marks.** Feet must be visible and
the trouser hem must touch the shoe. If either is wrong, regenerate.

**Studio block (A and B images)**
```
Use the attached reference image of Arjun. Keep his face, skin tone, hair, beard, body proportions and height exactly the same. Photorealistic editorial photo, 9:16 portrait. Full-length, head to toe, both shoes fully visible, subject centred, standing straight facing camera, arms relaxed. Seamless light warm-grey studio backdrop (#E6E4E1) with a soft floor shadow, soft even key light from front-left, 50mm lens look at chest height, sharp focus, natural skin texture. No text, no logos, no graphics, no watermark.
```
For **B**, also attach that episode's A image and start with: *"Identical to the attached before
image (same pose, framing, light and face) except the clothes:"*

**Location block (C images)**
```
Use the attached reference image of Arjun. Keep his face, skin tone, hair, beard, body proportions and height exactly the same. Photorealistic candid street-style photo, 9:16 portrait, full length from head to toe with both shoes fully visible, Arjun centred and walking slowly towards the camera mid-stride. Natural light, shot at hip height on a 35mm lens, shallow depth of field, slight film grain, true-to-life colour. The trousers are full length; the hem falls on and slightly over the shoes. No text, no logos, no brand marks, no readable signage, no watermark.
```
For **C**, also attach that episode's B image and say: *"wearing exactly the outfit in the second
attached image"*.

**Gemini settings:** image-to-video, 9:16, ignore the generated audio, no text. The morph uses a
first and a last frame. If the wide trousers look stiff, add: *"the fabric of the wide trousers moves
and swings naturally"*.

---

## Episode 1 · Date night  (refs R8, R5)

**The mistake:** all black (fully buttoned black shirt, black skinny jeans, black sneakers). The
black drains his warm skin, and the skinny leg makes him top-heavy.

**ep1_a_before.png**
```
[Studio block]
Arjun wears: a black slim-fit shirt buttoned all the way to the collar, untucked; black skinny jeans tight to the ankle; black canvas sneakers. Neutral, slightly flat expression; the black sits harshly against his skin.
```
**ep1_b_after.png**
```
[Studio block] Identical to the attached before image (same pose, framing, light and face) except the clothes: pale blue cotton shirt with the top three buttons open and sleeves rolled twice, tucked in; navy pinstripe high-rise wide-leg trousers with the hem breaking over the shoes; dark brown leather belt with a simple silver buckle; dark brown leather penny loafers; thin gold chain. Confident, easy expression.
```
**ep1_c_location.png**
```
[Location block] wearing exactly the outfit in the second attached image.
Setting: a city street at blue hour beside a dark parked car and warm restaurant windows, glowing bokeh. He holds dark sunglasses in one hand. Easy smile.
```
**Optional extras: these make the breakdown stronger (about 25 s total)**

**ep1_d_colour_black.png / ep1_e_colour_blue.png:** proof of the colour claim. Use the same framing for both.
```
[Studio block, but framing: head-and-shoulders close-up, straight on, same light]
D: Arjun in the black shirt buttoned to the collar. Keep the light slightly cool-neutral so the black sits flat and harsh against his skin.
E: identical framing and light; Arjun in the pale blue shirt with the top three buttons open and a thin gold chain. Only the clothes change, not his skin.
```
**ep1_f_hem.png:** proof of the leg-line rule.
```
[Studio block, but framing: close-up from the knee down, straight on, same floor and light]
The navy pinstripe wide trouser hem falling over a dark brown leather penny loafer, with a soft single break at the front; the fabric drapes straight with no bunching.
```
- `v1_colour.mp4` (D → E, first + last frame, 3 s): *Locked-off head-and-shoulders. The black shirt lightens to pale blue and the collar falls open; his skin looks warmer and more even. Face identity unchanged.*

These slot in after "On warm skin, black looks harsh" (D → E), and after "navy pinstripe wide
trousers" (F, 1.5 s).

**Clips**
- `v1_morph.mp4` (A → B, 4 s): *Locked-off static camera. He stands still while the outfit smoothly re-tailors: the black shirt lightens to pale blue, opens at the collar, tucks in and its sleeves roll up; the skinny jeans widen and lengthen into navy pinstripe trousers falling over his shoes; the sneakers become brown loafers. Face and pose identical.*
- `v1_detail.mp4` (B, 5 s): *Slow push-in from full length to waist. He rolls one sleeve a little higher, then runs a thumb along the belt. Realistic fabric.*
- `v1_walk.mp4` (C, 5 s): *Slow backwards tracking shot as he walks towards camera; the wide trousers swing with each step; he puts on the sunglasses and looks into the lens.*

**Voiceover**
```
Arjun's date night fit.
Most guys go all black. On warm skin, black looks harsh, and skinny jeans make his shoulders look huge.
So: pale blue shirt, three buttons open, sleeves rolled. Tucked into navy pinstripe wide trousers.
Brown belt, brown loafers, nothing black near his face.
Long leg line, balanced shoulders. Date ready.
```
**On screen:** ✗ ALL BLACK · ✗ SKINNY → callouts PALE BLUE SHIRT / NAVY PINSTRIPE / BROWN LEATHER · swatches pale blue, navy, brown.

---

## Episode 2 · Weekend  (refs R7, R1)

**The mistake:** the tight black tee and skinny jeans from the first reel. **Reuse
`img1_before.png` as ep2_a.**

**ep2_b_after.png**
```
[Studio block] Identical to the attached before image (same pose, framing, light and face) except the clothes: navy linen popover shirt with a short button placket open at the neck, long sleeves loosely pushed to the forearm, short hem ending at the hip; light-wash straight-leg jeans, full length; cognac leather penny loafers; thin gold chain; tortoiseshell sunglasses hooked into the placket. Relaxed half-smile.
```
**ep2_c_location.png**
```
[Location block] wearing exactly the outfit in the second attached image.
Setting: a sunny old-town lane with a warm ochre plaster wall and a dark green wooden door, late-morning sun. Relaxed half-smile.
```
**Clips**
- `v2_morph.mp4` (A → B, 4 s): *Locked-off static camera. The tight black tee loosens into a navy linen popover with sleeves pushed up; the skinny jeans widen and lighten into light-wash straight jeans that fall over his shoes; the sneakers become cognac loafers; sunglasses appear in the placket. Face and pose identical.*
- `v2_detail.mp4` (B, 5 s): *Slow push-in. He takes the sunglasses from the placket, looks at them, and hooks them back. Linen creases move naturally.*
- `v2_walk.mp4` (C, 5 s): *Slow backwards tracking shot down the sunny lane; the jeans swing with each step; he glances at the door and back to camera, smiling.*

**Voiceover**
```
Arjun's weekend fit.
Tight tee, skinny jeans. It's the most common weekend look, and it makes broad shoulders look top-heavy.
Swap to a navy linen popover. Navy, not black, because it flatters warm skin.
Light straight jeans that reach the shoe, cognac loafers, sunglasses in the placket.
Easy, and it balances his frame.
```
**On screen:** ✗ TOO TIGHT · ✗ SKINNY → NAVY LINEN / LIGHT STRAIGHT DENIM / COGNAC LOAFERS.

---

## Episode 3 · Office  (refs R6, R15, R26)

**The mistake:** a shiny pink slim-fit shirt, cropped skinny chinos above the ankle and pointed
shoes. It is too tight up top, too short below.

**ep3_a_before.png**
```
[Studio block]
Arjun wears: a shiny pale pink slim-fit stretch shirt pulling across the chest, tucked into tight slim grey chinos cropped above the ankle showing bare ankles; long pointed black formal shoes. Stiff, uncomfortable expression.
```
**ep3_b_after.png**
```
[Studio block] Identical to the attached before image (same pose, framing, light and face) except the clothes: camel brushed-wool crew-neck sweater with a crisp white T-shirt hem showing 2 cm below it; taupe double-pleated high-rise wide-leg trousers with the hem breaking over the shoes; cognac leather penny loafers; brown leather-strap watch. Calm, focused expression.
```
**ep3_c_location.png**
```
[Location block] wearing exactly the outfit in the second attached image.
Setting: outside a modern office building in Bengaluru, pale stone wall and steel railing, soft overcast morning light; a tan leather tote on one shoulder. Calm, focused.
```
**Clips**
- `v3_morph.mp4` (A → B, 4 s): *Locked-off static camera. The shiny pink shirt softens into a camel crewneck sweater with a white tee hem showing; the cropped grey chinos lengthen and widen into pleated taupe trousers covering his ankles; the pointed shoes become cognac loafers. Face and pose identical.*
- `v3_detail.mp4` (B, 5 s): *Slow push-in to the waist. He tugs the sweater hem down so the white tee shows evenly, then checks his watch.*
- `v3_walk.mp4` (C, 5 s): *He walks towards camera past the railing, adjusting the tote strap; the pleated trousers move softly.*

**Voiceover**
```
Arjun's office fit.
Shiny slim shirt, cropped chinos, pointy shoes. Too tight on top, too short below.
Instead: a camel crewneck with a white tee just peeking out.
Pleated taupe trousers that reach the shoe. Cognac loafers.
Smart, warm, and his shoulders finally look in proportion.
```
**On screen:** ✗ SHINY · ✗ CROPPED → CAMEL KNIT / WHITE TEE HEM / PLEATED TAUPE.

---

## Episode 4 · Summer  (refs R25, R21)

**The mistake:** a tight polyester polo, cropped skinny chinos and chunky sneakers. It is clingy,
sweaty-looking and short in the leg.

**ep4_a_before.png**
```
[Studio block]
Arjun wears: a tight bright royal-blue polyester polo shirt clinging to the chest; beige skinny chinos rolled up above the ankle; chunky white running sneakers with no socks visible. Squinting, warm, uncomfortable expression.
```
**ep4_b_after.png**
```
[Studio block] Identical to the attached before image (same pose, framing, light and face) except the clothes: off-white slub-cotton long-sleeve henley, boxy and ending at the belt, two buttons open, sleeves pushed up; mid-wash flared jeans, full length, hem over the shoes; cognac leather penny loafers; dark brown suede shoulder bag; red-brown tinted sunglasses. Relaxed, mid-laugh.
```
**ep4_c_location.png**
```
[Location block] wearing exactly the outfit in the second attached image.
Setting: a bright seaside promenade in Goa, whitewashed wall, strong late-afternoon sun and hard shadows. Relaxed, laughing.
```
**Clips**
- `v4_morph.mp4` (A → B, 4 s): *Locked-off static camera. The tight blue polo relaxes into a boxy off-white henley with sleeves pushed up; the rolled beige chinos unroll and widen into mid-wash flared jeans over his shoes; the running shoes become cognac loafers; sunglasses appear. Face and pose identical.*
- `v4_detail.mp4` (B, 5 s): *Slow push-in. He pushes a sleeve up his forearm, then lifts the sunglasses onto his head and grins.*
- `v4_walk.mp4` (C, 5 s): *Handheld feel. He walks past camera along the promenade, the flared jeans flaring with each stride and the henley moving in the sea breeze; he laughs and glances back.*

**Voiceover**
```
Arjun's summer fit.
Tight polo, rolled-up chinos, gym shoes. It clings, and it cuts his legs short.
Swap to a slub henley. Boxy, breathable, off-white, never stark white on warm skin.
Flared jeans to the shoe, cognac loafers, a suede bag.
Relaxed, but still a long leg line.
```
**On screen:** ✗ CLINGY · ✗ CROPPED → SLUB HENLEY / FLARED DENIM / COGNAC LOAFERS.

---

## Episode 5 · Wedding  (refs R31, R30)

**The mistake:** a stark white, long, shiny kurta with a tight churidar. The white washes out warm
skin, and the tight churidar makes him top-heavy again.

**ep5_a_before.png**
```
[Studio block]
Arjun wears: a stark bright-white shiny silk kurta reaching below the knee; tight white churidar bunched at the ankles; white embellished mojris. The bright white makes his face look flat and washed out. Neutral expression.
```
**ep5_b_after.png**
```
[Studio block] Identical to the attached before image (same pose, framing, light and face) except the clothes: ivory (not stark white) short bandhgala jacket with a mandarin collar and tonal buttons, ending at the hip; a single deep red rose brooch on the left chest; black flared trousers, full length, hem over the shoes; polished black leather loafers; black leather-strap watch. Warm, proud smile.
```
**ep5_c_location.png**
```
[Location block, but standing with one hand in pocket instead of walking] wearing exactly the outfit in the second attached image.
Setting: a heritage haveli courtyard with carved arches and warm evening lamps, marigold strings softly out of focus. Warm, proud smile.
```
**Clips**
- `v5_morph.mp4` (A → B, 4 s): *Locked-off static camera. The long white kurta shortens and tailors into an ivory bandhgala; the tight churidar widens and darkens into black flared trousers over his shoes; the mojris become black loafers; a red rose blooms on his chest. Face and pose identical.*
- `v5_detail.mp4` (B, 5 s): *Slow push-in to chest height. He straightens the rose brooch and fastens the top button of the collar.*
- `v5_walk.mp4` (C, 5 s): *Gentle push-in. He turns from the arches towards camera and smiles at someone off-screen; the lamp light flickers softly.*

**Voiceover**
```
Arjun's wedding fit.
Stark white, long kurta, tight churidar. White washes out warm skin, and the tight leg makes him top-heavy.
Go ivory instead. A short bandhgala, one red rose.
Black flared trousers to the shoe.
Ivory, never stark white. And that long leg line, even at a wedding.
```
**On screen:** ✗ STARK WHITE · ✗ TIGHT CHURIDAR → IVORY BANDHGALA / RED ROSE / BLACK FLARES · ✗ WHITE / ✓ IVORY swatch.

---

**Caption template:** "Arjun's {occasion} fit 🔁 Same guy, built for his frame and his colours.
Which fit next? Save for later."

**Music:** a warm, unhurried lo-fi or bossa beat around 95 BPM, with the morph landing on a beat.
