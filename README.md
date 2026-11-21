# pointer-bridge

Use the LG Magic Remote's pointer as a real mouse on the Android box (NVIDIA SHIELD) behind the TV's HDMI input.

```
Magic Remote ──► LG TV (rooted, CleanYourTV) ──UDP over Wi-Fi──► Pico W ──USB HID mouse──► SHIELD
```

- **TV side:** a CleanYourTV add-on reads the remote's pointer from the kernel input devices while the SHIELD's input is on screen and sends movements, clicks and scrolls as UDP packets.
- **Bridge:** a Raspberry Pi Pico W plugged into the SHIELD's USB port shows up as an ordinary USB mouse, so Android draws its own pointer. No root and nothing to install on the SHIELD.
- **Fallback without hardware:** an adb-started helper on the SHIELD (scrcpy-style `app_process`) that injects mouse events and draws its own cursor.

See [docs/PLAN.md](docs/PLAN.md) for the plan, open questions and spike results.

## Hardware

| Device | Details |
|---|---|
| TV | LG OLED55CX6LA, webOS 5 (SDK 5.6.2), firmware 04.64.00, rooted (Homebrew Channel), CleanYourTV 1.6.30 |
| Android box | NVIDIA SHIELD TV Pro (2019), Android 11, adb over the network, on HDMI 1 |
| Bridge | Raspberry Pi Pico W (to buy) |

## Running the TV sender

The scripts reach the TV as root over SSH: set `TV_HOST` to its address, and `TV_KEY` to an SSH key if your default one isn't authorised.

```sh
export TV_HOST=192.168.1.20 TV_KEY=~/.ssh/webos
pnpm install
tv/run-tunnel.sh 30                 # sender on the TV, packets back over SSH, live map on the Mac
tv/run-tunnel.sh 15 --always --verbose -- --log   # send whatever is on screen; log keys and every packet
tv/run-sender.sh <bridge-ip>        # send straight over UDP to a bridge (the Pico W); Ctrl-C stops it
```

The wire format is in [docs/PROTOCOL.md](docs/PROTOCOL.md).

## Spike 0: can the TV see the pointer on HDMI?

Turn the TV on, switch to HDMI 1, then run this and wave the remote, press OK and roll the wheel:

```sh
TV_HOST=<tv-ip> spike/run-probe.sh 15
```
