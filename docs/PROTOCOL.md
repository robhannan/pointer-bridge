# Wire protocol (v1)

UDP datagrams from the TV (`tv/sender.js`) to the bridge (the Pico W, or `mac/receiver.ts` while testing). Default port
**47800**. One event per datagram, little-endian. Every datagram starts with a 6-byte header:

| Offset | Size | Field |
|---|---|---|
| 0 | 2 | magic `"PB"` (0x50 0x42) |
| 2 | 1 | version, `1` |
| 3 | 1 | type (below) |
| 4 | 2 | sequence number (u16, wraps), for spotting loss |

| Type | Name | Body after the header | Total |
|---|---|---|---|
| 1 | `POS` | `x` u16, `y` u16, each **0..32767** across the whole screen (what a USB HID absolute pointer takes) | 10 |
| 2 | `BUTTON` | button u8 (1 = primary), state u8 (1 down, 0 up) | 8 |
| 3 | `WHEEL` | notches i8 (positive = up), pad u8 | 8 |
| 4 | `STATE` | active u8 (1 = the box's input is on screen), pad u8; sent on change and every 2 s as a heartbeat | 8 |

The sender sends at most one `POS` per `SYN_REPORT`, and only when the position changed.

Loss is tolerable: the next `POS` corrects the cursor. A lost button-up is the hazard, so the bridge releases all
buttons on `STATE` inactive or when nothing has arrived for 3 s.
