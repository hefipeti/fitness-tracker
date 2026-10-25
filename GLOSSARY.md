# Fitness Tracker

A personal fitness tracking application for logging workouts, tracking nutrition, and gamifying progress toward fitness goals.

## Language

### Training

**Plan**: A named training program containing an ordered set of Plan Days, each assigned to a weekday. Multiple Plans can exist per user; only one is active at a time.
_Avoid_: Program, workout plan, training program

**Plan Day**: A named day within a Plan, assigned to a specific weekday (1–7), containing an ordered list of exercises with targets (sets, reps, weight).
_Avoid_: Training day, workout day

**Rest Day**: A weekday with no Plan Day assigned in the active Plan. Not an explicit record — derived by the absence of a Plan Day for that weekday.
_Avoid_: Off day, recovery day

**Session**: A single completed (or in-progress) instance of a Plan Day, logged on a specific calendar date.
_Avoid_: Workout, training session

**Exercise**: A named movement (e.g. "Pull-up", "Squat"). Built-in exercises are shared across all users; user-created exercises are private.

**Set**: A single logged attempt within a Session, recording reps and weight for one Exercise.

### Nutrition

**Food**: A named item in a user's food library with a serving label and per-serving macro breakdown (kcal, protein, carbs, fat).
_Avoid_: Ingredient, item

**Food Log**: A record of a specific Food consumed at a Meal on a given date, with a serving count and computed macros.
_Avoid_: Meal log, nutrition log

**Meal**: One of four named eating occasions within a day: breakfast, lunch, dinner, or snack.

**Food Day**: The aggregate of all Food Logs for a user on a single date, including total macros compared against the user's Nutrition Targets.
_Avoid_: Nutrition day, daily log

**Nutrition Target**: Per-user daily goals for kcal, protein, carbs, and fat.
_Avoid_: Macro goal, calorie target

### Nutrition Plans

**Nutrition Plan**: A standalone weekly template that defines Prep Sessions and Planned Meals for each day of the week. Multiple can exist per user; only one is active at a time. Not scoped to a Training Plan.
_Avoid_: Meal plan, weekly plan, diet plan

**Prep Session**: A named batch-cooking event within a Nutrition Plan, assigned to a Cook Day. Contains a list of Foods and serving quantities to cook in one go, plus optional notes.
_Avoid_: Meal prep, batch cook, cooking session

**Cook Day**: The weekday (1–7) on which a Prep Session's cooking occurs. Rest Days are the suggested default.
_Avoid_: Prep day, cooking day

**Planned Meal**: An assignment of a Food at a specific Meal slot on a specific weekday within a Nutrition Plan, with a serving count. Either prep-linked (originates from a Prep Session) or standalone (no Prep Session).
_Avoid_: Meal assignment, scheduled meal

### Gamification

**XP**: A numerical score earned by completing Sessions and hitting Nutrition Targets. Drives Rank progression.
_Avoid_: Experience, points

**Rank**: A bracket derived from cumulative XP, displayed on the user's profile.
_Avoid_: Level, tier

**Achievement**: A one-time reward unlocked when a specific condition is met (e.g. completing every assigned Planned Meal day in a calendar week).
_Avoid_: Badge, trophy
