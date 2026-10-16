# Working on Dayframe

## Read before implementation

1. Read [the technical specification](docs/technical-specification.md) for requirements and hard constraints.
2. Read [the implementation plan](docs/implementation-plan.md) for sequencing, acceptance gates, and open decisions.
3. **This project builds on Wes Bos's work in [wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard).** Read the plan's upstream section and inspect the relevant upstream code/docs before implementing dashboard or device work. Record what is reused, adapted, or intentionally different, with source paths and a commit SHA when available. Do not treat the upstream reference as an optional footnote.

The local specification controls product requirements. Upstream is a source of implementation ideas and hardware research, not proof that a procedure works on our frame. Check license and attribution requirements before copying code or assets; do not assume permission from public visibility.

For hardware work, first identify the actual model, board, firmware, Android version, and browser. Dragon Touch Classic 10 and Modern10 Charm are different models. Read current upstream device notes and relevant issues/PRs before proposing device changes. Start with non-destructive inspection; do not run upstream setup or flashing scripts blindly. Firmware/system changes require a verified backup, a recovery path, and explicit authorization for the specific action.

Implement one reviewable milestone slice at a time, starting with M1. Keep the plan updated with evidence and unresolved decisions. Protect photo reads and mutations before exposing them publicly. Keep household data and credentials out of source control. Preserve the €0 recurring-cost requirement and do not enable paid or automatically billed services without explicit approval.
