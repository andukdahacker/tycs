---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - '_bmad-output/analysis/brainstorming-session-2026-02-21.md'
  - '_bmad-output/planning-artifacts/research/market-cs-learning-webapp-research-2026-02-21.md'
  - '_bmad-output/planning-artifacts/research/technical-cs-learning-webapp-research-2026-02-21.md'
date: 2026-02-21
author: Ducdo
---

# Product Brief: tycs

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

tycs is a CS foundations learning webapp that teaches working software engineers to build real systems — databases, interpreters, OS components — through a "mega-project spine" approach with AI-guided Socratic tutoring. Instead of reading textbooks or watching lectures, learners build ONE ambitious project (starting with "Build Your Own Database") that naturally spans 7 of 9 core CS subjects. Every concept is encountered because you need it for your build, not because a syllabus says so.

The product targets the 45-55% of the self-taught developer education market that is currently underserved: working engineers who are too advanced for Codecademy, too practical for MIT OpenCourseWare, and want more depth than LeetCode. With 82% of developers being at least partially self-taught and teachyourselfcs.com receiving over 1M visits annually, there is clear demand for a structured, interactive path through CS foundations — but no existing platform combines project-based depth, AI tutoring, and real-world system comparison in one experience.

---

## Core Vision

### Problem Statement

Self-taught software engineers who want to learn CS foundations face a fundamentally broken learning landscape. The current approach — dense academic textbooks, passive video lectures, and fragmented resources scattered across 4-7 platforms — produces completion rates of 3-15% and a 60-70% dropout rate at the first major difficulty wall. Working engineers juggling full-time jobs have limited cognitive bandwidth, yet existing resources demand exactly the kind of sustained, abstract study that fails after a full day of professional coding.

The core failure is a disconnect between theory and practice. Learners hit concepts like B-trees, virtual memory, or transaction isolation and ask "why does this matter?" — because nothing in their learning experience connects these abstractions to the real systems they use daily. Without feedback, support, or visible progress, motivation follows a predictable decay curve: high enthusiasm in weeks 1-2, sporadic effort by month 2, and abandonment by month 4.

### Problem Impact

- **Career ceiling:** Self-taught engineers hit walls in system design discussions, performance optimization, and architecture decisions — limiting advancement to senior and staff roles
- **Interview failure:** Technical interviews at top-tier companies disproportionately test CS fundamentals, creating a gatekeeping barrier for non-CS-degree holders
- **Imposter syndrome:** 38% of professional developers lack a CS degree and report feeling insecure when CS-degreed colleagues discuss fundamentals
- **Wasted effort:** Developers cycle through "tutorial hell" — starting and abandoning 2-4 resources before giving up entirely, investing hundreds of hours with nothing to show

### Why Existing Solutions Fall Short

| Solution | What It Gets Right | Where It Falls Short |
|---|---|---|
| **teachyourselfcs.com** | Opinionated, comprehensive | Static reading list — no interactivity, no support, intimidating 1000-2000 hour scope |
| **CodeCrafters** | "Build your own X" concept | No teaching content, no AI guidance, isolated projects without connecting narrative, pass/fail only |
| **Boot.dev** | Gamified, structured path | Exercise-based not project-based, shallow CS depth, gamification feels juvenile to experienced engineers |
| **LeetCode** | Interview prep dominance | Pattern memorization, not understanding. No connection to real engineering |
| **Coursera/MIT OCW** | Academic rigor | 5-7% completion rates, passive lectures, academic exercises, zero practical application |
| **Nand2Tetris** | Brilliant "build the whole thing" philosophy | Narrow scope (hardware only), dated tooling, no support |
| **The Odin Project** | Strong community, project-based | Web development focused, not CS foundations |

No existing platform combines: project-based depth + AI tutoring + real-world system comparison + progressive challenge in a single cohesive experience.

### Proposed Solution

tycs teaches CS foundations through building real systems. The core mechanic is the **mega-project spine** — one ambitious, long-running project (starting with "Build Your Own Database") that serves as the vehicle for learning multiple CS subjects simultaneously. Starting with a simple key-value store, learners progressively add B-tree indexing, a query parser, transactions, and networking — each iteration teaching new CS concepts through real engineering need.

**Core experience loop:**
1. **Zero-decision start** — open the app, press "Continue Building," and get a structured session with one clear next action
2. **Build with AI guidance** — a context-aware Socratic AI tutor that knows your code, your background, and your current milestone. It never gives direct answers — it asks guiding questions, connects concepts to what you already know, and suggests rabbit holes
3. **Compare to the pros** — after each implementation, compare your approach to how PostgreSQL, Redis, or SQLite solved the same problem. Not as "the right answer" but as a peer conversation about trade-offs
4. **Benchmark your system** — run standardized workloads against your implementation and watch performance numbers climb as your understanding deepens

The curriculum is invisible. There is no syllabus, no module list, no learning/building distinction. You are simply building a database, and CS concepts are the tools you pick up along the way.

### Key Differentiators

1. **Mega-project spine** — One ambitious project connecting all CS concepts vs. isolated exercises, disconnected courses, or static reading lists. Your database project naturally covers data structures, algorithms, operating systems, networking, databases, and distributed systems.

2. **Context-aware Socratic AI tutor** — An AI that knows your code, your background, and your current challenge. It asks questions instead of giving answers, explains like you're five when needed, and suggests rabbit holes based on your demonstrated interests. This is the scalable answer to "I'm stuck and there's no one to help."

3. **Trade-off explorer + "How the Pros Did It"** — After you implement a feature, compare your approach to real-world systems (PostgreSQL's B-tree, Redis's event loop, SQLite's page cache). No other platform teaches engineering judgment through direct comparison with production systems.

4. **Zero-decision start with session scaffolding** — Eliminates the decision paralysis and motivation decay that kills 60-70% of learning attempts. One button. One next action. Structured sessions (recall, build, compare, preview).

5. **Building IS the curriculum** — No separation between "lesson mode" and "project mode." Every concept is encountered because your build needs it, creating intrinsic motivation that abstract study cannot match.

---

## Target Users

### Primary Users

#### Persona 1: "The Knowledge Seeker" — Marcus, 29, Backend Engineer (3 years)

**Background:** Marcus taught himself to code through freeCodeCamp and The Odin Project, landed a backend role at a mid-size SaaS company, and writes Go services daily. He reads Hacker News religiously and has bookmarked teachyourselfcs.com three times. He bought CSAPP and SICP — both sit on his shelf with bookmarks at chapter 3.

**Motivation:** Genuine intellectual curiosity. He wants to understand *how things actually work* — why PostgreSQL chose B-trees, how his OS manages memory, what happens between his Go code and the CPU. He's not chasing a FAANG offer; he wants depth.

**Current pain:** He's tried the teachyourselfcs.com path twice. Both times he hit the wall around week 4 — dense textbook reading after a full workday, no feedback, no one to ask when stuck. He tried watching Berkeley OS lectures on YouTube but fell asleep. He knows the knowledge is out there but can't find a way to absorb it that fits his life.

**What makes him say "this is exactly what I needed":** Opening tycs after dinner, pressing "Continue Building," and spending 45 minutes adding a buffer pool to his database — learning OS memory management because his build needs it, not because a syllabus says so. The AI tutor asks him "what happens if two threads try to flush the same dirty page?" and he realizes he just learned concurrency control through his own code.

**Represents:** ~25-30% of addressable market. Medium willingness to pay ($15-40/month). Already wants depth — just needs the right vehicle.

---

#### Persona 2: "The Career Upgrader" — Priya, 32, Frontend Developer (5 years)

**Background:** Priya has a bootcamp certificate and five years of React experience. She's senior at her company but keeps getting passed over for Staff Engineer — the feedback is always "needs stronger systems thinking." Her team lead, who has a CS degree, casually references CAP theorem and B-tree indexes in design reviews. Priya nods along.

**Motivation:** Career advancement. She wants to move from frontend into platform engineering or infrastructure. She knows she needs CS fundamentals to be taken seriously in system design discussions and to pass the technical bar at companies she's targeting.

**Current pain:** She subscribed to Educative for Grokking the System Design Interview but it felt like memorizing patterns, not building understanding. She tried Boot.dev but the gamification felt patronizing. She considered going back to school part-time but the cost and time commitment are prohibitive while working full-time and managing family obligations.

**What makes her say "this is exactly what I needed":** After 6 weeks on tycs, she's built a working key-value store with B-tree indexing. In her next design review, when her team lead asks "how would you index this?" she answers from *experience* — "well, when I built my B-tree, the trade-off between node size and cache line alignment was..." Her lead is genuinely impressed.

**Represents:** ~20-25% of addressable market. High willingness to pay ($30-80/month, often employer-funded). Pragmatic — needs career-relevant depth.

---

#### Persona 3: "The Eager Leveler" — Jake, 26, Junior Full-Stack Developer (1.5 years)

**Background:** Jake graduated from a coding bootcamp 18 months ago and landed his first role at a startup. He can build CRUD apps and ship features, but he knows his foundations are thin. He doesn't yet have the scars of failed learning attempts — he's eager and optimistic, and he wants to level up *before* he hits the ceiling.

**Motivation:** Proactive career investment. He saw senior engineers on his team debugging performance issues by reasoning about memory layouts and cache behavior, and thought "I want to be able to do that." He's not in pain yet — he's investing early.

**Current pain:** He doesn't know where to start. The teachyourselfcs.com reading list is intimidating — 1,000+ hours feels impossible. LeetCode makes him feel dumb. He's bought two Udemy courses on algorithms that he abandoned after the third video. He needs a path that meets him where he is and builds him up progressively.

**What makes him say "this is exactly what I needed":** The zero-decision start removes his paralysis. He doesn't have to choose a textbook, a language, or a subject — he just presses "Continue Building." The AI tutor detects when he's missing prerequisite knowledge and offers 15-minute just-in-time detours, so he never feels lost. After 3 weeks, he's built something real and his confidence has shifted from "I should learn CS" to "I am learning CS."

**Represents:** ~15-20% of addressable market. Medium willingness to pay ($15-30/month). High engagement potential — fewer failed attempts means less skepticism.

---

### Who We Are NOT Building For (v1)

**Interview Preppers seeking speed over depth.** Developers who want to pass a FAANG interview in 30 days are better served by LeetCode and AlgoExpert. tycs builds deep understanding over months — the mega-project approach is deliberately slower than pattern drilling. A subset of preppers who want lasting understanding may find tycs, but we do not optimize for the "cram and pass" workflow.

**Complete beginners who can't yet code.** tycs assumes you can write working code in at least one language. The mega-project requires reading and writing real programs from day one. Beginners should start with The Odin Project or freeCodeCamp and come to tycs when they have 1+ years of coding experience.

**Academic CS students seeking course credit.** tycs does not map to university syllabi, produce graded assignments, or offer accredited certificates. Students supplementing formal education may benefit, but the product is designed for working professionals, not academic contexts.

---

### Secondary Users

#### "The Imposter Syndrome Sufferer" (Subset)

Working developers who feel like frauds because they lack a CS degree. The zero-decision start and visible progress (benchmark numbers climbing, a working database growing feature by feature) powerfully addresses imposter syndrome. This segment needs extra care in onboarding — the mega-project concept can feel intimidating, so the first session must deliver an immediate win (see User Journey: Onboarding).

#### Future Expansion: B2B — Engineering Team Leads

As tycs matures, engineering managers who want to upskill their teams become a deliberate B2B expansion target. A team building the same mega-project, discussing trade-offs, and reviewing each other's implementations is a compelling team learning experience. Market data shows employer-funded learning budgets average $1,000-2,500/year per developer — Priya's "Career Upgrader" segment is frequently employer-funded. B2B team pricing (following the Educative/Pluralsight model) represents the highest-margin revenue path and should be planned as a Phase 3+ initiative, not an afterthought.

---

### User Journey

#### Discovery
- **Organic search:** Marcus googles "learn CS foundations for self-taught developers" and finds tycs. The landing page speaks his language instantly — "Build a database. Learn 7 CS subjects. No textbooks." — and he's in.
- **Social proof:** Priya's colleague shares a benchmark screenshot on Slack: "My B-tree just hit 25K inserts/sec." She asks how, and he points her to tycs.
- **Community word-of-mouth:** A Hacker News post ("I built a database from scratch and accidentally learned 7 CS subjects") generates discussion. Jake sees it shared in his bootcamp alumni Discord.

#### Onboarding: The Immediate Win (First 15 minutes)

This is the make-or-break moment. The goal is to defeat the intimidation of "You're going to build a database" by delivering a visceral success within the first 5 minutes.

1. **Sign up** — brief background questionnaire (role, experience, languages, curiosity areas)
2. **The pitch** — "You're going to build a database. By the time you're done, you'll understand how PostgreSQL, Redis, and SQLite work — because you'll have built your own."
3. **Immediate win** — Before any fear takes hold, the first micro-milestone launches: "Write a key-value store in 10 lines." The learner writes simple code, runs it, and sees: *"1,000 key-value pairs written to disk. You just built the beginning of a database."* The emotional shift from "I can't do that" to "wait, I just DID that" is engineered into the first 5 minutes.
4. **Zero decisions** — the editor loads, the milestone brief appears, and the AI tutor greets them. No navigation required, no choices to make.

#### Core Usage (Weekly rhythm)
- 3-5 sessions per week, 30-60 minutes each
- Each session: open app → "Continue Building" → recall challenge from last session → build toward current milestone → compare approach to pros → preview what's next
- AI tutor is always available — asks Socratic questions when stuck, never gives direct answers
- Micro-learning moments between sessions: quick concept recall cards, "explain this back" challenges

#### The Stuck Moment (Week 3-4 — The Critical Intervention)

This is where 60-70% of learners abandon other platforms. tycs handles it differently through **The Stuck Advisor**:

- **Detection:** The system monitors pace, error rate, and time-on-task. When a learner is stuck for >10 minutes without progress, it intervenes proactively.
- **Three paths offered:**
  1. **Push through with a different angle** — the AI tutor reframes the problem, offers a simpler analogy, or suggests approaching the same concept from a different direction
  2. **Skip with a bookmark** — move forward and come back later. The skipped concept is bookmarked and woven back in when it naturally resurfaces in a future milestone
  3. **Take a lateral path** — a 15-minute detour into a related but different concept that builds prerequisite understanding, then return to the original challenge
- **Key design principle:** Being stuck is treated as a first-class navigation event, not a failure state. The product acknowledges frustration and offers structured choices instead of leaving the learner alone with their confusion.

#### Success Moment ("Aha!")
- **First benchmark run:** Seeing their key-value store handle 1,000 reads/sec and knowing they built every line
- **First "How the Pros Did It" comparison:** Realizing their B-tree implementation is structurally similar to SQLite's — they independently arrived at a real engineering solution
- **First cross-subject connection:** The AI tutor surfaces "you just used 3 CS subjects in this milestone and didn't even notice" — the invisible curriculum reveals itself

#### Long-term (Months 3+)
- Database project is genuinely usable — runs a real app, not just passes tests
- Portfolio artifact with documented architecture decisions and benchmark results
- Concepts encountered months ago resurface through spaced repetition woven into current milestones
- Considering the second mega-project track (interpreter or distributed KV store)
- Sharing benchmark screenshots and "How I Solved It" writeups with the community

---

## Success Metrics

### User Success Metrics

These measure whether tycs is creating real value for learners — the outcomes that matter.

| Metric | What It Measures | Target | Why It Matters |
|---|---|---|---|
| **Milestone completion rate** | % of users who complete their first mega-project milestone | >60% (vs. 3-15% MOOC baseline) | The mega-project spine thesis lives or dies here. If building beats reading, completion should be dramatically higher. |
| **Week 4 retention** | % of users still active at week 4 | >50% | This is where 60-70% drop off on other platforms. The Stuck Advisor and project-based motivation should bend this curve. |
| **Weekly session consistency** | % of active users with 3+ sessions/week | >40% | Consistent practice drives retention. The zero-decision start and session scaffolding exist to drive this number. |
| **Benchmark improvement** | Average performance improvement across a user's first 5 milestones | Measurable upward trend | Users seeing their system get faster proves they're learning. This is the visceral "it's working" signal. |
| **Concept retention score** | % of spaced repetition recall challenges answered correctly | >70% after 30 days | Validates that building-as-learning produces durable understanding, not just short-term task completion. |
| **Stuck Advisor resolution rate** | % of stuck moments resolved without abandonment | >80% | Directly measures whether the three-path intervention (reframe, skip, lateral) keeps learners moving. |
| **Time to first "Aha!"** | Median time from signup to first benchmark run | <30 minutes | The onboarding immediate win must deliver a visceral success fast. |

### Business Objectives

**3-Month Objectives (MVP validation):**
- Launch the "Build Your Own Database" track with 5+ milestones
- Acquire 100 active users (organic + Hacker News / Reddit)
- Validate the core thesis: milestone completion rate >40% (3x MOOC baseline)
- Per-user infrastructure cost at or below $0.65/month (per technical research projections)

**12-Month Objectives (Product-market fit):**
- 1,000+ active monthly users
- Week 4 retention >50%
- Paying conversion rate >5% of free users
- Monthly recurring revenue (MRR) of $5,000+
- Community generating organic content (benchmark screenshots, "How I Solved It" writeups, HN/Reddit discussions)
- Second mega-project track in development (interpreter or distributed KV store)

**24-Month Objectives (Growth):**
- 10,000+ active monthly users
- B2B pilot with 2-3 engineering teams
- Infrastructure cost per user declining toward $0.30/month at scale
- MRR of $30,000+
- Recognized in developer communities as the go-to platform for CS foundations through building

### Key Performance Indicators

**Leading Indicators (predict future success):**

| KPI | Measurement | Target | Frequency |
|---|---|---|---|
| **Onboarding completion** | % of signups who complete first micro-milestone | >80% | Weekly |
| **Session starts per user/week** | Avg "Continue Building" presses per active user | 3+ | Weekly |
| **AI tutor engagement** | % of sessions with at least one AI tutor interaction | >60% | Weekly |
| **"How the Pros Did It" views** | % of milestone completions that view the comparison | >50% | Per milestone |

**Lagging Indicators (confirm success):**

| KPI | Measurement | Target | Frequency |
|---|---|---|---|
| **Full track completion** | % of users who complete all milestones in a mega-project | >15% (vs. 3-7% MOOC baseline) | Quarterly |
| **Net Promoter Score (NPS)** | Survey: "How likely are you to recommend tycs?" | >50 | Quarterly |
| **Organic referral rate** | % of new users from word-of-mouth / shared content | >30% | Monthly |
| **Churn rate (paid users)** | Monthly paid user cancellation rate | <8% | Monthly |

**North Star Metric:**

**Milestones completed per week (across all users).** This single number captures user engagement, content quality, Stuck Advisor effectiveness, and product-market fit. If milestones completed per week is growing, the product is working.

### Anti-Metrics (What We Deliberately Do NOT Optimize For)

- **Time spent in app** — We want efficient learning, not addictive engagement. A 30-minute session that completes a milestone is better than a 2-hour session that goes in circles.
- **Number of AI tutor messages** — More messages could mean the tutor is failing to scaffold effectively. Quality of interactions matters more than quantity.
- **Signup count without activation** — Vanity metric. Only users who complete the first micro-milestone count as acquired.

---

## MVP Scope

### Core Features

**1. "Build Your Own Database" Track — 5 Milestones (Go)**

The mega-project spine that IS the curriculum. Each milestone teaches CS concepts through real engineering need:

| Milestone | What You Build | CS Concepts Encountered |
|---|---|---|
| 1. Simple KV Store | In-memory key-value store with disk persistence | File I/O, serialization, basic data structures |
| 2. Persistent Storage Engine | Write-ahead log, page-based storage | OS concepts (fsync, durability), buffer management |
| 3. B-Tree Indexing | Self-balancing B-tree for efficient lookups | Data structures, algorithms, cache-line awareness |
| 4. Query Parser | Basic SQL-like query language | Compilers/interpreters, parsing, AST construction |
| 5. Transactions | ACID transactions with isolation levels | Concurrency control, locking, crash recovery |

Each milestone includes: a clear brief with acceptance criteria, benchmark targets, and (for milestones 3-5) a "How the Pros Did It" comparison against SQLite/PostgreSQL.

**2. Progressive Scaffolding**

Milestones use decreasing scaffold levels to build confidence before demanding full autonomy:

| Milestone | Scaffold Level | What the User Writes |
|---|---|---|
| 1. Simple KV Store | ~80% starter code | Storage and retrieval functions |
| 2. Persistent Storage | ~60% starter code | WAL logic, page flush |
| 3. B-Tree Indexing | ~40% starter code | Insert/search/split operations |
| 4. Query Parser | ~25% starter code | Tokenizer and AST builder |
| 5. Transactions | ~15% starter code | Lock manager, commit/rollback |

This directly addresses onboarding intimidation — Jake (our "Eager Leveler" persona) won't freeze staring at an empty editor. He'll see structure and think "I can do this part."

**3. Integrated Build Environment**

- Monaco editor with milestone context and multi-file project support
- Server-side code execution via Docker containers on Railway
- Go toolchain with compilation output and runtime results streamed via SSE
- BullMQ job queue for execution management

**4. Context-Aware Socratic AI Tutor**

- Knows the current milestone, the learner's code, and their background questionnaire responses
- Asks guiding questions instead of giving direct answers
- Just-in-time 15-minute concept detours when prerequisites are missing
- Anthropic SDK with prompt caching and tiered model routing from day one
- Connects new concepts to what the learner already knows from professional experience

**5. Zero-Decision Start + Session Scaffolding**

- "Continue Building" as the singular primary action — no navigation, no syllabus
- Structured session flow: recall challenge from last session → build toward current milestone → compare approach to pros → preview what's next
- First session engineered for immediate win: complete a KV store from 80% starter code, see "1,000 key-value pairs written to disk" within 5 minutes

**6. Benchmark Runner**

- Standardized workloads per milestone (inserts/sec, reads/sec, range scans)
- Historical tracking with visible performance improvement over time
- Comparison baselines against reference implementations
- The visceral "my system is getting faster" signal that proves learning is happening

**7. "How the Pros Did It" — Milestones 3-5 Only**

- Side-by-side diff view (Monaco diff editor) of learner's approach vs. real-world systems
- SQLite as primary comparison target (open source, readable, well-documented)
- Framed as peer conversation about trade-offs, not "the right answer"
- Deferred from milestones 1-2 to reduce content authoring burden and validate core thesis faster

**8. Onboarding Background Questionnaire**

- 3 questions, ~60 seconds: current role, years of experience, primary language
- Feeds directly into AI tutor personalization from first interaction
- Lightweight — no barrier to entry, critical for tutor effectiveness

**9. Authentication + Progress Persistence**

- Firebase Auth (email/password, GitHub OAuth)
- Project state saved and resumable across sessions
- Milestone progress, benchmark history, and AI tutor conversation context persisted

### Out of Scope for MVP

| Deferred Feature | Rationale |
|---|---|
| Multiple mega-project tracks (interpreter, distributed KV, OS) | Nail the database track first — validate the core thesis before expanding |
| Gamification (Pokedex, concept evolution, open world map) | Cosmetic until the core learning loop works |
| Social features (implementation gallery, pair sessions, activity feed) | Need users first — premature without a community |
| Mobile optimization | Target users are working engineers building at a desktop |
| Team/B2B features | Phase 3+ initiative after individual product-market fit |
| Micro-learning between sessions (concept cards, recall outside the app) | Important for retention but not essential for MVP validation |
| Stuck Advisor peer-matching path | Keep AI reframe + skip-with-bookmark only; peer matching needs scale |
| Multiple starting languages (C, Rust) | Go first — lowest friction, fastest compilation, closest to target audience's daily work |
| Community features, content creation, portfolio export | Emerge naturally from content — defer until there's content to share |
| Spaced repetition system | Important but can be layered on after core loop is validated |
| "How the Pros Did It" for milestones 1-2 | Reduces content authoring burden; validate core thesis first, layer in comparisons |

### MVP Success Criteria

| Gate | Target | Decision Trigger |
|---|---|---|
| Milestone completion rate | >40% (3x MOOC baseline) | Validates mega-project spine thesis — if building beats reading, completion should be dramatically higher |
| Time to first "aha!" | <30 minutes from signup | Onboarding immediate win is working — users feel "I just built the beginning of a database" |
| Week 4 retention | >35% | The critical dropout window — if users survive week 4, the session scaffolding and AI tutor are doing their job |
| Active users (3 months) | 100 organic users | Validates market demand without paid acquisition |
| Per-user infrastructure cost | ≤$0.65/month | Technical architecture is economically viable |
| Qualitative signal | Users describe it as "better than reading a textbook" | Core value proposition resonates |

**Scale decision point:** If milestone completion >40% AND week 4 retention >35% after 100 users, proceed to expand milestones and add second track. If not, investigate and iterate on the core loop before adding scope.

### Future Vision

**Phase 2 (Months 4-6) — Deepen the Database Track:**
- Expand to 10+ milestones (networking layer, client protocol, simple optimizer, replication)
- Add the Stuck Advisor with all three paths (reframe, skip-with-bookmark, lateral detour)
- Spaced repetition woven into current milestones for concept retention
- Micro-learning moments between sessions (recall cards, "explain this back" challenges)
- "How the Pros Did It" comparisons added to milestones 1-2

**Phase 3 (Months 7-12) — Expand and Connect:**
- Second mega-project track: "Build Your Own Interpreter" (covering compilers, programming languages, type systems)
- Additional starting languages (C, Rust)
- Social layer: implementation gallery, "How I Solved It" writeups, benchmark sharing
- Community infrastructure and organic content generation

**Phase 4 (Year 2) — Platform and Scale:**
- B2B team learning (engineering teams building the same mega-project, discussing trade-offs)
- Third track: distributed KV store or OS components
- Gamification layer (concept collection, progress visualization, open world map)
- Multiple entry points by background (frontend dev starts with query parser, DevOps starts with storage engine)
- Content creation pipeline (export milestone journeys as technical articles)

**The 3-year vision:** tycs is the recognized platform where working engineers go to deeply understand computer science — not by studying, but by building. A community of builders who've each constructed their own database, interpreter, or OS component, and can reason about systems from first-hand experience.
