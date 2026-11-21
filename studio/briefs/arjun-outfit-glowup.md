# "Arjun's Outfit Glowup" — production script

**Format:** 9:16 Reel, about 40 seconds. Same visual language as *Kabir's Glowup*: light-grey seamless studio, serif italic title, small mono badges (✗ red / ✓ green), before/after thumbnail tiles, black-and-white title cards, and a warm café payoff shot.

**Why Arjun:** he's the character in the **sample report on the website** (`/sample`): athletic, broad shoulders, warm undertone, smart-casual. Anyone who taps through sees the same person's full report, so the video and the site tell one story.

**The lesson (it matches the app's rules for this frame and palette):**
1. **Fit.** Broad shoulders plus off-the-rack tees means pulling at the chest and ballooning at the waist. The fix is an athletic fit.
2. **Balance.** Skinny jeans make an inverted-triangle frame look top-heavy. The fix is straight-leg trousers in a lighter colour.
3. **Colour.** A warm undertone is drained by black and icy grey. The fix is olive, camel and terracotta.

---

## Workflow

1. **ChatGPT (images).** Generate the character reference first. Then **attach that reference to every following prompt** and start each prompt with the *Consistency block* below. Generate all images at **1024×1536 (portrait)**.
2. **Gemini / Veo (animation).** Use image-to-video. For transformations, use **first frame + last frame** (both images). Generate at 9:16, 4–8 seconds each, and turn off or ignore generated audio.
3. **Voiceover.** Record or generate the voiceover lines below as one take.
4. **Edit (send everything back to me).** I'll assemble it the way I edited Kabir v3: badges, tiles, swatches, captions, title cards, hook, end card, loudness to −14 LUFS. Name the files exactly as listed (`img1_before.png`, `v2_fit_morph.mp4`, …).

> **Rules that keep AI images usable**
> - **No text, logos or graphics in any image.** Image models garble text; all labels are added in the edit.
> - **Same camera every time:** full length, head to toe with feet visible, straight-on at chest height, 50 mm look, same distance, subject centred, same pose.
> - **Change only what the step changes.** If the trousers change, the face, hair, pose, lighting and shirt must not.
> - Keep every "after" image **plausible, not glamorised**. The point is "same guy, better clothes", not a different, fitter man.

---

## 1 · ChatGPT image prompts

### Consistency block (paste at the top of every prompt after IMG0)
```
Use the attached reference image of Arjun. Keep his face, skin tone, hair, beard, body proportions and height exactly the same. Photorealistic editorial photo, 9:16 portrait. Full-length, head to toe, feet visible, subject centred, standing straight facing camera, arms relaxed slightly away from the body. Seamless light warm-grey studio backdrop (#E6E4E1) with a soft floor shadow, soft even key light from front-left, gentle fill, 50mm lens look at chest height, sharp focus, natural skin texture. No text, no logos, no graphics, no watermark.
```

### IMG0 — character reference (`img0_reference.png`)
```
Photorealistic character reference sheet of one man, three views side by side on a seamless light warm-grey studio backdrop: front full-length, three-quarter full-length, and a front head-and-shoulders close-up. Arjun: Indian man, 28 years old, 175 cm, athletic build with clearly broad shoulders and chest and a narrow waist, flat stomach. Warm medium/wheatish skin with a golden undertone. Black short textured hair with a side part, short neat full beard, dark brown eyes, oval face. Wearing a plain fitted black crew-neck T-shirt and black skinny jeans, white chunky sneakers. Neutral, friendly expression. Soft even studio lighting, natural skin texture, sharp focus. No text, no logos.
```
*Pick the best result and use it as the reference for everything else. If the face drifts in later images, re-attach this one.*

### IMG1 — BEFORE (`img1_before.png`)
```
[Consistency block]
Arjun wears: a plain black crew-neck T-shirt one size too tight in the chest — fabric visibly pulling across the chest and shoulders with stress wrinkles, while it hangs loose and boxy at the waist; black skinny jeans, very tight on the legs and narrow at the ankle; chunky white sneakers. Expression: neutral, slightly unsure. The overall look is top-heavy.
```

### IMG1b — BEFORE close-up, shoulders (`img1b_pulling_closeup.png`)
```
[Consistency block, but framing: close-up crop from collarbone to mid-torso, straight on]
The same too-tight black crew-neck T-shirt: horizontal stress lines pulling across the chest, shoulder seams sitting past the shoulder bone, loose fabric bunching at the waist.
```

### IMG2 — FIX 1: athletic fit (`img2_fit.png`)
```
[Consistency block]
Identical to the previous image (same black skinny jeans, same chunky white sneakers, same pose, same lighting) except the T-shirt: now a plain black crew-neck athletic-fit T-shirt — shoulder seams exactly at the shoulder bone, room in the chest with no pulling, tapered cleanly at the waist, hem at the belt line. Expression: neutral.
```
*Attach IMG1 as well and say "identical to the attached before image except…"; it helps keep everything else locked.*

### IMG3 — FIX 2: straight-leg chinos (`img3_balance.png`)
```
[Consistency block]
Identical to the attached previous image (same black athletic-fit T-shirt, same pose, same lighting) except the trousers and shoes: straight-leg khaki chinos (#B9A37E) with a 18 cm hem opening and a slight break, and simple tan suede derby shoes. The lower half now looks substantial and balances the broad shoulders. Expression: neutral, slightly more confident.
```

### IMG4a / IMG4b — FIX 3: colour test, head-and-shoulders (`img4a_black.png`, `img4b_olive.png`)
```
[Consistency block, but framing: head-and-shoulders close-up, straight on, same light]
IMG4a: Arjun in a plain black crew-neck T-shirt. Keep the lighting slightly cool-neutral so the black sits flat against his skin.
IMG4b: identical framing and light; Arjun in a stone-coloured crew-neck T-shirt (#CFC3AD) under an open olive cotton overshirt (#708238). His warm skin looks healthier and more even against the olive.
```
*Don't exaggerate the difference by changing the skin itself; only the clothes change. The colour does the work.*

### IMG5 — FINAL LOOK, studio (`img5_after_studio.png`)
```
[Consistency block]
Identical to the attached IMG3 pose, framing and lighting, now wearing the full final outfit: stone crew-neck T-shirt (#CFC3AD), open unstructured olive cotton overshirt (#708238) with sleeves rolled twice, straight-leg khaki chinos (#B9A37E), tan suede derby shoes, brown leather watch. Relaxed, confident half-smile.
```

### IMG6 — PAYOFF lifestyle (`img6_after_cafe.png`)
```
Use the attached reference image of Arjun and the attached IMG5 outfit. Keep his face, hair, beard, build and the exact outfit identical. Photorealistic editorial street photo, 9:16 portrait, full length, Arjun walking towards the camera on a quiet tree-lined Indian city street outside a café in warm late-afternoon light, shallow depth of field with soft background bokeh, natural mid-stride, relaxed smile. 50mm lens look. No text, no logos, no readable signage.
```

---

## 2 · Gemini / Veo animation prompts

Use 9:16, static camera unless stated, and **no added text**. For first/last-frame clips, upload both images.

| File | Input | Length | Prompt |
|---|---|---|---|
| `v1_before_idle.mp4` | IMG1 (first frame) | 4s | *Locked-off static camera. The man stands naturally and breathes, shifting his weight slightly from one foot to the other and glancing down at his T-shirt, tugging the hem once. Studio lighting unchanged. Subtle, realistic motion. No camera movement, no text.* |
| `v2_fit_morph.mp4` | IMG1 → IMG2 (first + last frame) | 4s | *Locked-off static camera. The man stays still in the same pose while his black T-shirt smoothly re-tailors itself: the pulling across the chest relaxes, the shoulder seams slide to his shoulder bones, the loose fabric at the waist tapers in. Clean, satisfying fabric transformation, like an invisible tailor. Nothing else changes. No text.* |
| `v3_balance_morph.mp4` | IMG2 → IMG3 | 4s | *Locked-off static camera. The man stands still while his black skinny jeans smoothly transform into straight-leg khaki chinos, the fabric widening and changing colour from the waist down to the hem, and his white chunky sneakers transform into tan suede derby shoes. Face, T-shirt and pose stay identical. No text.* |
| `v4_colour_morph.mp4` | IMG4a → IMG4b | 4s | *Locked-off static head-and-shoulders shot. The black T-shirt smoothly shifts colour to stone, and an olive overshirt slides on over his shoulders. As it does, the light reflected onto his face warms slightly and he gives a small relaxed smile. Face identity unchanged. No text.* |
| `v5_final_turn.mp4` | IMG5 (first frame) | 5s | *Slow push-in. The man in the olive overshirt adjusts his rolled sleeve, then turns slightly to a three-quarter angle and back to camera with a confident half-smile. Studio light, realistic fabric movement. No text.* |
| `v6_payoff_walk.mp4` | IMG6 (first frame) | 5s | *Handheld-feel tracking shot moving slowly backwards as the man walks towards camera on a warm, sunlit café street, overshirt moving naturally in a light breeze, soft bokeh, relaxed smile, glances off-camera and back. No text, no readable signage.* |

*If a morph distorts the face, regenerate with "keep the face completely still and unchanged" added, or shorten to 3s.*

---

## 3 · Shot list, voiceover and on-screen text (about 40s)

Each scene gives its time, picture and voiceover, then the text I'll overlay in the edit.

**HOOK (0.0–0.9s)**
- **Picture:** IMG6 still.
- **Voiceover:** none.
- **On screen:** "Same guy." / "3 outfit fixes. Watch." with an **AFTER** pill.

**INTRO (0.9–5s)**
- **Picture:** `v1_before_idle`.
- **Voiceover:** "Arjun has a great build. So why do his clothes look off?"
- **On screen:** title *Arjun's Outfit Glowup*; small "ARJUN, AI-GENERATED CHARACTER".

**DIAGNOSIS (5–7s)**
- **Picture:** IMG1 with shoulder and waist measuring lines.
- **Voiceover:** "He's an inverted triangle: broad shoulders, narrow waist."
- **On screen:** **INVERTED TRIANGLE** badge; lines that widen at the shoulder.

**Fix 1 — fit (7–15s)**

**Title card (7–8s)**
- **Picture:** black-and-white title card.
- **On screen:** "FIRST" / **FIT**

**The problem (8–10.5s)**
- **Picture:** IMG1b close-up.
- **Voiceover:** "First, fit. Regular tees pull at his chest and balloon at the waist."
- **On screen:** **PULLING ✗** badge.

**The fix (10.5–15s)**
- **Picture:** `v2_fit_morph`.
- **Voiceover:** "Go athletic fit. It follows his shape."
- **On screen:** tiles ✗ REGULAR FIT / ✓ ATHLETIC FIT.

**Fix 2 — balance (15–24s)**

**Title card (15–16s)**
- **Picture:** black-and-white title card.
- **On screen:** "SECOND" / **BALANCE**

**The problem (16–18.5s)**
- **Picture:** IMG2 with the legs highlighted.
- **Voiceover:** "Second, trousers. Skinny jeans make his shoulders look huge."
- **On screen:** **TOP-HEAVY ✗**; outline narrowing at the ankles.

**The fix (18.5–24s)**
- **Picture:** `v3_balance_morph`.
- **Voiceover:** "Straight-leg chinos in a lighter colour balance him out."
- **On screen:** **BALANCED ✓**; tiles ✗ SKINNY / ✓ STRAIGHT LEG.

**Fix 3 — colour (24–34s)**

**Title card (24–25s)**
- **Picture:** black-and-white title card.
- **On screen:** "THIRD" / **COLOUR**

**The problem (25–28s)**
- **Picture:** IMG4a.
- **Voiceover:** "And finally, colour. Arjun has a warm undertone. Black and grey wash him out."
- **On screen:** swatches ✗ Jet black, Icy grey.

**The fix (28–34s)**
- **Picture:** `v4_colour_morph`.
- **Voiceover:** "Olive, camel and terracotta make his skin glow."
- **On screen:** swatches ✓ Olive, Camel, Terracotta, Warm teal; **WARM UNDERTONE ✓**.

**PAYOFF (34–39s)**
- **Picture:** `v5_final_turn`, then `v6_payoff_walk`.
- **Voiceover:** "Same guy. Just clothes that work with him. Follow for more style tips."
- **On screen:** title *Arjun's Outfit Glowup*.

**END CARD (39–42s)**
- **Picture:** blurred last frame.
- **On screen:**
  - "What should *you* be wearing?"
  - "Your frame, colours and fits from two photos. Free preview."
  - **Link in bio →**
  - "Arjun is an AI-generated character"

**Voiceover direction:** calm, confident and conversational, not salesy, at about 150 words a minute — the same pace as Kabir's voiceover (measured with faster-whisper). The script is about 93 words, so roughly 37 seconds of speech. Use short pauses (about 0.3s) between scenes; I'll tighten any longer gaps.

**Narration options:** record it yourself, or I can generate it with Chatterbox (natural voice, about 80s per line on this server and much faster on a Mac) or Kokoro (fast backup). Either way I run faster-whisper on it so every caption, badge and transformation lands on its spoken word.

---

## 4 · Caption for the post (draft)

> Arjun's clothes weren't the wrong *style* — they were the wrong *shape and colour* for him. 3 fixes:
> 1️⃣ Athletic-fit tops for broad shoulders
> 2️⃣ Straight-leg trousers to balance a V-shape
> 3️⃣ Warm colours for a warm undertone
>
> Want to know your frame and colours? Free preview — link in bio.
>
> *Arjun is an AI-generated character.*
> #mensstyle #indianmen #menswear #styletips #outfitideas

When posting, turn on Instagram's **"AI info"** label as well — the on-screen disclosure alone isn't enough for the platform.
