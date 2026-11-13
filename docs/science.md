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
| At least 10 sets per big muscle per week; about 14 for beginners, 20 for intermediates, and up to 30 for advanced lifters when time allows | 10+ sets clearly beat fewer; growth keeps rising with more sets, with diminishing returns, so advanced plans (aiming for the most growth) go higher. Sets are counted fractionally, like the research | Schoenfeld 2017; Baz-Valle et al. 2022; Pelland et al. 2024 | Strong (10+); moderate (the caps) | `science.test` weekly volume range |
| More session time means more sets, up to the level maximum | Extra sets keep helping a little, so use the time, but stop where returns flatten | Pelland 2024 | Moderate | `planner.test` time-based volume |
| No more than 10 sets for one muscle in one workout | Gains per session level off around 6-11 hard sets; spreading volume across days works better | Remmert et al. (preprint); Schoenfeld et al. 2016 | Moderate (preprint) | `science.test` per-session limit (builder and plans) |
| Sets that train a muscle indirectly count as half | Triceps work in bench press, biceps in rows, glutes in squats and lunges, front delts in bench. The dose-response research fit growth best with this "fractional" counting, so the weekly goals are in the same units. Low-back work in hinges doesn't count toward back | Pelland 2024 fractional counting | Strong | builder helper-credit test, `planner.test` weekly sets |
| A plan started mid-week: the days left get their usual share, and earlier workouts that week count | No cramming, no double counting | Follows from the volume rules | Practical | `plancontrol.test` mid-week |
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
| Muscle goal: each A/B/C day leads with its own main lift, at least one a free-weight compound (a hack squat day and a barbell squat day) | Planned variation across days covers the muscle differently; free-weight compounds add stability demands and strength carry-over. Each day keeps its lift every week | Kassiano 2022; practical | Moderate | `variety.test` |
| Strength goal: the same heavy, loadable main lift on every version of a day (barbell, trap bar, smith or machine) | Strength is specific to the lift and improves with practicing it 2-3 times a week | Grgic et al. 2018 (frequency and strength); specificity | Moderate | `variety.test` |
| When time is short, extra exercises go before sets drop to 2 | A few exercises done for 3 sets beat many done for 2, and every exercise change costs time | Practical | Practical | `planner.test` valid weeks |
| Lifts you already do are preferred | Familiar lifts give accurate suggestions and better technique | Practical | Practical | builder usage tests |
| No switching between versions of a lift that train it the same way (machine vs dumbbell hip thrust); dumbbell vs barbell or machine presses may sit on different days | Random, redundant variation can slow gains; planned variation that changes the stimulus (dumbbells: deeper stretch, each arm alone; bar: heavier, steadier loading) is fine or helpful | Kassiano et al. 2022 (systematic review); Kassiano et al. 2024 | Moderate | `variety.test` |
| Advanced-only lifts (Nordic curls, dragon flags) only for advanced lifters | High injury and soreness risk for novices | Practical | Practical | `planner.test` hard movements |
| Lifts that hurt, or that your gym doesn't have, are never picked | Safety and practicality | n/a | n/a | `plancontrol.test` blocked lifts |

## Order inside a workout

| Rule | Why | Evidence | Strength | Checked by |
|---|---|---|---|---|
| Multi-joint lifts for big muscles first, priority muscles first among them | Exercises done first improve most and allow heavier loads | Simão et al. 2012 (review); Nunes et al. 2021 | Strong | `science.test` order rules |
| Big compound lifts alternate between muscles (press, row, shoulder press, then the second press and row) instead of stacking one muscle | Each lift starts less tired, and alternating opposing muscles keeps reps up and saves time | Simão 2012; Robbins et al. 2010 (paired antagonist sets) | Moderate | `science.test` compound alternation |
| Small-muscle compounds and isolation after the big lifts | Tired biceps or triceps limit the big lifts that need them | Simão 2012 | Strong | `science.test` order rules |
| Isolation lifts alternate between muscles instead of stacking one muscle back to back | Each muscle gets some recovery between its lifts, keeping reps up; four curls in a row piles fatigue on one small muscle | Simão 2012; pre-exhaustion studies (e.g. Augustsson 2003) | Moderate | `science.test` isolation alternation |
| Supersets of unrelated or opposing muscles when a session runs over time | Saves a lot of time with similar results | Iversen et al. 2021 | Moderate | `planner.test` supersets |

## Reps, load and rest

| Rule | Why | Evidence | Strength | Checked by |
|---|---|---|---|---|
| Muscle goal: 6-12 reps on weighted compounds, 8-12 on isolation; bodyweight up to 20 | Muscle grows across a wide range when sets are hard; 6-12 is efficient and easy to progress | Schoenfeld et al. 2017 (load meta-analysis); Lopez et al. 2021 | Strong | `science.test` rep ranges |
| Strength goal: main lifts 3-6 reps, the rest 6-12 | Strength is specific to heavy loads | Lopez 2021; Schoenfeld 2017 | Strong | `science.test` main lifts |
| Double progression: more reps until the top of the range, then more weight. Big compound lifts then jump up to ~10% and restart near 8 reps; isolation lifts and the 3-6 strength range take the smallest step. Weight goes up only when reps drop 1.5 a set or less (12, 11, 10 moves up; 12, 10, 8 and 12, 8, 6 stay and bring later sets up), with a longer-rest tip for big drop-offs | Adding reps and adding load build similar muscle; heavier sets build more strength, and lower-rep compound sets end at muscle failure rather than breathing or form | Plotkin et al. 2022; Schoenfeld et al. 2017 | Moderate | `engine.test`, `simulate.test` |
| Targets aim for about 1 rep beyond what you showed; 2+ reps short counts as a miss | Sets near failure grow muscle; targets that keep 1-2 reps in reserve stay sustainable | Refalo et al. 2023 (proximity to failure) | Moderate | `engine.test` miss rules |
| Weights adjust for how tired a muscle is from earlier lifts that day | Earlier work for the same or helper muscles reduces reps | Simão 2012; app's own learned fatigue rate | Moderate | `engine.test` fatigue tests |
| Rest: at least 2 min on big compound lifts, 3 min on strength sets (3-6 reps), your default on isolation | Longer rests keep reps up and build more muscle and strength | Schoenfeld et al. 2016 (3 vs 1 min); Singer et al. 2024 (meta-analysis) | Moderate-strong | `science.test` rest |
| When a session needs the time (big weekly goals), isolation lifts rest 90 s and the plan supersets them; big lifts keep their longer rests. Weekly goals are sized with these rests, so 6 days of 120 minutes reaches the advanced most (30) | Past about 90 s, longer rests add little for isolation work, while big lifts benefit from 2-3 min | Singer et al. 2024; Schoenfeld 2016 | Moderate | `weekgoal.test` |
| Supersets can be switched off in Settings. Then no lifts are paired: sessions that run over time trim sets instead, and the week names any muscle below its goal, with the minutes that would fit it | Pairing lifts that don't share muscles saves time while keeping reps (volume load); without it the same time holds fewer sets | Robbins et al. 2010; Weakley et al. 2017 | Moderate |  supersets off |
| Rest learned per lift from the times you tick your sets: the shortest rest predicted to keep reps within about 1.5 a set, kept inside 2-4 min for big lifts and 1-3 min for small ones. Uses 8+ timed set pairs on that lift, else your other lifts of the same kind; your own rest setting always wins, and strength sets keep at least 3 min. The lift card says when the timer uses it | Longer rests keep more reps and grow a little more muscle, mostly through that extra volume; how much rest that takes differs by person and lift | Singer et al. 2024; Willardson & Burkett 2005, 2006; Schoenfeld et al. 2016 | Moderate (rest effect); practical (the per-lift fit) | `rest.test` |
| A small lift you need 2+ min on keeps that rest when a session is short of time (fewer full sets rather than rushed ones); other small lifts still drop to 90 s | Reps lost to short rests are volume lost | Singer et al. 2024; Willardson & Burkett 2006 | Moderate | `rest.test` |
| Session time: each set takes about 3 s a rep plus 10 s to get set (twice for one-arm or one-leg lifts), plus its rest, a 45 s change between lifts and ramp-up sets before the first big lifts. Your finished workouts set a personal time scale (median of the last 6, kept within 0.75-1.5) so estimates match how long you actually take | Typical controlled reps take 2-4 s (0.5-8 s all build muscle); measuring your own pace beats any fixed guess | Schoenfeld et al. 2015 (rep duration); practical (calibration) | Moderate (rep time); practical | `rest.test`, `weekgoal.test` |
| New lift: targets set from the first set, assuming ~2 reps left in reserve | Safe start without history | Practical | Practical | `simulate.test` calibration |
| Strength estimate: Epley formula from your best set, adjusted for how tired the muscle was from earlier lifts that day | Epley is accurate in the 3-12 rep range where nearly all sets land; the fatigue adjustment lets sessions at different points in a workout compare fairly | Standard 1RM prediction equations; app's own learned fatigue rate | Moderate | `engine.test` fatigue tests |
| Goals build on your latest session, or a recent session (last 4, within 3 weeks) at a similar point in the workout when one exists and is still current | Where a lift sits in a workout changes what you can do; a real session at that point is better evidence than an estimate. Older or out-of-date sessions are never used | Simão 2012 (order effects); practical | Moderate | `audit.test`, `simulate.test` alternating order |
| A clearly bad day (more than ~5% below your best of your last 2-3 sessions at a similar point in the workout, also lower in what you actually lifted) doesn't lower the goal: aim to get back to your best. A set that fell short caps only that same set next time (at most a rep more than you managed), so a missed last set doesn't hold back first sets that hit | Day-to-day strength varies by a few percent; one off day isn't lost strength | Practical | Practical | `audit.test` |
| Weight goes up only on reps you actually logged: the first set at the top of the range and reps dropping 1.5 a set or less on average; a jump earned on a fresh day waits if today the lift is much later in the workout | Double progression on real performance; with 2-3 min rests reps hold within about 1-2 a set | Willardson & Burkett 2005, 2006; Plotkin 2022 | Moderate | `engine.test`, `simulate.test` |
| Later-set goals drop at most 1.5 reps a set and never below the growth range (6 big lifts, 8 small); a set that goes far off plan re-targets the rest of that lift today | Keeps every set in the range that grows muscle; bigger planned drop-offs mostly reflect short rests | Willardson & Burkett 2005, 2006; Schoenfeld 2016, 2017 | Moderate | `simulate.test` |
| Much more tired than usual today (predicted below the range): lighter weight for today so sets stay in the range | Sets of fewer than ~6 reps at a hypertrophy load add little; a lighter weight keeps the stimulus | Schoenfeld 2017 | Moderate | `simulate.test` alternating order |
| "Stalled" only when your strength isn't rising AND you're falling short of goals | Hitting your goals is progress; options when truly stuck: lighter reset, an extra set, or a variation | Kassiano 2022; practical | Practical | `audit.test` |
| New lift with another version done before (barbell to dumbbell bench): a rough starting weight converted from it, then set from your first set | A closer start than guessing | Practical | Practical | browser check |
| A set 2+ reps off its goal re-targets the rest of that lift today | Day-to-day strength varies; following today keeps sets near the planned effort | Autoregulation reviews (e.g. Larsen et al. 2021) | Moderate | `audit.test` |
| Changing a set's weight mid-workout: its goal comes from today's strength estimate at the new weight (working sets only; warm-ups keep their reps), and changing the first set still to do moves the later sets you haven't changed to the same weight. The goal line shows the plan, the predicted reps and the goal. A weight that puts the goal under the rep range, or 3+ reps past its top, gets a note with a weight on your step grid that fits | Heavy low-rep sets build similar muscle only with more sets and joint stress; sets stopped far from failure build less, so a set should end within a few reps of failure inside the range | Schoenfeld et al. 2014, 2017; Robinson et al. 2024; Epley estimate (accurate for 3-12 reps) | Moderate | `weightchange.test` |
| The plan sets how many sets a lift gets today; the goals take that count (extra sets at the planned drop, at most 1.5 reps a set and never under the range floor), so the goal line and the set rows always match. The goal text states the first-set change (+1 usually; +2 when fresher for the lift than last time; equal or fewer when later in the workout) | Weekly sets per muscle are what the plan sizes (Pelland 2024); the drop rule keeps every set in the growth range (Willardson & Burkett 2005, 2006) | Follows from the volume and drop rules above | Moderate | `weightchange.test`, plan-day browser check |
| Form reset: going lighter on purpose to fix technique (about 20% under the old working weight, full range, lowered under control, ~2 reps in reserve; the first set sets the rest). Goals, stall checks, plan reviews, strength levels and PRs then count only clean-form sessions; old sessions stay in history, faded on the chart | Growth comes from tension on the target muscle through a full range of motion: full-range training builds as much or more muscle than partial reps, especially at long muscle lengths, so a lighter clean set is not lost progress | Pallarés et al. 2021; Wolf et al. 2023 (range-of-motion meta-analyses); Schoenfeld & Grgic 2020. The 20% start is practical, corrected by your first set | Moderate (ROM); practical (start weight) | `formreset.test` |
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

## Diet phase

| Rule | Why | Evidence | Strength | Checked by |
|---|---|---|---|---|
| You pick Bulking, Maintaining or Cutting; the app suggests a switch when 4+ weigh-ins over 3+ weeks show a clear trend (gaining or losing 0.25%+ of bodyweight a week, or within 0.15% for maintaining) | A calorie deficit limits muscle gain much more than strength; cuts that keep muscle usually lose about 0.5-1% a week | Murphy & Koehler 2022; Helms et al. 2014 | Moderate | `rest.test` |
| On a cut, matching your last session counts as success: holding a lift is never called a stall, and the block review keeps volume instead of adding sets | In a deficit, keeping strength and muscle is the realistic goal and recovery is limited | Murphy & Koehler 2022; Helms et al. 2014 | Moderate | `rest.test`, `planner.test` |

## Form tips

The How to sheet and form cues are checked separately: see [form-sources.md](form-sources.md).

## What the app does not claim

- Exact set numbers are averages; the block review adjusts them to you.
- The 10-sets-per-session limit comes from a preprint; it matches older work but may be refined.
- Rules marked Practical are conventions, kept conservative, and listed so they can be revisited.
