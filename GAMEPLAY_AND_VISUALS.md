# Forwarded Message Checker — Gameplay & Visual Guide

A shared-device team game for Grade 6 (3–4 players) about checking forwarded messages. Players build a simple "checker" rule, test it on eight messages, find what fooled it, repair it, and retest. The game runs fully offline from `index.html`.

---

## 1. Core idea

A forwarded message is a claim. The team decides how much four **clues** matter, and the checker adds up the clues that show a problem to get a **risk score**. The lesson: no single clue proves a message is fake, rules make mistakes, and even a good rule needs a human to double-check.

| Clue | Question it asks |
|---|---|
| **Source** | Is there a real source? Who sent it? |
| **Date** | Is it current? |
| **Image** (Reused image) | Has this picture appeared before? |
| **Urgent Words** (Urgent wording) | Is it pushing you to act fast? |

---

## 2. Players and roles

Everyone shares one device. The player whose turn it is glows orange in the top bar, and a **"Pass the device — your turn"** pop-up appears when control changes.

| Role | 3 players | 4 players | Leads these screens |
|---|---|---|---|
| Rule Builder | Player 1 | Player 1 | Setup, roles, intro, tutorial, points, thresholds, final |
| Message Tester | Player 2 | Player 2 | Message checks, batch summary, retest |
| Detective | Player 3 (Detective / Fixer) | Player 3 | Find the cause |
| Rule Fixer | — | Player 4 | Move a star |

---

## 3. Game flow (screen by screen)

The progress bar on the right counts **10 steps**. A 35-minute mission clock starts once setup is finished.

| # | Screen | What players do | Moves on when… |
|---|---|---|---|
| — | **Welcome** | Full-screen title art; tap **Start mission** | Start is tapped |
| 1 | **How many explorers?** | Tap the **3** or **4** card | A count is picked |
| 1 | **Pick an avatar** | Each explorer picks a robot and types a name (taken robots are greyed out) | Every explorer has a robot and a unique name |
| 1 | **Your team** | Check names, tap an avatar to change it, tap **Let's investigate** | All names are filled in and unique |
| 2 | **Meet your mission team** | Read each player's role | **Let's begin** |
| 2 | **Intro** | A worried parent receives "School closed today"; *"Can you build a checker this parent can trust?"* | **Let's build** |
| 3 | **4 clues. One checker.** | Meet the four clues (each card lights up as the narrator names it) | **Next: give each clue its weight** |
| 4 | **How much should each clue count?** | Share **20 points** across the clues with + / − (each clue 1–10) | All 20 points are used and every clue has at least 1 |
| 5 | **How careful should our checker be?** | Set two sliders on the 0–20 scale: where **Review** starts and where **Suspicious** starts, previewed on an example message | **Use these settings** |
| 6 | **Run the checker** (×8 messages) | Read the message on the phone, tap **Check message**; the four clues scan one by one and the score and verdict appear | **Next message** (the next one arrives on the same screen with a chime) |
| 7 | **You checked all the messages!** | See how many the rule got right and which were **Missed** or **False alarm** | **Fix the mistakes** (or **See final result** if perfect) |
| 8 | **What fooled the checker?** | Detective taps the clue behind the mistake (hints after wrong tries) | Right clue found, then **Fix this** |
| 9 | **Move a star** | Fixer moves **one** point from one clue to another. Each card previews "Safe move" or "Would break: …"; Undo is allowed | **Test again** |
| 9 | **Retest the batch** | All 8 messages are re-scored with the new rule | **Fix next mistake**, **Adjust again**, or **Finish with review** |
| 10 | **Final result** | "Your rule: X of 8 checked correctly", message grid, badges | **Finish**, then the **Mission complete** recap and **Play again** |

### Buttons appear only when needed
A screen's main button stays hidden until its step is complete, then pops in and the rail lines slide out from behind it.

---

## 4. Rules and scoring

- **Weights:** 20 points across four clues, 1–10 each.
- **Risk score:** the sum of the weights of every clue that shows a problem in the message (0–20).
- **Verdict** (defaults: review from 6, suspicious from 8; set on the thresholds screen):

| Score | Verdict |
|---|---|
| below the review line | **LIKELY OKAY** (green) |
| review line up to the suspicious line | **REVIEW** (amber) |
| suspicious line and above | **SUSPICIOUS** (red) |

- **Mistakes:**
  - **Miss:** a fake or misleading message scored *Likely okay*.
  - **False alarm:** a real message scored *Suspicious*.
  - *Review* on any message is never counted as wrong.
- **Fix loop:** each fix moves one point, and the total always stays 20. The retest shows newly fixed and newly broken messages.
- **Badges:** **Rule Tested** (always), **Cause Found** (found at least one cause), **Fix Checked** (at least one fix worked). Badges that weren't needed show as locked.

### The eight messages

| Message | Truth | Clues with a problem |
|---|---|---|
| School closed today | Real notice | Urgent |
| Free game console | Suspicious | Source, Urgent |
| A quiet claim to check | Unsupported claim | Source |
| Weather alert | Real advisory | Urgent |
| Science fair this Friday | Out of date | Date |
| Flooding in our town now | Misleading image | Image |
| Library hours updated | Real notice | none |
| One drink prevents every illness | Unsupported claim | Source, Urgent |

Balance: the real messages only use urgent words, so weighting **Urgent** too heavily causes false alarms, and single-clue fakes need their clue weighted high enough to reach *Review*.

---

## 5. Controls (top bar and corners)

| Control | Where | Action |
|---|---|---|
| Orange **back tab** | Top-left | Back to the previous screen (disabled on the first screen) |
| **Sound** hexagon | Top-right | Menu: **Replay Narration**, **Mute All Sounds** |
| **i** hexagon | Top-right | Settings: Resume, Music on/off, Sound effects on/off, Restart mission |
| **Timer** plate | Top-right | 35:00 countdown with a draining bar: orange, then amber at 10 min, then red and blinking at 5 min. Pauses while pop-ups are open; stops at 00:00 without ending the game |
| **Player chips** | Top centre | Avatar, name and role; the active player glows orange and is marked "playing" |
| **Progress bar** | Right edge | Step N/10; stripes turn orange as the mission advances |
| **Lightbulb** | Bottom-left | Shows a hint for the current screen |

---

## 6. Audio

- **Narration:** one line per screen, pre-recorded with ElevenLabs **Multilingual v2**, voice **Suhana J** (Indian English). The files are in `assets/audio/narration/`.
  - Each screen is narrated the first time it appears.
  - While it plays, the screen is locked, its buttons are hidden, and a **"Listen…"** tag shows under the sound button.
  - When it ends, players can continue.
  - Muting stops the narration immediately.
- **Word-timed highlights:**
  - Tutorial: Source, then Date, Image and Urgent words pop and glow as each is named.
  - Points screen: the 20-points bar lights up on "Share twenty points".
- **Hand nudge:** after the points-screen line ends, a tapping 👆 points at the first **+**. It disappears on the first tap.
- **Background music:** a soft generated loop. It is fully silenced while the narrator speaks.
- **Sound effects:**
  - taps and drops;
  - correct and wrong tones;
  - a scan "light" per clue;
  - a two-note **new message chime** when the next message arrives;
  - a badge sound at the end.

---

## 7. Visual design (SKAI UI)

### Look and feel
- **Background:** an illustrated living room, **blurred and slightly darkened** so cards stand out. On screens wider or taller than 16:9, the bars around the game show the same soft room.
- **Style:** friendly 2.5D illustration (the parent and three kids, robot avatars, glossy 3D clue icons) combined with the SKAI game interface from Figma (file "SKAI final").

### Colours

| Token | Value | Used for |
|---|---|---|
| SKAI orange | `#FCA01B` / `#FDAE35` | Main buttons, progress stripes, glows, active player, highlights |
| SKAI navy | `#0A2D94` | Timer plate, sound menu, Listen tag |
| Card gradient | `rgb(26,60,141)` to `rgb(7,24,72)` with an orange top edge | SKAI dark cards |
| Blue plate | `#2E48A3` | Secondary buttons |
| Pastel card tops | blue `#AFD8FA`, pink `#FBD4D7`, green `#D1ECC4`, peach `#FBD8BB` | Clue cards (Source, Date, Image, Urgent) |
| Verdict colours | green / amber / red | Likely okay / Review / Suspicious |

### Typography

| Font | Used for |
|---|---|
| **Chakra Petch** (Bold) | Headings, button labels, HUD text |
| **Fredoka One** | Rounded display text |
| **Inter** | Body text and small labels |
| Segoe UI | Some panel text (system font) |

All fonts are stored locally in `assets/fonts/`.

### Components
- **Buttons:** slanted SKAI "plate" shapes with four screws.
  - **Orange** for moving forward (Next, Check, Fix, Finish).
  - **Blue** for setup and secondary actions.
  - Small round actions (+ / −, close) use the orange **hexagon**.
- **Cards:** rounded cards with an illustration on top and a white text panel. Selected or target cards get an orange ring.
- **Phone:** the message appears on a phone mock-up. During a scan, the words linked to each clue are marked in turn.
- **Rails:** white HUD lines along the bottom that slide out from behind the main button when it appears.

### Motion
- **Screen change:** a short slide and fade.
- **Between messages:** the screen stays put. The new message slides in and the "Forwarded message" bar flashes an orange ring.
- **Buttons:** pop in with a slight overshoot.
- **Narrated card:** a single pop and glow.
- **Hand nudge:** a looping tap.
- **Timer bar:** drains smoothly each second.
- **Reduced motion:** with the system reduced-motion setting on, animations are cut to near zero.

---

## 8. Devices and offline

- **Layout:** the game is laid out once at **1600×900** and scaled as a whole to fit any screen, so every device shows the same layout.
- **Phones and tablets held upright:** they see a **"Turn your device sideways to play"** screen.
- **Touch devices:** Start switches to fullscreen and requests landscape where the browser allows it (Android Chrome).
- **Offline:** the game makes no internet requests. Copy the whole folder and open `index.html` in Chrome, Edge or Firefox.
