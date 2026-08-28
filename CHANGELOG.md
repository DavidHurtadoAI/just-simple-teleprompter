# Changelog

## 0.1.13

- Use only the up arrow for reverse and the down arrow for forward in built-in pedal mode.
- Remove page up/down and left/right arrows from the teleprompter view's built-in key scope.

## 0.1.12

- Route page up/down and arrow controls through a hotkey scope owned by the focused teleprompter view.
- Keep the commands assignable without installing conflicting global default hotkeys.

## 0.1.11

- Register page up/down and arrow controls as default Obsidian command hotkeys.
- Focus the teleprompter input surface so iOS can route external-keyboard events to it.
- Deduplicate an action when both the view listener and Obsidian hotkey layer receive it.
- Rename the empty custom binding from `Automatic` to `Built-in keys`.

## 0.1.10

- Wait for a learned pedal key to be persisted before closing the capture dialog.
- Update the visible pedal assignment immediately instead of relying on a settings-tab refresh.
- Keep the capture dialog open with an explicit error if the key was received but could not be saved.
- Learn legacy numeric and WebKit key identifiers when iOS hides the normal `key` and `code` values.

## 0.1.9

- Make pedal learning resilient to iOS events whose `code` or `key` is `Unidentified`.
- Show the raw keyboard `key`, `code`, and repeat state while learning a pedal.
- Recognize legacy iOS arrow-key names and usable key codes as automatic pedal input.
- Add assignable Obsidian commands for forward, reverse, pause/resume, and pause.

## 0.1.8

- Keep subpixel scroll progress internally so automatic scrolling works in mobile WebViews that round `scrollTop`.
- Move the control bar to the top in the Obsidian mobile app so the app navigation cannot cover it.
- Add a complete, scannable feature summary to the README.

## 0.1.7

- Remove partially supported `clip-path` declarations from compact value labels.
- Replace `!important` with a more specific view selector, clearing Obsidian's CSS lint warnings.

## 0.1.6

- Place transport and reading controls on one horizontal bar.
- Adapt button sizes and value visibility for narrow phone screens without wrapping.

## 0.1.5

- Refresh an open teleprompter automatically when its source note changes.
- Preserve scroll position, direction, and playback state across source refreshes.

## 0.1.4

- Add compact text-size and horizontal/vertical mirror controls to the teleprompter view.
- Reduce the size and spacing of every on-screen control.

## 0.1.3

- Add independent horizontal and vertical text mirroring that can be combined.
- Make the on-screen transport and speed controls more compact.

## 0.1.2

- Validate the plugin with Obsidian's official ESLint rules in CI.
- Migrate settings to Obsidian 1.13's searchable declarative settings API.
- Preserve open teleprompter views across plugin reloads and updates.
- Enforce exact release tags and cross-check all required release metadata and assets.

## 0.1.1

- Change pedal behavior: either pedal pauses while the teleprompter is moving.
- Keep directional selection on start: right starts forward and left starts reverse.

## 0.1.0

- Add a mobile-friendly teleprompter view for any Markdown note.
- Add smooth automatic scrolling in forward and reverse directions.
- Add touch, keyboard, and configurable Bluetooth pedal controls.
- Add font, speed, mirror, cue-line, and keep-awake settings.
