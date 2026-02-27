---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
classification:
  projectType: web_app
  domain: edtech
  complexity: medium
  projectContext: greenfield
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-mycscompanion-2026-02-21.md'
  - '_bmad-output/planning-artifacts/research/market-cs-learning-webapp-research-2026-02-21.md'
  - '_bmad-output/planning-artifacts/research/technical-cs-learning-webapp-research-2026-02-21.md'
documentCounts:
  briefs: 1
  research: 2
  brainstorming: 0
  projectDocs: 0
workflowType: 'prd'
---

# Product Requirements Document - mycscompanion

**Author:** Ducdo
**Date:** 2026-02-22

## Executive Summary

**mycscompanion** teaches working software engineers CS foundations by having them build a real database from scratch — progressing from a simple key-value store to a system with B-tree indexing, a query parser, and ACID transactions across 5 milestones.

**Target users:** Backend and full-stack engineers (1-5+ years experience) who skipped or forgot CS fundamentals and want durable systems knowledge without returning to textbooks or MOOCs.

**Differentiator:** Single-artifact progressive depth — one continuous database project teaches 7 CS subjects. Not isolated exercises (CodeCrafters), not gamified quizzes (Boot.dev), not lectures (Coursera). The learner's system measurably improves across milestones, with AI-guided Socratic tutoring and direct comparison to production code (SQLite, PostgreSQL).

**Tech stack:** React + Vite (webapp), Astro (landing page), Fastify (backend), Kysely + PostgreSQL, Turborepo monorepo, Railway deployment. AI tutor via Anthropic SDK. Code execution in Docker containers with Go toolchain.

**Business model:** Free MVP for validation. Paid tier at product-market fit (target: >5% free-to-paid conversion at 1,000 MAU).

## Success Criteria

### User Success

| Metric | Target | Rationale |
|---|---|---|
| Milestone 1 completion rate | >60% | Core thesis: building beats reading. 80% starter code + AI tutor should drive high completion on first milestone |
| Overall milestone completion rate | >40% (3x MOOC baseline) | Validates mega-project spine approach across increasing difficulty |
| Week 4 retention | >50% | Critical dropout window — Stuck Advisor and session scaffolding must bend this curve |
| Time to first "Aha!" | <30 minutes from signup | Onboarding immediate win: "1,000 key-value pairs written to disk" |
| Stuck Advisor resolution rate | >80% | AI tutor reframe + skip-with-bookmark keeps learners moving |
| Concept retention (spaced repetition) | >70% after 30 days | Building-as-learning produces durable understanding |
| Weekly session consistency | >40% of active users with 3+ sessions/week | Zero-decision start and session scaffolding drive habit formation |
| Completion-to-retention ratio | Users who complete milestone N return for N+1 at >70% rate | Completion without retention = delight problem, not difficulty problem |

**North Star Metric:** Milestones completed per week (across all users)

**Anti-Metrics (do NOT optimize):** Time spent in app, AI tutor message count, signup count without activation

### Business Success

| Timeframe | Targets |
|---|---|
| 3-month (MVP validation) | 100 organic users, milestone completion >40%, per-user infra cost ≤$0.65/month, "Build Your Own Database" track with 5 milestones live |
| 12-month (product-market fit) | 1,000+ MAU, week 4 retention >50%, >5% free-to-paid conversion, $5K+ MRR, second track in development |
| 24-month (growth) | 10,000+ MAU, B2B pilot with 2-3 teams, per-user cost declining toward $0.30, $30K+ MRR |

### Technical Success

| Metric | Target | Failure Signal |
|---|---|---|
| Code execution round-trip | <5s compilation, <10s benchmarks | >10% of submissions fail due to infra (not user errors) |
| AI tutor TTFT | <1 second | Tutor unavailable >5% of sessions |
| Platform uptime | 99% | Extended outages during peak learning hours (evenings/weekends) |
| Per-user infrastructure cost | ≤$0.65/month at 100 users | Cost trajectory trending above $1/user at scale |
| AI content accuracy | User-validated through dogfooding | Curriculum errors reported by >10% of users on a single milestone |
| Content CI pipeline | Starter code compiles clean, reference implementation passes all acceptance criteria | Any milestone ships with broken scaffolds or unreachable benchmark targets |
| Benchmark reliability | Reference-normalized scoring (see NFR Reliability for details). ±5% variance in normalized ratio within a session. | Users see volatile benchmark numbers that undermine the "I'm improving" signal |

### Pre-Launch Gates

| Gate | Criteria | Time-Box |
|---|---|---|
| **Content validation (founder dogfood)** | Founder completes milestones 1-3 using AI-generated content, building a working database | 6-8 weeks max. If exceeded, content pipeline needs reworking |
| **Content CI** | All 5 milestone starter code compiles. Reference implementations pass acceptance criteria. Benchmark targets achievable. | Before each milestone goes live |
| **Milestone 1 polish bar** | Milestone 1 content reviewed 3x, tested end-to-end, first 15 minutes feel flawless | Before public beta — this is where trust is built or destroyed |

### Measurable Outcomes

**Scale Decision Point:** If milestone completion >40% AND week 4 retention >35% after 100 users → expand milestones and add second track.

**Pivot Triggers:**
- Milestone completion <20% after 100 users → increase scaffolding, simplify milestones, not the concept
- Week 4 retention <20% → survey dropouts to distinguish content quality vs. motivation failure
- Completion without return (>30% complete a milestone but don't start the next) → delight/motivation problem, not difficulty
- Zero organic signups after 3 months live → revisit positioning and messaging
- Kill signal: all three metrics fail AND qualitative feedback says "no better than a book"

See **Time-Boxed Decision Points** in Project Scoping for the 4-month forced go/no-go framework.

## Product Scope

The following scope boundaries define what ships in MVP versus what gets built later. Hard MVP items are non-negotiable for launch. Soft MVP items can slip if content authoring bottlenecks.

### MVP - Minimum Viable Product

**Hard MVP (cannot slip):**
- "Build Your Own Database" track — 5 milestones (Simple KV Store through Transactions)
- Progressive scaffolding (80% → 15% starter code across milestones)
- Integrated build environment (Monaco editor, server-side Go compilation via Docker)
- Context-aware Socratic AI tutor (Anthropic SDK, SSE streaming, basic context assembly)
- Zero-decision start + session scaffolding ("Continue Building" flow)
- Benchmark runner (standardized workloads per milestone, historical tracking) — extra investment in reliability
- Onboarding background questionnaire (3 questions, feeds AI tutor)
- Firebase Auth (email/password, GitHub OAuth) + progress persistence
- Content CI pipeline (starter code compiles, reference impl passes)

**Soft MVP (can slip to post-MVP if content authoring bottlenecks):**
- "How the Pros Did It" comparisons for milestones 3-5 (Monaco diff view vs SQLite/PostgreSQL)
- Milestones 4-5 can ship with lighter scaffolding than milestones 1-3

**Content Strategy:** AI-generated curriculum from locked source library, validated by founder dogfooding + content CI, with milestone 1 held to obsessively high polish bar

### Growth Features (Post-MVP)

- Expand to 10+ database milestones (networking, client protocol, optimizer, replication)
- Stuck Advisor with all three paths (reframe, skip-with-bookmark, lateral detour)
- Spaced repetition woven into milestones
- "How the Pros Did It" for all milestones
- Micro-learning between sessions (recall cards)
- RAG with pgvector for curriculum-grounded AI responses
- Paid tier (pricing model TBD — likely per-track or monthly subscription)

### Vision (Future)

- Second mega-project track: "Build Your Own Interpreter"
- Third track: distributed KV store or OS components
- B2B team learning (engineering teams building together)
- Multiple starting languages (C, Rust)
- Social layer (implementation gallery, benchmark sharing, "How I Solved It" writeups)
- Gamification layer (concept collection, open world map)
- Community infrastructure and organic content

## Content Strategy & Pipeline

### Source Library (locked)

- *Database Internals* — Alex Petrov (storage engines, B-trees, transactions)
- *Designing Data-Intensive Applications* — Martin Kleppmann (distributed systems, durability, concurrency)
- SQLite architecture documentation (primary comparison target, open source, readable)
- PostgreSQL internals documentation (secondary comparison target)
- *Build Your Own Database From Scratch in Go* — James Smith (practical implementation angle)

### Pipeline

AI generates milestone content (briefs, starter code, explanations, acceptance criteria, benchmark targets) from source library → Content CI validates compilability and reference implementation (FR44) → Founder dogfoods each milestone → Friction log captures UX improvements → Milestone ships.

### Founder Friction Log

During dogfooding, systematically capture:
- Every point of confusion, frustration, or delight
- Every "Explain Like I'm Five" re-explanation needed (signals default content is too dense)
- Every moment the starter code scaffold felt wrong or misleading
- Every "aha!" moment (signals content is working)

This becomes the UX improvement backlog and directly informs AI tutor prompt tuning.

## User Journeys

Seven narrative journeys that reveal product capabilities, edge cases, and operational requirements. The Journey Requirements Summary table at the end maps capabilities to MVP priority.

### Journey 1: Marcus — "The 11pm Database Builder" (Primary User, Success Path)

**Opening Scene:** It's 11:15pm on a Tuesday. Marcus just closed his laptop after 9 hours of writing Go services at work. He's on his couch, phone in hand, scrolling Hacker News. A post catches his eye: *"I built a database from scratch and accidentally learned 7 CS subjects."* He clicks. The landing page says: "Build a database. Learn CS. No textbooks." He's heard this kind of promise before — he has two unfinished textbooks on his shelf to prove it. But the screenshots show actual code, actual benchmark numbers. He signs up with GitHub OAuth. 30 seconds.

**Rising Action:** The onboarding asks three questions — role, experience, primary language. He picks "Backend Engineer, 3 years, Go." The app drops him straight into Milestone 1: Simple KV Store. He sees 80% starter code already in the editor. The brief says: "Write the Get and Put methods. When you're done, run the benchmark." He writes 15 lines of code. Hits run. The terminal streams: *"1,000 key-value pairs written to disk in 47ms."* He built the beginning of a database in 8 minutes. The AI tutor pops up: *"Nice. Your Put writes sequentially to a single file — what happens to read performance when you have 1 million keys?"* Marcus thinks for a second. He types back. The tutor doesn't answer — it asks another question. He's hooked.

**Climax:** Week 3. Marcus is deep in Milestone 3: B-Tree Indexing. His node split function has a bug — insertions work but range scans return garbage. He's been stuck for 20 minutes. The AI tutor notices and says: *"Your split is copying keys but not updating the parent pointer. Look at line 142 — what happens to the right child's first key after the split?"* Marcus stares at line 142. Sees it. Fixes it. Runs the benchmark: *"Range scan: 12,400 ops/sec (up from 0)."* He whispers "holy shit" to his empty apartment. Then the tutor says: *"Want to see how SQLite handles this same split? Their approach has a subtle difference in how they pick the split point."* He clicks "Show me." The diff view loads. His approach and SQLite's are structurally similar — but SQLite packs the left node more aggressively for sequential inserts. He just learned a real engineering trade-off from his own code.

**Resolution:** Month 3. Marcus has a working database with B-tree indexing, a SQL parser, and basic transactions. His benchmark dashboard shows a performance curve climbing across 5 milestones. He screenshots it and posts to his team's Slack: *"Built this from scratch over the last 3 months. Handles 25K inserts/sec."* His tech lead DMs him: *"Wait, you wrote a query parser? We should talk about the SQL optimization issue we've been stuck on."* Marcus grins. He didn't study for this conversation. He built for it.

### Journey 2: Priya — "The Staff Engineer Breakthrough" (Primary User, Career-Driven Path)

**Opening Scene:** Priya's in a 1:1 with her engineering manager. The feedback is familiar: *"Your frontend work is excellent, but for Staff level we need to see systems thinking. You need to be able to own architecture decisions end-to-end."* She nods. On the train home, she googles "learn systems engineering for frontend developers." The results are the usual: Educative system design courses (memorize patterns), MIT OCW (watch lectures), teachyourselfcs.com (read 9 textbooks). She's tried Educative — it felt like cramming flashcards. Then a Reddit thread recommends mycscompanion: *"It's not studying. You literally build a database. By the end you understand B-trees because you implemented one."*

**Rising Action:** Priya signs up. Background: "Frontend Developer, 5 years, TypeScript." The first milestone is in Go, which she's never written. She's nervous. But the 80% starter code is there, and the AI tutor says: *"Go's syntax will feel familiar coming from TypeScript. The big difference is explicit error handling — no try/catch. I'll flag Go-specific patterns when they come up."* She relaxes. By the end of Milestone 1, she's written 20 lines of Go and has a key-value store that persists to disk. It wasn't hard. It was... fun?

**Climax:** Week 6. Priya is in a design review at work. Her team is debating how to structure the database schema for a new feature. Her team lead asks: *"Should we add an index on this column? It's a range query."* Priya — who three months ago would have silently deferred — says: *"That depends on the read/write ratio. When I built my B-tree, the trade-off was that indexing speeds up reads but every write has to maintain the tree structure. If this table has heavy writes and rare reads, a sequential scan might actually be faster."* The room goes quiet. Her team lead says: *"That's... exactly right. Where did you learn that?"* She answers from experience, not from a textbook.

**Resolution:** Priya's next performance review includes the note: *"Demonstrated strong systems thinking in architecture discussions. Contributed meaningfully to infrastructure decisions. Ready for Staff."* She gets the promotion. She also has a working database on her GitHub — a portfolio piece that says more than any Grokking certificate.

### Journey 3: Jake — "The First Wall" (Primary User, Edge Case / Stuck Path)

**Opening Scene:** Jake saw a mycscompanion link in his bootcamp alumni Discord. He signed up immediately — he's the kind of person who starts things. Background: "Junior Full-Stack Developer, 1.5 years, JavaScript." Milestone 1 went great. Milestone 2 (persistent storage engine) was harder but he pushed through. Now it's week 3, Milestone 3: B-Tree Indexing. He's staring at a function signature — `func (t *BTree) insert(key []byte, value []byte)` — and he has no idea where to start. The 40% starter code isn't enough scaffold. He doesn't understand what a B-tree even IS, let alone how to implement one.

**Rising Action:** He's been stuck for 12 minutes. The AI tutor detects the stall and intervenes: *"Looks like you're thinking about this. Before we tackle the full insert, let me ask: you built a sorted array in Milestone 1. What happens to performance when that array gets really big?"* Jake types: "Searching gets slow because you have to check every element." The tutor: *"Exactly. A B-tree solves that by organizing keys into a tree structure where you can skip most of the data. Think of it like a phone book — you don't read every page, you jump to the right section. Here's how it works visually:"*

The tutor surfaces a **visual concept explainer** — an annotated diagram showing a B-tree with 3 levels. It walks through insertion step by step: key goes here, node is full, node splits, parent gets a new pointer. Each frame is a static annotated SVG with the current state highlighted and a one-sentence explanation. Not a video, not an animation — just clear diagrams Jake can study at his own pace. After 4 frames, he sees how splitting propagates up the tree. The tutor asks: *"Now look at your insert function. Which part handles the case where the leaf node is full?"*

**Climax:** Jake has a mental model now. He starts writing the insert function. It's wrong on the first try — his split logic doesn't handle the case where the root node needs to split. The tutor catches it: *"Your insert works for leaf nodes. But what happens when a leaf is full AND it's the root? Where does the new root come from?"* Jake thinks, looks back at the diagram, tries again. This time it works. Benchmark: *"1,000 random lookups in 3ms (down from 2,400ms with sequential scan)."* He screenshots it and sends it to the Discord: *"I just made my database 800x faster with a B-tree I wrote myself."*

**Resolution:** Jake didn't abandon at the wall. The Stuck Advisor reframed the problem, provided a visual concept explainer, and connected new knowledge to what he already built. He's now the most engaged he's ever been with any learning platform — because he's not studying, he's fixing his own system.

### Journey 4: Alex — "The Returning Dropout" (Edge Case, Re-engagement)

**Opening Scene:** Alex signed up for mycscompanion 4 months ago. He completed Milestone 1 and got halfway through Milestone 2 before life happened — a project deadline at work, then a vacation, then the guilt of not logging in made it easier to just... not. His mycscompanion tab has been closed for 3 months. Today he's scrolling Reddit and sees someone share their benchmark results from Milestone 4. He thinks: *"I was building that too."* He logs back in.

**Rising Action:** The app doesn't greet him with a guilt trip or a "welcome back after 97 days!" banner. It shows his database project exactly as he left it — Milestone 2, 60% complete, his code in the editor, his last benchmark results still visible. One button: "Continue Building." He clicks it. The app loads a **session summary** that was pre-computed and saved at the end of his last session 3 months ago: *"Last session: you were working on the write-ahead log. You had the append logic working (acceptance criteria 1-3 met). Remaining: implement the crash recovery function (criteria 4-5)."* The AI tutor picks up this summary as context: *"Welcome back. Looks like you were solid on the WAL append logic. The next piece is recovery — what should happen when the system crashes mid-write? Your function needs to replay the log."*

**Climax:** Within 15 minutes, Alex is productive again. He didn't have to re-read a textbook chapter. He didn't have to figure out where he was in a syllabus. His project was waiting for him — code state, milestone progress, and a pre-computed summary of where he left off. He finishes the recovery function, runs the benchmark, and sees his WAL delivering durability guarantees. The AI tutor says: *"Your database can now survive a crash. That's not trivial — you just implemented the same principle PostgreSQL uses."* Alex thinks: *"Why did I ever stop?"*

**Resolution:** Alex completes Milestone 2 that evening and starts Milestone 3 the next day. The zero-friction re-entry — no decisions, no guilt, just "here's your project, here's where you were" — is why he came back. Other platforms would have made him restart or navigate a course menu. mycscompanion just said "Continue Building."

**Technical Note:** Re-engagement context is achieved by pre-computing a session summary at the end of each session (stored as text in the database), not by expensive on-demand code analysis. The summary captures: milestone progress percentage, acceptance criteria met/unmet, and a natural-language description of what the user was working on. This summary is injected into the AI tutor's system prompt on re-engagement.

### Journey 5: Ducdo — "The Solo Founder Running the Machine" (Admin/Ops)

**Opening Scene:** It's Saturday morning. Ducdo checks his phone and sees a Sentry alert: execution worker response times spiked to 15 seconds overnight. He opens the Railway dashboard. The execution worker is running hot — a user submitted code with an infinite loop that bypassed the timeout. The container ate memory until Railway killed it, but the BullMQ job is stuck in a failed state and blocking the queue.

**Rising Action:** Ducdo needs to: (1) clear the stuck job from the Redis queue, (2) check if other users were affected, (3) figure out why the 60-second timeout didn't kill the process, and (4) add a safeguard. He opens Bull Board (self-hosted on Railway, took 10 minutes to set up) and clears the stuck job. He checks the execution logs in Railway — two other users had submissions delayed by 3 minutes while the queue was blocked. He finds the bug: the user's code spawned a subprocess that the container timeout didn't track. He adds `--pids-limit` to the Docker run command and deploys.

**Climax:** Monday. Ducdo reviews the AI tutor conversation logs via Metabase (free tier, self-hosted on Railway, querying the PostgreSQL conversations table directly). He reads a conversation where the tutor gave a direct answer instead of asking a Socratic question — the user asked "what's a page cache?" and the tutor explained it flatly. Ducdo flags this as a prompt quality issue, adjusts the system prompt to be more aggressive about asking questions first, and adds this scenario to his prompt test cases. He also checks the weekly metrics in Metabase: 23 milestones completed, 4 new signups, 1 dropout at Milestone 3 (the B-tree wall, as predicted). He notes the dropout in his friction log and checks if the Stuck Advisor triggered — it didn't, because the user's pace didn't cross the stuck threshold. He adjusts the threshold from 10 minutes to 7 minutes for Milestone 3.

**Resolution:** Running mycscompanion at MVP scale is a solo ops job. Ducdo doesn't need a custom admin panel — he needs existing tools cobbled together effectively: Railway dashboard for infra, Bull Board for job monitoring, Metabase for analytics and conversation review, Sentry for error tracking. The platform works because one person can manage it with off-the-shelf tools. Custom admin tooling is a growth investment, not an MVP requirement.

**MVP Admin Toolkit:**
- Railway dashboard — infra monitoring, deploys, logs
- Bull Board (self-hosted) — BullMQ job monitoring, stuck job management
- Metabase (self-hosted, free) — analytics queries, AI tutor conversation review
- Sentry — error tracking, alerting
- PostgreSQL direct queries — ad hoc investigation

### Journey 6: Sam — "The Skeptical HN Reader" (Pre-User, Conversion)

**Opening Scene:** Sam is a senior engineer at Stripe with a CS degree from Berkeley. He's scrolling Hacker News on his lunch break and sees: *"Show HN: I built a platform where you build a database to learn CS."* He clicks with maximum skepticism. He's seen CodeCrafters (cool but no teaching), Boot.dev (too gamified), and a dozen "learn by doing" pitches that turned out to be tutorials with extra steps. His internal monologue: *"This is probably vaporware or another 'build a toy Redis in 30 minutes' thing."*

**Rising Action:** The landing page loads. No "AI-powered learning revolution" marketing fluff. Instead: a screenshot of actual code in a Monaco editor, a benchmark output showing B-tree performance, and a one-liner: *"Build a database from scratch. Learn 7 CS subjects. Guided by AI, compared to the pros."* Below that: a concrete milestone list (KV Store → Storage Engine → B-Tree → Query Parser → Transactions) with "CS Concepts Encountered" for each. Sam thinks: *"Okay, this is specific."* He scrolls to "How the Pros Did It" — a diff view showing a user's B-tree split vs. SQLite's actual implementation. His skepticism cracks. He's never seen a learning platform that compares your code to production systems.

**Climax:** Sam clicks "Start Building." He doesn't sign up yet — he wants to see the first milestone. The page shows Milestone 1: Simple KV Store with the 80% starter code visible. The brief is clear, the acceptance criteria are specific, and the benchmark targets are concrete. He sees a benchmark result from another user: *"25,412 inserts/sec."* Competitive instinct kicks in. He signs up with GitHub OAuth.

**Resolution:** Sam isn't the target user (he already has a CS degree), but he becomes an evangelist. After completing Milestone 1 in one sitting, he posts a comment on the HN thread: *"This is legit. The starter code scaffolding is smart, the AI tutor actually asks Socratic questions instead of giving answers, and the SQLite comparison blew my mind. It's what CodeCrafters should have been."* That comment drives 15 signups. Word of mouth is the acquisition engine, and Sam — the skeptic turned advocate — is the fuel.

**Note:** The landing page is Hard MVP but sequenced late — build the product first, build the landing page the week before the HN launch. Don't spend sprint 1 on marketing when there's nothing to market.

### Journey 7: Taylor — "The Wrong Fit" (Edge Case, Graceful Redirect)

**Opening Scene:** Taylor is 3 months into learning to code. She finished a few freeCodeCamp modules and can write basic JavaScript — loops, functions, simple DOM manipulation. She saw a mycscompanion ad on Reddit that said "learn CS by building" and thought it sounded perfect. She signs up. Background questionnaire: "Student, <1 year experience, JavaScript."

**Rising Action:** The onboarding detects from her background that she has less than 1 year of experience and no familiarity with compiled languages. Instead of dropping her into Milestone 1 and letting her drown, the app shows a **skill floor check** — a brief, friendly message: *"mycscompanion is designed for developers with 1+ years of coding experience who are comfortable writing programs in at least one language. The projects involve building systems in Go, which assumes you can read and write working code independently."* Below that, a short code comprehension check — not a test, just 2-3 questions like "What does this Go function return?" with multiple choice answers. It's designed to be passable by anyone who can read code, not to gatekeep.

**Climax:** Taylor looks at the Go snippet and doesn't recognize the syntax. She picks a wrong answer. The app doesn't say "you failed" — it says: *"It looks like Go might be new territory. That's totally fine — here are some great resources to build your foundation first."* It recommends The Odin Project and freeCodeCamp with a specific message: *"Come back to mycscompanion when you've built a few projects and feel comfortable reading unfamiliar code. We'll be here."* It offers to save her email for a "ready to start" notification in 6 months.

**Resolution:** Taylor doesn't leave a 1-star review. She doesn't rage-quit at Milestone 1 wondering why she can't understand anything. She was redirected gracefully, felt respected, and has a clear path back. Six months later, she gets the email, has finished The Odin Project's JavaScript track, and signs up again — this time ready.

**Capabilities Revealed:**
- Background questionnaire triggers skill floor detection (<1 year experience)
- Lightweight code comprehension check (2-3 multiple choice, not a coding test)
- Graceful redirect with specific alternative recommendations
- Email capture for future re-engagement ("come back when ready")
- No negative framing — respect the learner's current stage

### Journey Requirements Summary

| Capability | Revealed By | MVP Priority |
|---|---|---|
| Zero-decision start / "Continue Building" | Marcus, Alex, Jake | Hard MVP |
| AI Socratic tutor + stuck detection | Marcus, Jake, Priya | Hard MVP |
| Benchmark runner + historical tracking | Marcus, Sam, Priya | Hard MVP |
| Progressive scaffolding (80%→15%) | Jake, Priya | Hard MVP |
| Session state persistence (code + progress) | Alex, Marcus | Hard MVP |
| Pre-computed session summaries for re-engagement | Alex | Hard MVP |
| Background questionnaire → AI personalization | Priya, Marcus, Taylor | Hard MVP |
| Fast frictionless signup | Marcus, Sam | Hard MVP |
| Code editing environment with project templates | All primary users | Hard MVP |
| Server-side code compilation + execution | All primary users | Hard MVP |
| Visual concept explainers (annotated diagrams) | Jake (Milestone 3 wall) | Hard MVP — static SVGs, not animations |
| Skill floor check + graceful redirect | Taylor | Hard MVP — protects NPS |
| Landing page with concrete proof | Sam | Hard MVP, sequenced late (week before launch) |
| "How the Pros Did It" diff comparison | Marcus, Sam (landing page) | Soft MVP |
| Infra monitoring via existing tools | Ducdo | Hard MVP (Railway + Bull Board + Sentry) |
| Analytics via existing tools | Ducdo | Soft MVP (Metabase, can use direct SQL initially) |
| AI tutor conversation review | Ducdo | Soft MVP (Metabase or direct queries) |
| Stuck Advisor threshold configuration | Ducdo | Growth (hardcode for MVP) |
| Concept detour / lateral learning paths | Jake | Growth |
| Email capture for future re-engagement | Taylor | Growth (nice-to-have for MVP) |

## Domain-Specific Requirements

### Privacy & Data Protection

- **GDPR consideration:** Users in EU/EEA have rights over their personal data (code submissions, AI conversations, learning progress). Addressed by FR40 (account deletion), FR41 (data export), FR42 (privacy policy).
- **Data stored:** User code, AI tutor conversation history, benchmark results, background questionnaire responses, session summaries. All tied to user identity.
- **No cookie consent banner needed** — only essential cookies (Firebase Auth session).

### Code Execution Security

- **Threat model:** Users submit arbitrary Go code. Risks: container escape, infinite loops, memory exhaustion, network abuse (exfiltration, crypto mining, attacking other services).
- **Upgrade path:** Firecracker microVMs for hypervisor-level isolation if the platform scales or a container escape is discovered.
- See **Non-Functional Requirements > Security** for specific mitigations and measurable targets.

### Content Accuracy

- **Risk:** AI-generated curriculum content could contain subtle technical errors (incorrect algorithm behavior, misleading performance claims, wrong comparisons to real-world systems).
- **Mitigation:** Content CI pipeline (FR44), founder dogfooding, friction log. Post-launch: user-reported error mechanism per milestone.

## Innovation & Novel Patterns

Six innovation areas that differentiate mycscompanion from existing CS learning platforms. Each includes a validation approach and fallback strategy.

### Detected Innovation Areas

**1. Single-Artifact Progressive Depth**
Teaching CS through progressive complexity within a single artifact. The database at milestone 5 is the same database from milestone 1, just better. This is distinct from project-based learning (CodeCrafters' isolated "build X" challenges) and exercise-based learning (Boot.dev's sequences). The innovation is that every CS concept — storage engines, data structures, parsing, concurrency — emerges naturally from deepening one system. Positioning language: "Build one database from simple to production-grade" — not "project-based learning."

**2. Context-Aware Socratic AI Tutor**
The combination of: (a) awareness of the user's actual code state, (b) awareness of their background and skill level, (c) Socratic questioning instead of direct answers, and (d) stuck detection that triggers intervention. No existing platform in systems programming education executes this specific combination.

**MVP scoping:** Tutor context is limited to the current milestone only — the user's current code, the milestone brief, and acceptance criteria. Cross-milestone references ("remember how you did X in milestone 2?") are pre-written hints baked into milestone content by the content author, not dynamically generated. This keeps the context window small, tutor responses focused, cost predictable, and UX reliable (pre-written references have 90%+ relevance vs. ~50% for dynamic). Dynamic cross-milestone context is a growth feature.

**3. Contextual Implementation Comparison ("How the Pros Did It")**
Embedding comparison to production code (SQLite, PostgreSQL) at the exact moment of relevance — right after the user gets their own implementation working. The innovation isn't the comparison itself (CodeCrafters users already browse GitHub manually), it's the timing and framing within the learning flow. The diff view showing your B-tree split next to SQLite's, immediately after yours works, teaches a second-order skill most platforms never touch: *how to read production code.*

**4. Benchmark Narrative Arc**
Using actual performance benchmarks (ops/sec, latency) as the primary learning feedback signal instead of grades, XP, badges, or completion percentages. The learner's system measurably improves — and the presentation tells a story. A trajectory visualization — milestone 1: 47ms per 1,000 writes → milestone 3: 3ms per 1,000 lookups → milestone 5: ACID transactions at 8,000 ops/sec — shows the database *growing up.* This is the emotional core of the product, the screenshot moment, and the sharing catalyst. Requires deliberate UX investment in presenting progression as a visual story (line chart with milestone labels), not just individual numbers in a terminal.

**5. Progressive Scaffolding Decay**
Starting at 80% starter code and decaying to 15% across milestones. This pattern exists in language learning (scaffolded reading) but hasn't been applied systematically to systems programming education.

**6. Anti-Metrics as Product Philosophy**
Explicitly refusing to optimize for time-in-app, session length, or streak counts. Every learning platform in edtech optimizes for engagement addiction. mycscompanion optimizes for milestones completed — actual learning outcomes. "We don't care how long you're in the app. We care that your database handles transactions." This is a genuinely contrarian position that directly addresses growing criticism of platforms like Duolingo and Codecademy optimizing for dopamine loops over durable skill building.

### Validation Approach

| Innovation | How to Validate | Fallback if It Doesn't Work |
|---|---|---|
| Single-artifact progressive depth | Milestone completion sustained across all 5 milestones (no cliff drop-off between milestones) | Break into independent "build X" challenges (become CodeCrafters with teaching) |
| Socratic AI tutor (current-milestone context) | Stuck Advisor resolution rate >80%, tutor engagement >60% of sessions | Simplify to hint system + direct explanations (less novel, still functional) |
| Contextual implementation comparison | User engagement with comparisons >50%, qualitative feedback on code-reading skill | Drop to post-MVP, doesn't block core learning loop |
| Benchmark narrative arc | Users reference/screenshot benchmark improvements, benchmark dashboard engagement >70% | Add traditional progress indicators (completion %, badges) as supplement |
| Scaffolding decay | Milestone completion doesn't cliff at the 40% scaffold level (milestone 3) | Flatten the decay curve (keep higher scaffolding longer) |
| Anti-metrics philosophy | Users report learning outcomes in feedback rather than engagement metrics | Monitor if lack of gamification hurts retention; add lightweight motivation mechanics if needed |

### Risk Mitigation

- **Single-artifact progressive depth:** Biggest risk is that users love milestone 1 but don't sustain through milestones 3-5. Mitigated by benchmark continuity — each milestone improves the same system, creating inherent narrative momentum.
- **Socratic AI tutor:** Prompt quality is fragile. Bad prompts turn Socratic questioning into annoying evasiveness. Mitigated by: tutor conversation review, iterative prompt tuning from friction log, and limiting context to current milestone only for focused responses.
- **"How the Pros Did It":** Depends on content curation quality — bad comparisons (wrong SQLite code, misleading PostgreSQL snippets) destroy trust. Mitigated by locked source library + manual review of each comparison. This is a labor-intensive content task per milestone.
- **Benchmark narrative arc:** Risk is benchmark volatility undermining the learning signal. Mitigated by reference-normalized scoring (see NFR Reliability) eliminating shared-infra noise.
- **Anti-metrics philosophy:** Risk is that without gamification mechanics, retention suffers compared to Boot.dev or Codecademy. Mitigated by the benchmark arc providing intrinsic motivation. Monitor week 4 retention closely — if it drops below 20%, consider adding lightweight motivation mechanics without compromising the anti-addiction stance.

## Web App Specific Requirements

Platform-specific technical decisions for the web application. Performance targets and accessibility requirements are consolidated in the Non-Functional Requirements section.

### Project-Type Overview

mycscompanion is a monorepo (Turborepo) with three packages under `/apps`:
- **`/apps/webapp`** — React + Vite SPA. The core learning platform (code editor, AI tutor, benchmarks, progress tracking).
- **`/apps/website`** — Astro static site. Landing page, marketing pages, blog (future). Optimized for SEO, fast LCP, and social sharing.
- **`/apps/backend`** — Fastify API server. Handles auth, code execution orchestration, AI tutor, data persistence.

Deployed on Railway. Shared packages (types, utilities, config) live in `/packages`.

### Core Views (Page Inventory)

- **Landing page** (`/`) — Value proposition, milestone preview, signup CTA (Astro)
- **Onboarding flow** — Background questionnaire → skill floor check → first milestone (webapp)
- **Milestone workspace** — Primary screen. Code editor + AI tutor panel + benchmark output. Logged-in users land here directly. (webapp)
- **Benchmark trajectory** — Cross-milestone performance visualization. Accessible from workspace. (webapp)
- **Progress overview** — Milestone list with completion status, acceptance criteria met/unmet. (webapp)
- **"How the Pros Did It"** — Diff view comparing user implementation to SQLite/PostgreSQL. (webapp, Soft MVP)
- **Account settings** — Profile, data export, account deletion. (webapp)
- **Privacy policy** — Static page. (Astro or webapp)
- **Graceful redirect** — Alternative resource recommendations for wrong-fit users. (webapp)

### Browser Support Matrix

| Browser | Support Level | Notes |
|---|---|---|
| Chrome (latest 2) | Full | Primary target — ~65% of developer audience |
| Firefox (latest 2) | Full | Secondary — ~15% of developer audience |
| Safari (latest 2) | Full | Required for Mac-primary developer segment |
| Edge (latest 2) | Full | Chromium-based, minimal additional effort |
| Mobile Safari / Chrome | Functional | Readable, navigable — but code editing is degraded on mobile. No effort spent optimizing Monaco for touch. |
| IE11, legacy browsers | Not supported | Monaco editor requires ES2020+. No polyfills. |

### Responsive Design

| Viewport | Experience | Priority |
|---|---|---|
| Desktop (1280px+) | Full experience — side-by-side editor + AI tutor, benchmark dashboard, diff view | Primary |
| Tablet landscape (1024px) | Functional — stacked layout, editor still usable | Secondary |
| Tablet portrait / Mobile (<768px) | Read-only — can review progress, read milestone briefs, view benchmarks. Cannot meaningfully edit code. | Minimal |

**Recommendation:** Don't invest in mobile code editing for MVP. The core use case is a developer on a laptop. A mobile user should be able to check their progress and read the AI tutor's last message, but actual coding happens on desktop.

### Performance Targets

See **Non-Functional Requirements > Performance** for the full performance targets table with measurement methods and failure signals.

**Code splitting strategy:** Monaco editor (~2MB uncompressed) is lazy-loaded — only when the user enters the code editing view. The Astro landing page ships near-zero JavaScript by default.

### SEO Strategy

| Page | Package | Approach | Rationale |
|---|---|---|---|
| Landing page (`/`) | `/apps/website` | Astro static build | Must rank for discovery keywords. Fast LCP, meta tags, structured data, OG images. |
| Marketing pages (`/about`, `/pricing`) | `/apps/website` | Astro static build | Indexable, shareable |
| Blog/content (future) | `/apps/website` | Astro content collections | Growth channel for organic search |
| App pages (`/learn/*`, `/milestones/*`) | `/apps/webapp` | SPA, noindex | Behind auth. No SEO value. Pure client-side rendering. |

**Routing between packages:** The website and webapp are separate deployments on Railway. The website lives at the root domain (e.g., `mycscompanion.dev`). The webapp lives at a subdomain (e.g., `app.mycscompanion.dev`). Subdomain is simpler — avoids path routing complexity between two separate services.

**Open Graph priority:** Astro makes custom OG images straightforward. When Sam shares mycscompanion on HN or Slack, the preview card needs to show something compelling — a screenshot of the benchmark dashboard or code snippet. High-ROI, low-effort task baked into the Astro build.

### Accessibility

See **Non-Functional Requirements > Accessibility** for measurable targets and CI validation approach. Web-app-specific notes:
- Monaco: use built-in screen reader mode and keyboard navigation. Don't build custom.
- AI tutor chat: ARIA live regions for SSE streaming.
- Astro landing page: semantic HTML by default.

### Implementation Considerations

**Monorepo structure:**
```
/apps
  /backend    — Fastify API server
  /webapp     — React + Vite SPA
  /website    — Astro static site
/packages
  /shared     — Shared types, constants, utilities
  /config     — Shared ESLint, TypeScript, Tailwind config
```

**Database access layer:** Kysely (type-safe SQL query builder). Not a full ORM — you write SQL-like syntax with full TypeScript inference. Chosen over Drizzle ORM because the founder is learning databases; writing real SQL daily builds query intuition that an ORM abstraction would hide. Migrations managed manually or via `kysely-ctl`. Raw SQL is the default mode, not an escape hatch.

**State management (webapp):** React Query (TanStack Query) for server state (milestones, progress, benchmarks). Local React state or Zustand for UI state (editor content, panel layout). Avoid Redux.

**Offline behavior:** No offline support in MVP. Both webapp and backend require internet (code execution, AI tutor). Show clear "you need internet" message if offline.

**Error handling:** Distinguish user-code errors (expected, show in terminal) from platform errors (unexpected, friendly message + Sentry capture). Users should never see a raw platform stack trace.

**Session management:** Firebase Auth handles session tokens. Auto-refresh on tab focus after idle. No forced logout — if a user leaves a tab open for days, it should still work when they return (Alex's journey).

## Project Scoping & Phased Development

Detailed build sequencing, sprint planning, and risk mitigation for MVP delivery. Feature scope boundaries are defined in Product Scope; this section specifies the build order and decision framework.

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — validate that building a database from scratch is a viable learning path for working engineers. The smallest thing that proves the thesis: one complete track (5 milestones), one language (Go), one AI tutor, one user type (working backend/fullstack engineers).

**Sprint Duration:** 2-week sprints. Sprint 1 is allowed to stretch to 3 weeks for infrastructure setup (Railway config, Docker networking, Firebase setup always has unknowns).

**Resource Requirements:** Solo founder (Ducdo). AI-assisted content generation. No external hires for MVP. Content pipeline runs parallel to code sprints.

### Build Sequencing

**Sprint 1 (Weeks 1-3): Foundation — "Code runs on the server"**

Day 1 de-risk: Get a "hello world" Go compilation working in Docker on Railway. Not the full benchmark runner — just `go build` + `go run` inside a container with resource limits. This validates the entire execution infrastructure path.

- Firebase Auth (email/password + GitHub OAuth)
- PostgreSQL schema (users, milestones, progress, submissions, sessions)
- Fastify API server scaffold with auth middleware
- Docker execution containers (Go toolchain, resource limits, `--pids-limit`, `--network=none`, timeout enforcement)
- BullMQ job queue for code submissions
- Basic API: submit code → queue → execute → return results
- Sentry integration

**Sprint 2 (Weeks 4-5): Learning Interface — "User can write and run code"**

- Monaco editor integration (lazy-loaded, ~2MB)
- Monaco fallback: raw textarea + terminal output mode. If Monaco integration stalls (lazy loading, accessibility), the content pipeline and dogfooding can proceed on the fallback. Monaco polish is Sprint 2-3, not a blocker.
- Milestone view (brief, acceptance criteria, starter code, benchmark targets)
- Code submission flow (editor → API → queue → Docker → results display)
- Basic progress persistence (milestone state, code snapshots)
- Zero-decision start / "Continue Building" flow

**Sprint 3 (Weeks 6-7): AI Tutor + Benchmarks — "The product differentiates"**

Gate: Milestone 1 content must be validated (compiles, reference impl passes, dogfood review complete) before Sprint 3 begins.

- AI tutor integration (Anthropic SDK, SSE streaming)
- Tutor context assembly (current milestone brief + user code + acceptance criteria + background)
- Socratic prompt engineering + stuck detection (7-minute threshold for Milestone 3, 10 minutes default)
- Benchmark runner (standardized workloads per milestone, historical tracking)
- Benchmark results display with milestone-over-milestone trajectory visualization
- Pre-computed session summaries (stored at end of each session for re-engagement)

**Sprint 4 (Weeks 8-9): Polish + Onboarding — "Ready for humans"**

- Background questionnaire (3 questions → AI tutor personalization)
- Skill floor check (code comprehension questions, graceful redirect for wrong-fit users)
- Visual concept explainers (static annotated SVGs for B-tree and key data structures)
- Onboarding flow (signup → questionnaire → skill check → Milestone 1)
- Session scaffolding and re-engagement flow (pre-computed summaries)
- Error handling polish (user-code errors vs. platform errors)
- Mobile responsive read-only mode

**Content Parallel Track (Weeks 1-9):**

| Content Milestone | Gate For | Deadline |
|---|---|---|
| Milestone 1 content draft (AI-generated from source library) | Founder dogfood start | End of Sprint 1 |
| Milestone 1 content validated (compiles, reference impl passes, dogfood review) | Sprint 3 start | End of Sprint 2 |
| Milestones 2-3 content draft | Continued dogfooding | End of Sprint 3 |
| Milestones 2-3 validated | Pre-launch | End of Sprint 4 |
| Milestones 4-5 content draft | Post-launch pipeline | Ongoing |

Content pipeline: AI generates from locked source library → Content CI validates → Founder dogfoods → Friction log → Ship.

**Pre-Launch (Week 10):**

- Landing page build (Astro, `/apps/website`) — one week, not earlier
- OG images and social sharing meta
- Founder completes milestones 1-3 dogfood
- Launch readiness checklist (see below)

### Launch Readiness Checklist

Before going live, the founder runs through this in 30 minutes:

- [ ] Milestone 1 content validated (3x review, end-to-end tested, first 15 minutes flawless)
- [ ] Auth working (email/password + GitHub OAuth, sign up → sign in → sign out)
- [ ] Code execution <10s round-trip (compilation + benchmark)
- [ ] AI tutor responding with Socratic questions (not direct answers)
- [ ] Landing page live with compelling OG card
- [ ] Sentry configured and capturing errors
- [ ] Privacy policy page live
- [ ] Benchmark results displaying with historical tracking
- [ ] Pre-computed session summary generating at end of session

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Marcus (primary success path) — fully supported
- Priya (career-driven path) — fully supported
- Jake (stuck path) — fully supported through AI tutor + visual explainers
- Alex (returning dropout) — fully supported through pre-computed session summaries
- Sam (skeptical HN reader) — supported through landing page + Milestone 1 preview
- Taylor (wrong fit) — supported through skill floor check + graceful redirect
- Ducdo (admin/ops) — supported through Railway + Bull Board + Sentry + direct SQL

**Must-Have Capabilities:**
All items from the Hard MVP list in Product Scope section, plus the build sequencing above.

### Post-MVP Features

**Phase 2 (Growth) — Trigger: milestone completion >40% AND week 4 retention >35% after 100 users.**
Features listed in **Product Scope > Growth Features**, plus: Metabase analytics dashboard, AI tutor conversation review tooling, configurable stuck detection thresholds, email capture for wrong-fit re-engagement, RAG with pgvector.

**Phase 3 (Expansion) — Trigger: 1,000+ MAU, >5% free-to-paid conversion.**
Features listed in **Product Scope > Vision**, plus: custom admin panel replacing cobbled-together tools.

### Time-Boxed Decision Points

**4 months post-launch — forced go/no-go on Phase 2:**

Regardless of user count, force a strategic review at 4 months. Possible outcomes:

| Scenario | Signal | Action |
|---|---|---|
| Strong signal | >100 users, metrics hit Phase 2 triggers | Begin Phase 2 development |
| Moderate signal | 50-100 users, metrics mixed | Double down on content quality + distribution, extend Phase 1 by 2 months |
| Weak signal | <30 users at 4 months | Acquisition strategy needs rethinking before building more features. Diagnose: content problem, distribution problem, or positioning problem? |
| No signal | <10 users, no organic growth | Revisit core thesis. Consider pivot triggers from Success Criteria. |

Do not let Phase 1 become 12-month limbo. The 4-month checkpoint forces the conversation.

### Risk Mitigation Strategy

**Technical Risks:**
- **Docker execution on Railway:** Highest risk item. Mitigated by day-1 de-risk (hello world Go compilation in container). Fallback: switch to Fly.io Machines if Railway container support is insufficient.
- **AI tutor prompt quality:** Socratic questioning can become annoying evasiveness with bad prompts. Mitigated by founder dogfooding, conversation review, iterative prompt tuning from friction log. Limiting context to current milestone only keeps responses focused.
- **Benchmark volatility:** Same code producing different numbers across runs undermines the "I'm improving" signal. Mitigated by reference-normalized scoring (see NFR Reliability) and extra reliability investment in Sprint 3.
- **Monaco integration complexity:** Lazy loading, accessibility, mobile degradation. Mitigated by raw textarea fallback — Monaco is a UX enhancement, not a functional blocker.

**Market Risks:**
- **Primary distribution:** HN Show launch + dev community seeding (Reddit r/programming, Twitter/X dev community, relevant Discord servers).
- **Backup distribution if HN underperforms:** Reddit r/programming and r/learnprogramming posts, Dev.to article series ("I'm building a database from scratch — here's what I learned"), Twitter/X thread with benchmark screenshots, direct outreach to CS education newsletters.
- **Positioning risk:** "Build a database to learn CS" might not resonate. Mitigated by landing page A/B testing (headline variants) and qualitative feedback from first 20 users.

**Resource Risks:**
- **Solo founder bottleneck:** Content authoring + code development + ops on one person. Mitigated by AI-assisted content generation, off-the-shelf admin tools (no custom admin panel), and aggressive scope control.
- **Content pipeline slower than expected:** If AI-generated content needs heavy manual rework, milestones 4-5 slip. Mitigated by milestones 4-5 being Soft MVP — can launch with 3 milestones and add more post-launch.
- **Fewer resources than planned:** Absolute minimum: 3 milestones (not 5), no visual explainers, no skill floor check. The product still works — it's just a smaller MVP. The 5-milestone version is the target, but the 3-milestone version is the floor.

## Functional Requirements

The capability contract for mycscompanion. 56 requirements across 8 capability areas. Every capability listed here will be designed (UX), supported (Architecture), and implemented (Epics). Capabilities not listed here will not exist in the product.

### Learning Experience

- **FR1:** Learner can view a milestone brief with learning objectives, acceptance criteria, and benchmark targets
- **FR2:** Learner can edit code in a browser-based code editor with syntax highlighting and project file structure
- **FR3:** Learner can start a milestone with pre-loaded starter code at the appropriate scaffolding level for that milestone
- **FR4:** Learner can submit code for compilation and execution and receive results in-browser
- **FR5:** Learner can view compilation errors, runtime output, and panic messages with sufficient detail to diagnose code issues
- **FR6:** System can automatically evaluate acceptance criteria against learner submission results
- **FR7:** Learner can view acceptance criteria status (met/unmet) after each submission
- **FR8:** Learner can complete a milestone when all acceptance criteria are met and advance to the next milestone
- **FR9:** Learner can view benchmark results after each submission with performance metrics (ops/sec, latency)
- **FR10:** Learner can view historical benchmark results across submissions within a milestone
- **FR11:** Learner can view a benchmark trajectory visualization across milestones showing their database improving over time
- **FR12:** Learner can view "How the Pros Did It" comparisons showing their implementation alongside production code (SQLite/PostgreSQL) in a diff view (Soft MVP)
- **FR13:** Learner can view visual concept explainers (annotated diagrams) for key data structures when relevant to the current milestone

### AI Tutoring

- **FR14:** Learner can converse with an AI tutor that responds with Socratic questions rather than direct answers
- **FR15:** Learner can receive AI tutor interventions that are aware of their current code state, milestone context, and acceptance criteria progress
- **FR16:** Learner can receive AI tutor responses personalized to their background (role, experience level, primary language)
- **FR17:** Learner can receive proactive AI tutor intervention when stuck (detected by inactivity threshold)
- **FR18:** Learner can receive tutor-surfaced visual concept explainers when struggling with a structural concept
- **FR19:** Learner can view AI tutor responses as they stream in real-time (not waiting for full response)

### Code Execution & Benchmarks

- **FR20:** System can compile and execute learner-submitted Go code in an isolated sandboxed environment
- **FR21:** System can enforce resource limits on code execution (CPU, memory, time, process count, network isolation)
- **FR22:** System can queue code submissions and process them in order with fair scheduling
- **FR23:** System can run standardized benchmark workloads against learner code and return consistent, reproducible results
- **FR24:** System can distinguish between user-code errors (compilation failures, runtime panics) and platform errors, surfacing each appropriately
- **FR25:** System can rate-limit code submissions per user to prevent execution abuse

### User Onboarding & Assessment

- **FR26:** Visitor can sign up using email/password or GitHub OAuth
- **FR27:** Visitor can sign in and have their session persist across browser sessions
- **FR28:** New user can complete a background questionnaire (role, experience, primary language) during onboarding
- **FR29:** System can detect potentially under-qualified users based on background questionnaire responses
- **FR30:** Potentially under-qualified user can complete a lightweight code comprehension check (multiple-choice, not a coding test)
- **FR31:** Under-qualified user can receive a graceful redirect with specific alternative learning resource recommendations
- **FR32:** Redirected user can optionally provide their email for future re-engagement notification (Growth — not Hard MVP)

### Progress & Session Management

- **FR33:** Learner can resume their project exactly where they left off (code state, milestone progress, last benchmark results)
- **FR34:** System can auto-save learner code state at regular intervals and on submission
- **FR35:** Learner can start or resume a session with a single action ("Continue Building") with no navigation decisions required. Logged-in learner lands directly on their active milestone workspace by default (no intermediate dashboard for MVP).
- **FR36:** System can generate and store a natural-language session summary at the end of each session capturing milestone progress, criteria met/unmet, and current work context
- **FR37:** Returning learner can view their pre-computed session summary as re-engagement context
- **FR38:** AI tutor can receive the session summary as context when a learner returns after absence
- **FR39:** Learner can view their overall progress across all milestones in the track

### User Account & Privacy

- **FR40:** User can delete their account and all associated data
- **FR41:** User can export their data (code submissions, progress, AI conversations) as a downloadable file
- **FR42:** Visitor can view a privacy policy page describing data collection and usage
- **FR43:** System can maintain user sessions with auto-refresh on tab focus after idle without forced logout

### Content Pipeline

- **FR44:** System can validate that milestone starter code compiles and reference implementation passes acceptance criteria
- **FR45:** System can serve milestone content structured as: brief, starter code at appropriate scaffolding level, acceptance criteria, benchmark targets, and concept explainer assets

### Marketing & Landing Page

- **FR46:** Visitor can view a landing page that communicates the product value proposition with concrete proof (code screenshots, benchmark outputs, milestone list)
- **FR47:** Visitor can preview Milestone 1 content (brief, starter code, acceptance criteria) before signing up
- **FR48:** Visitor can initiate signup directly from the landing page
- **FR49:** Landing page can render optimized Open Graph cards for social sharing (screenshot of benchmark or code)
- **FR50:** Landing page can be indexed by search engines with appropriate meta tags and structured data

### Administration & Operations

- **FR51:** Admin can monitor infrastructure health, deployments, and logs via external dashboard tooling
- **FR52:** Admin can view and manage queued/stuck/failed code execution jobs via external job monitoring tooling
- **FR53:** Admin can receive automated error alerts when platform errors occur
- **FR54:** Admin can review AI tutor conversation logs to assess prompt quality and identify tuning opportunities
- **FR55:** Admin can query analytics data (milestone completions, signups, retention, dropout points) via direct database queries or external analytics tooling
- **FR56:** System can load AI tutor prompts and stuck detection thresholds from external configuration

## Non-Functional Requirements

Quality attributes specifying HOW WELL the system performs. Each requirement is measurable with a defined failure signal. Review cadence specified in NFR Review Triggers.

### Performance

| Requirement | Target | Measurement | Failure Signal |
|---|---|---|---|
| Code compilation round-trip | <5 seconds | Time from submission to compilation result returned | >10% of submissions exceed 10s |
| Benchmark execution round-trip | <10 seconds | Time from submission to benchmark results returned (includes queue wait + Docker execution + reference run) | >10% of benchmark runs exceed 15s |
| AI tutor time-to-first-token | <1 second | Server-side: time from request to first SSE token sent | Tutor unavailable or >3s TTFT in >5% of sessions |
| Landing page LCP | <1.5 seconds | Lighthouse on 4G throttled (Astro static build) | LCP >2.5s on throttled connection |
| Webapp initial load (LCP) | <2.5 seconds | Lighthouse | LCP >4s |
| Webapp TTI | <3.5 seconds | Lighthouse | TTI >5s |
| Monaco editor ready | <1.5 seconds after app shell | Custom timing metric | Editor not interactive within 3s of shell load |
| Client-side route transitions | <200ms | Client-side measurement | Perceived jank or full-page reload |
| Landing page total JS | <50KB | Astro build output | JS bundle bloat defeats Astro's purpose |
| Webapp initial JS bundle | <500KB gzipped | Vite build output (Monaco lazy-loaded separately) | Bundle size creep above 750KB |
| Concurrent code executions | 10 simultaneous at MVP scale (100 users) | Load testing pre-launch | Queue backup causing >30s wait times |

### Security

| Requirement | Target | Rationale |
|---|---|---|
| Code execution isolation | Each submission runs in a disposable Docker container with: CPU limit, memory limit, 60s timeout, `--pids-limit`, `--network=none`, read-only filesystem (except designated output dir) | Users submit arbitrary Go code. Must prevent container escape, resource exhaustion, network abuse. |
| No persistent state in execution containers | Containers destroyed after each submission. No learner code persists in the execution environment. | Prevents cross-user data leakage and persistent malware. |
| Data encryption in transit | All traffic over HTTPS/TLS. SSE streams over HTTPS. | Standard web security baseline. |
| Data encryption at rest | PostgreSQL on Railway uses encrypted storage. No additional application-level encryption for MVP. | User data (code, conversations, progress) is sensitive but not regulated (no PCI, no HIPAA). Railway provides disk encryption. |
| Authentication security | Firebase Auth handles credential storage, password hashing, session tokens. No custom auth implementation. | Delegate security-critical auth to a mature provider. Don't roll your own. |
| API authorization | All API endpoints require valid Firebase Auth token. No unauthenticated access to user data or code execution. Landing page and public marketing pages are unauthenticated. | Prevent unauthorized code execution and data access. |
| Rate limiting | Code submissions rate-limited per user (max 10 submissions per minute). AI tutor requests rate-limited per user (max 30 messages per minute). | Prevent abuse, cost runaway, and queue flooding. |
| Dependency security | Automated dependency vulnerability scanning (GitHub Dependabot or equivalent). No known critical CVEs in production dependencies. | Supply chain security baseline. |

### Reliability

| Requirement | Target | Failure Signal |
|---|---|---|
| Platform uptime | 99% (allows ~7 hours downtime/month) | Extended outages during peak learning hours (evenings 7-11pm, weekends) |
| Benchmark consistency | Reference-normalized scoring: each user submission's benchmark is reported as a ratio against a pinned reference implementation run on the same host at the same time. Eliminates shared-infra noise. Same code submitted twice within a session produces ±5% variance in the normalized ratio. Cross-session absolute numbers may vary, but the ratio stays stable. | Normalized ratio variance >10% for identical code within a session |
| Reference implementation versioning | Reference binary pinned per track version. Only updated with a migration that recalculates historical scores. | Historical benchmark ratios shift unexpectedly after a reference update |
| Code execution success rate | >95% of submissions that compile should complete without platform errors | >10% of submissions fail due to infrastructure (not user code errors) |
| Session state durability | Zero data loss on user code and progress. Auto-save survives browser crash, tab close, network interruption. | User returns to find code state lost |
| Job queue recovery | Failed/stuck BullMQ jobs are automatically retried once, then marked failed with admin alert. Queue recovers without manual intervention. | Stuck jobs block the queue for other users |
| AI tutor availability | Tutor available in >95% of sessions. **Requires instrumentation:** every tutor request logged with success/failure status to measure this target. Build this into the tutor integration from day one, not retrofitted. | Anthropic API outage degrades gracefully — learner can still edit code, submit, and view benchmarks without tutor |
| Graceful degradation | If AI tutor is unavailable, the core learning loop (edit → submit → benchmark) still functions. If benchmark runner is slow, compilation results still return. | Single component failure takes down the entire experience |

### Scalability

| Requirement | Target | Planning Horizon |
|---|---|---|
| MVP scale | 100 concurrent users, 10 simultaneous code executions | Launch to 3 months |
| Per-user infrastructure cost | ≤$0.65/month at 100 users | MVP |
| Cost trajectory | Trending toward $0.30/user at 1,000 users through shared infrastructure and execution batching | 12 months |
| Database capacity | PostgreSQL handles 1,000 users with code snapshots, conversation history, benchmark results without performance degradation | 12 months |
| Execution queue throughput | BullMQ processes submissions with <5s average queue wait at peak load (20 concurrent users actively submitting) | MVP |
| Horizontal scaling path | Code execution workers (BullMQ consumers) can be scaled independently by adding Railway service replicas. No architectural changes required to go from 1 to 5 workers. Note: scaling API replicas (Fastify) requires connection pooling (PgBouncer or equivalent) to manage PostgreSQL connection limits. | Growth phase |
| AI tutor cost scaling | Anthropic API cost stays within budget through context window management (current-milestone-only context), prompt caching where available, and per-user rate limits | Ongoing |

### Accessibility

| Requirement | Target | Notes |
|---|---|---|
| WCAG compliance level | WCAG 2.1 AA for core flows (signup, onboarding, code editing, AI chat, benchmark results) | Full WCAG audit is Growth phase. MVP: don't introduce known barriers. |
| Keyboard navigation | All core flows completable with keyboard only | Tab order, focus management, keyboard shortcuts in editor. **Validated by automated accessibility checks in CI (axe-core or equivalent),** not manual testing. Without CI automation, this NFR is aspirational. |
| Screen reader support | Monaco editor screen reader mode enabled. ARIA live regions for AI tutor streaming responses. | Monaco has built-in accessibility — use it, don't build custom. |
| Color contrast | Code syntax highlighting meets AA contrast ratios. Dark theme tested explicitly (dark themes often fail). | Test with automated contrast checker before launch. |
| Visual alternatives | All visual concept explainer SVGs have descriptive alt text. Benchmark charts have data table alternatives. | Diagrams are a core learning tool — they must be accessible. |
| Semantic HTML | Landing page (Astro) uses semantic HTML by default. Webapp uses appropriate ARIA roles for dynamic content. | Astro's static output is inherently more accessible than JS-heavy SPAs. |

### NFR Review Triggers

These NFRs are not write-once-read-never. Review cadence by category:

| Category | Review When |
|---|---|
| **Performance** | Pre-launch load test. Then every time active user count doubles. |
| **Security** | Pre-launch security review. Then quarterly. After any code execution incident. |
| **Reliability** | Pre-launch (benchmark consistency validation). Then monthly Sentry/uptime review. |
| **Scalability** | At 100 users, 500 users, 1,000 users. Each checkpoint: review per-user cost, database performance, queue throughput. |
| **Accessibility** | Pre-launch (axe-core CI pass). Then whenever new user-facing flows are added. |
