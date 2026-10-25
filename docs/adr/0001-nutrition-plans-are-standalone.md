# Nutrition Plans are standalone, not scoped to Training Plans

The app already has Training Plans (with Plan Days and exercises). When adding Nutrition Plans we considered scoping them to a Training Plan — swapping your training program would also swap your meal template. We chose standalone instead: a user may want the same weekly meal prep schedule across different training programs, and the two concerns (what you eat vs what you train) don't naturally compose. A future user could have multiple Nutrition Plans and multiple Training Plans and mix them independently.

## Considered Options

- **Scoped to Training Plan**: each Training Plan carries a Nutrition Plan; they activate together.
- **Standalone (chosen)**: Nutrition Plans are independent; the user activates one separately.

## Consequences

Nutrition Plans have their own `active` flag and their own list/switch UI at `/nutrition/plans`, mirroring but not merging with the Training Plan UI at `/plans`.
