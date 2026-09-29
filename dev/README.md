# Dev menu (testing only)

A hamburger button in the top-left corner that jumps straight to any screen of the game.

- The current screen is highlighted in the list.
- Choosing a screen, clicking outside the menu, or pressing Esc closes it.
- When you jump ahead, the menu fills in demo data the screen needs (a 3-player team, a ranked rule, test results, a mistake to fix), keeping anything you already set up.
- “Skip ‘your turn’ pop-ups” (on by default) dismisses the pass-the-device pop-up after a jump.
- It shows by default. Add `?dev=0` to the page URL to hide it without deleting anything.
- It sits just under the game's orange back tab, so it never covers the back button.

## Removing it

1. Delete this `dev/` folder.
2. In `index.html`, delete the two lines marked `DEV MENU`.
3. In `game.js`, delete the block between `DEV MENU HOOK` and `END DEV MENU HOOK`.
