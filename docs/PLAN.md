# Plan

## Increments

0. **Spike: pointer on HDMI.** With HDMI 1 on screen, read `/dev/input/event*` on the TV (`spike/evdev-probe.js`) while
   using the remote. Go/no-go: the pointer's motion (relative or absolute) and OK/wheel arrive while HDMI is shown.
1. **Bridge firmware.** Pico W as a USB HID mouse taking UDP packets over Wi-Fi; test with a sender on the Mac.
2. **TV add-on.** CleanYourTV add-on: active only while the SHIELD's input is foreground; reads the pointer, sends UDP.
3. **Polish.** LG's own cursor over HDMI, OK double-firing (CEC Enter + click), mapping/acceleration, reconnects.

## Open questions

- Does the pointer reach userspace while an HDMI input is foreground, and in which device and form (REL or ABS)?
- LG draws its cursor over HDMI (confirmed): can it be hidden while the box's input is on screen? Candidates: a
  surface-manager/cursor setting over luna, or a transparent CleanYourTV overlay that sets the cursor to none.
- OK sends a CEC Enter as well as our click (confirmed), so the SHIELD gets both. Options: stop the TV forwarding OK over
  CEC while the pointer is visible (SIMPLINK key forwarding), have the bridge skip the click when a CEC Enter will do the
  same job, or accept it where Enter on the focused item is harmless.
- Wire format: absolute 0..65535 coordinates (HID absolute pointer) vs relative deltas.

## Spike results

### Spike 0, 2026-11-21: GO

Run with HDMI 1 on screen (per the user; the probe's own foreground check came back empty, luna-send is flaky), 20 s of
waving, OK, arrows and wheel. Everything arrives on one device, readable without grabbing it:

`/dev/input/event3` "LGE M-RCU - Builtin [0]" (the Magic Remote)

| Event | Seen | Meaning |
|---|---|---|
| `ABS_X` | 236, 0..1914 | pointer X in **screen pixels** (1920 wide), already computed by LG |
| `ABS_Y` | 254, 0..819 | pointer Y in screen pixels (1080 high; not swept to the bottom) |
| `REL_WHEEL` | 44, ±1 | scroll wheel notches |
| `KEY 28` (`KEY_ENTER`) | 2 | OK |
| `KEY 103/105/108` | | arrow keys (up/left/down) |
| `KEY 1198/1199/1222` | 6 each | LG-specific codes around pointer use; to identify (pointer show/hide?) |
| `KEY 412` | 2 | to identify (Back?) |

Takeaways:
- The pointer is **absolute** and in screen pixels, so the bridge should be a HID **absolute** pointer (scale to 0..32767):
  the SHIELD's cursor lands where the remote points, with no drift or acceleration to tune.
- No pairing with LG's processing is needed; LG's input handling kept working while the probe read (no grab).
- Node 8 reads char devices on libuv pool threads: `UV_THREADPOOL_SIZE` must exceed the device count.

Answered by looking at the TV (2026-11-21): **LG draws its own cursor over the HDMI picture**, and **OK also goes out to the
SHIELD as a CEC Enter**. Both need handling in increment 3 (see open questions).

### Increment 2a, 2026-11-21: TV sender works end to end (through an SSH tunnel)

`tv/sender.js` on the TV, `mac/receiver.ts` on the Mac. This Mac is managed and its firewall blocks incoming UDP to
Node (and can't be changed from the command line), so the test ran through `tv/run-tunnel.sh`: the sender sends to a
relay on the TV and the relay's output comes back over SSH. The Wi-Fi hop itself is untested until the Pico W.

- 25 s of use: 1,804 `POS` (~78/s while moving), 53 `WHEEL`, `STATE` heartbeats; no loss once the relay was up.
- The foreground check saw HDMI 1 and turned the pointer on by itself (~2 s after start, the first poll).
- OK is `KEY_ENTER` (28) while the pointer shows: 3 of 3 presses arrived as button down/up pairs, held 0.1–0.26 s.
- Node 8 starts slowly on the TV (> 0.5 s): the first packets of a run can beat the relay; harmless.
