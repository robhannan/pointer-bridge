# pointer-bridge

Read `README.md` and `docs/PLAN.md` first; record spike results and decisions in `docs/PLAN.md`.

- Code that runs on the TV is plain JavaScript for webOS 5's Node 8 (no TypeScript runtime there; CleanYourTV add-ons are JS).
  Mac-side tooling is TypeScript; the Pico W firmware is Rust (embassy) unless a spike shows a reason otherwise.
- Reach the TV with root SSH (`TV_HOST`, optional `TV_KEY`) and the SHIELD with adb over the network; both need the Bash sandbox off.
- Probes on the TV must never grab input devices (`EVIOCGRAB`): LG's input handling has to keep working.
