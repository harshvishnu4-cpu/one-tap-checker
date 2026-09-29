# Narration script

Generated with ElevenLabs **Multilingual v2** (`eleven_multilingual_v2`), voice **Suhana J – Very Young & Expressive Narrator** (`A2VREc2wjqtSZloENLHe`, Indian English), default settings (stability 0.5, similarity 0.75, style 0, speed 1). One file per screen; the game plays each the first time a screen appears, and players continue once it ends.

| File | Line |
|---|---|
| setup-count.mp3 | Welcome, explorers! How many of you are playing today? Tap three or four to begin. |
| setup-picker.mp3 | Pick a robot avatar that you like, and type your name. Every explorer gets a turn. |
| setup-team.mp3 | Here is your team! Check that every name is right, then tap, Let's investigate. |
| roles.mp3 | Meet your mission team. Everyone has a special role. Work together to build and test the checker. |
| intro.mp3 | This parent just got a forwarded message. But is it true? Can you build a checker this parent can trust? |
| tutorial.mp3 | Our checker looks at four clues: the source, the date, the image, and urgent words. Each clue asks one question about a message. |
| ranking.mp3 | Now decide how much each clue should count. Share twenty points across the four clues. Talk it over with your team! |
| sensitivity.mp3 | How careful should our checker be? Choose the score where a message needs a closer look, and the score where it looks suspicious. |
| test.mp3 | Time to run the checker! Read the message aloud with your team, then tap, Check message. |
| result.mp3 | Here is what your rule decided. Look at the score together. Do you agree with the checker? |
| batch.mp3 | Great work, you checked all the messages! Some tricky ones fooled the checker. Let's find and fix the mistakes. |
| cause.mp3 | What fooled the checker? Look closely at the message, and find the clue that caused the mistake. |
| adjust.mp3 | Now move one star to fix the rule. But be careful, taking stars away can weaken other checks! |
| retest.mp3 | The checker has scanned every message again with your new rule. Did your fix work? |
| final.mp3 | Mission complete! See how many messages your rule checked correctly. And remember, even a good checker needs a human to double-check. |

## Highlight cues

While a line names a clue, only that card plays one pop-and-glow animation (`NARRATION_CUES` in `game.js`). Times were measured from the pauses in the recording, so re-measure them if a line is re-recorded.

| File | Seconds | Card(s) lit |
|---|---|---|
| tutorial.mp3 | 3.0–4.15 | Source ("the source") |
| tutorial.mp3 | 4.18–5.2 | Date ("the date") |
| tutorial.mp3 | 5.25–6.3 | Image ("the image") |
| tutorial.mp3 | 6.35–8.5 | Urgent words ("and urgent words") |
| ranking.mp3 | 3.75–5.8 | the 20-points bank ("Share twenty points") |

After the ranking line ends, a tapping hand points at the Source "+" button (`NARRATION_NUDGES` in `game.js`); it disappears on the first tap.

Background music is fully silenced while any line plays and resumes when it ends.
