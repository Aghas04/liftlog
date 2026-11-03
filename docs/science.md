# Why every workout looks the way it does

Every rule the app uses when it builds a workout or plan, what it is based on,
how strong that evidence is, and the test that checks the rule holds.

Evidence strength:
- **Strong**: several trials or a meta-analysis agree.
- **Moderate**: some trials or one good review; the direction is clear, exact numbers less so.
- **Practical**: a coaching convention with sound reasoning, not tested directly. Kept modest on purpose.

When no goal is set (the "Build today's workout" builder, templates), the app
assumes the goal is muscle growth with steady strength gains, which is what most
of the research below measures.

## Volume: how many sets

| Rule | Why | Evidence | Strength | Checked by |
|---|---|---|---|---|
| Weekly hard sets per muscle are the main volume target | Weekly sets predict muscle growth better than anything else, with diminishing returns | Pelland et al. 2024 (meta-regression, 67 studies); Schoenfeld, Ogborn & Krieger 2017 | Strong | `planner.test` weekly volume tests |
| At least 10 sets per big muscle per week; about 14 for beginners, 20 for intermediates, 24 for advanced lifters at most | 10+ sets clearly beat fewer; above ~20 the extra benefit is small and uncertain | Schoenfeld 2017; Baz-Valle et al. 2022 | Strong (10+); moderate (the caps) | `science.test` weekly volume range |
| More session time means more sets, up to the level maximum | Extra sets keep helping a little, so use the time, but stop where returns flatten | Pelland 2024 | Moderate | `planner.test` time-based volume |
| No more than 10 sets for one muscle in one workout | Gains per session level off around 6-11 hard sets; spreading volume across days works better | Remmert et al. (preprint); Schoenfeld et al. 2016 | Moderate (preprint) | `science.test` per-session limit (builder and plans) |
| Sets that train a muscle indirectly count as half | Triceps work in bench press, biceps in rows. The dose-response research fit growth best with this "fractional" counting, so the weekly goals are in the same units | Pelland 2024 fractional counting | Strong | builder helper-credit test |
| Each week adds up: done + planned lands on every muscle's goal (counted the same way as the weekly card) | Weekly volume is what drives growth, so the plan trims or adds sets until it matches | Follows from the volume rules | Moderate | `weekgoal.test` |
| Helper muscles trained with their big muscle get fewer direct sets (biceps with back, triceps with chest) | They already got indirect work; stacking curls on top gives diminishing returns and wastes time | Pelland 2024 | Moderate | `science.test` helper credit |
| Indirect work can replace at most 60% of a small muscle's sets | Some parts only grow with direct work (e.g. the triceps long head needs overhead work) | Maeo et al. 2023 | Moderate | `plancontrol.test` small muscles get direct work |
| 2-4 sets per exercise, at least 2 exercises per muscle | Volume spread over exercises covers more of the muscle; beyond ~4 sets of one exercise quality drops | Regional hypertrophy studies (Maeo 2021, 2023); practical | Moderate | `science.test` builder rules |
| Priority muscles get up to 4 extra sets and go first | More volume and doing it first both improve growth for that muscle | Pelland 2024; Nunes et al. 2021 | Moderate | planner priority tests |
| Block review: +2 sets if a muscle stalled while recovering well, -2 if declining or recovering poorly | People respond differently; adjusting volume to the individual helps | Scarpelli et al. 2022; Damas et al. 2019 | Moderate | `planner.test` review decisions |

## Exercise choice

| Rule | Why | Evidence | Strength | Checked by |
|---|---|---|---|---|
| Each muscle's lifts aim at different parts (upper/mid/lower chest; front/side/rear delts; lats/upper back/traps) | Parts of a muscle grow differently with different exercises | Maeo et al. 2021 (hamstrings); Maeo et al. 2023 (triceps); regional hypertrophy reviews | Moderate | `science.test` different parts; `plancontrol.test` coverage after edits |
| Main lifts stay the same for a 4-6 week block; accessories rotate only when stalled or to cover a neglected part | Random exercise changes slow strength gains; planned variation helps | Kassiano et al. 2022 | Moderate | `plancontrol.test` review keeps progressing lifts |
| Lifts you already do are preferred | Familiar lifts give accurate suggestions and better technique | Practical | Practical | builder usage tests |
| No switching between versions of a lift that train it the same way (machine vs dumbbell hip thrust); dumbbell vs barbell or machine presses may sit on different days | Random, redundant variation can slow gains; planned variation that changes the stimulus (dumbbells: deeper stretch, each arm alone; bar: heavier, steadier loading) is fine or helpful | Kassiano et al. 2022 (systematic review); Kassiano et al. 2024 | Moderate | `variety.test` |
| Advanced-only lifts (Nordic curls, dragon flags) only for advanced lifters | High injury and soreness risk for novices | Practical | Practical | `planner.test` hard movements |
| Lifts that hurt, or that your gym doesn't have, are never picked | Safety and practicality | n/a | n/a | `plancontrol.test` blocked lifts |

## Order inside a workout

| Rule | Why | Evidence | Strength | Checked by |
|---|---|---|---|---|
| Multi-joint lifts for big muscles first, priority muscles first among them | Exercises done first improve most and allow heavier loads | Simão et al. 2012 (review); Nunes et al. 2021 | Strong | `science.test` order rules |
| Small-muscle compounds and isolation after the big lifts | Tired biceps or triceps limit the big lifts that need them | Simão 2012 | Strong | `science.test` order rules |
| Isolation lifts alternate between muscles instead of stacking one muscle back to back | Each muscle gets some recovery between its lifts, keeping reps up; four curls in a row piles fatigue on one small muscle | Simão 2012; pre-exhaustion studies (e.g. Augustsson 2003) | Moderate | `science.test` isolation alternation |
| Supersets of unrelated or opposing muscles when a session runs over time | Saves a lot of time with similar results | Iversen et al. 2021 | Moderate | `planner.test` supersets |

## Reps, load and rest

| Rule | Why | Evidence | Strength | Checked by |
|---|---|---|---|---|
| Muscle goal: 6-12 reps on weighted compounds, 8-12 on isolation; bodyweight up to 20 | Muscle grows across a wide range when sets are hard; 6-12 is efficient and easy to progress | Schoenfeld et al. 2017 (load meta-analysis); Lopez et al. 2021 | Strong | `science.test` rep ranges |
| Strength goal: main lifts 3-6 reps, the rest 6-12 | Strength is specific to heavy loads | Lopez 2021; Schoenfeld 2017 | Strong | `science.test` main lifts |
| Double progression: more reps until the top of the range, then more weight | Gradual overload with the weight jumps your gym has | Practical, standard | Practical | `simulate.test` |
| Targets aim for about 1 rep beyond what you showed; 2+ reps short counts as a miss | Sets near failure grow muscle; targets that keep 1-2 reps in reserve stay sustainable | Refalo et al. 2023 (proximity to failure) | Moderate | `engine.test` miss rules |
| Weights adjust for how tired a muscle is from earlier lifts that day | Earlier work for the same or helper muscles reduces reps | Simão 2012; app's own learned fatigue rate | Moderate | `engine.test` fatigue tests |
| Rest: at least 2 min on big compound lifts, 3 min on strength sets (3-6 reps), your default on isolation | Longer rests keep reps up and build more muscle and strength | Schoenfeld et al. 2016 (3 vs 1 min); Singer et al. 2024 (meta-analysis) | Moderate-strong | `science.test` rest |
| New lift: targets set from the first set, assuming ~2 reps left in reserve | Safe start without history | Practical | Practical | `simulate.test` calibration |
| New lift with another version done before (barbell to dumbbell bench): a rough starting weight converted from it, then set from your first set | A closer start than guessing | Practical | Practical | browser check |
| A set 2+ reps off its goal re-targets the rest of that lift today | Day-to-day strength varies; following today keeps sets near the planned effort | Autoregulation reviews (e.g. Larsen et al. 2021) | Moderate | `audit.test` |
| Mixed-weight sessions (pyramids, top set + back-offs) keep their pattern; one-off heavy singles are not the working weight | Progress what you actually did | Practical | Practical | `audit.test` |
| Small isolation lifts add reps up to 15 before a jump of more than 15% | Growth is similar across a wide rep range when sets are hard | Schoenfeld et al. 2017 | Strong (rep range); practical (the 15% line) | `engine.test`, `simulate.test` |
| After 3 sessions without progress: offer 10% lighter, an extra set, or a swap | Plateaus respond to a change in load, volume or exercise | Practical, consistent with Kassiano 2022 | Practical | `audit.test` |

## Weekly schedule and recovery

| Rule | Why | Evidence | Strength | Checked by |
|---|---|---|---|---|
| Each big muscle trained about twice a week | Twice a week beats once with equal volume, mostly because it fits more good sets | Schoenfeld, Ogborn & Krieger 2016; Schoenfeld, Grgic & Krieger 2019 | Strong | `science.test` recommended split frequency |
| Any split works when volume is equal; splits are ranked by your days and time | Split type itself matters little | Ramos-Campo et al. 2024 | Strong | `planner.test` recommendations |
| No same big muscles on back-to-back days when avoidable | Muscles need ~48 h to recover from hard sessions | Practical, supported by recovery-time research | Moderate | `planner.test` back-to-back days |
| Leg days kept away from leg-heavy sports | Hard running or sport the day before reduces leg strength work | Wilson et al. 2012 (concurrent training meta-analysis) | Moderate | `planner.test` leg activity |
| Missed sessions move to the next day; the rotation continues | Keeps weekly volume and balance instead of skipping muscles | Practical | Practical | `plancontrol.test` rotation |
| The week adapts to what you actually did (any workout, swaps, skips): sets move where they fit and missed parts get covered | Weekly volume and coverage are what matter, not which day | Follows from the volume and coverage rules above | Moderate | `plancontrol.test` adaptive week |
| A deload week: about 15% lighter and about 40% fewer sets | Cuts fatigue while strength holds; most deloads reduce volume, not just load | Bell et al. 2023 (deload consensus); Coleman 2024 | Moderate | `engine.test`, `planner.test` deload week |
| Last week's shortfall carried into this week, at most a quarter of the weekly goal | Weekly volume is what drives growth, so a small make-up keeps the average on target without one overloaded week | Follows from the volume rules (Pelland 2024) | Practical | `plancontrol.test` shortfall |
| Timed holds: 20-90 s, +5 s when every goal is hit, harder version past 90 s | Longer holds add little; progressing the exercise is the overload | McGill (core endurance work); practical | Practical | `engine.test` holds |
| Deloads only when lifts stall or drop | Scheduled deloads can cost progress; deload when needed | Coleman et al. 2024 | Moderate | `engine.test`, `insights.test` deload |
| After a break of 2+ weeks, the first week has ~30% less volume; weights drop 10% (2-4 weeks off), 15% (to 2 months), 20% (to 4 months), 25% (longer) | Strength holds for ~3 weeks then fades with time; easing back avoids soreness and injury | Bosquet et al. 2013 (detraining); practical | Moderate | `plancontrol.test` breaks, `audit.test` |
| Rough day (2 of: poor sleep, very sore, low energy): one set off accessories | Poor sleep and fatigue reduce performance | Knowles et al. 2018 | Moderate | `planner.test` readiness |

## Form tips

The How to sheet and form cues are checked separately: see [form-sources.md](form-sources.md).

## What the app does not claim

- Exact set numbers are averages; the block review adjusts them to you.
- The 10-sets-per-session limit comes from a preprint; it matches older work but may be refined.
- Rules marked Practical are conventions, kept conservative, and listed so they can be revisited.
