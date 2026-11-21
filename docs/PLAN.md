# Plan

## Increments

0. **Spike: pointer on HDMI.** With HDMI 1 on screen, read `/dev/input/event*` on the TV (`spike/evdev-probe.js`) while
   using the remote. Go/no-go: the pointer's motion (relative or absolute) and OK/wheel arrive while HDMI is shown.
1. **Bridge firmware.** Pico W as a USB HID mouse taking UDP packets over Wi-Fi; test with a sender on the Mac.
2. **TV add-on.** CleanYourTV add-on: active only while the SHIELD's input is foreground; reads the pointer, sends UDP.
3. **Polish.** LG's own cursor over HDMI, OK double-firing (CEC Enter + click), mapping/acceleration, reconnects.

## Open questions

- Does the pointer reach userspace while an HDMI input is foreground, and in which device and form (REL or ABS)?
- Does LG draw its cursor over HDMI, and can it be hidden?
- Does OK send a CEC Enter as well as a click when the pointer is visible?
- Wire format: absolute 0..65535 coordinates (HID absolute pointer) vs relative deltas.

## Spike results

_Not run yet: the TV was in standby on 2026-11-21._
