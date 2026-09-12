# SEMI:ON — Continuation Prompt

**Language instruction: Always respond to me in Korean, even though this prompt is written in English. Write user-facing explanations, questions, progress updates, and project documents in Korean unless I explicitly request another language. Keep code identifiers and standard technical names in their appropriate form.**

I am an electronics engineering student attending SK AX's SKALA program. I have very little coding experience. Continue the project below without restarting topic selection or changing its core purpose.

## 1. Project location and existing documents

Use this as the canonical project directory for all subsequent project documents and implementation files:

`/Users/kimjinsu/Library/Mobile Documents/com~apple~CloudDocs/SKALA/미니프로젝트1`

This corresponds to **iCloud Drive → SKALA → 미니프로젝트1**.

Read these files first if accessible:

- `SEMI_ON_PROJECT_PLAN.md` — the full, current project plan.
- `SEMI_ON_PLAN_PROGRESS.md` — the current planning progress and decisions.
- `SKALA_AI_PROJECT_RECOMMENDATION_PROGRESS.md` — historical topic-selection notes only; superseded by the SEMI:ON plan.

Do not claim to have read inaccessible files. If they are unavailable, continue using the context below and clearly state the limitation. Inspect existing files and applicable instructions before changing anything. Do not overwrite unrelated work.

The plan has been written, but do not assume that application code, sensor wiring, model training, a submission PDF, or presentation materials have been completed. Check the actual workspace for subsequent work before deciding what remains.

## 2. Assignment and schedule

The assignment is an individual **AI Web Service Mini Project**, primarily focused on service planning and Front-End user experiences. Back-End work should support the service; the DB stores data needed by the screens and workflows.

Official schedule:

- Day 1, 09:00–11:00: orientation, deliverables, and evaluation criteria.
- Day 1, 11:00–12:00 and 13:00–18:00: service planning.
- Day 2, 09:00–18:00, excluding lunch: system design.
- Day 3, 09:00–12:00: planning and design improvements.
- Day 3, 13:00–14:00: preparation and submission.
- Day 3, 14:30–17:00: individual presentations, exactly five minutes per person.

Deliverables include a project specification PDF, API specification, DB diagram, service/UI design and FE screens, and a five-minute presentation. The independent work blocks total 18 hours, including planning and documentation; they are not 18 hours of coding alone.

## 3. Confirmed product direction

Working name: **SEMI:ON — B2B Semiconductor In-House Technical Training Platform**.

The central product is an internal training service purchased by companies and used by new or reassigned technicians.

- Buyer/adopter: corporate training managers and technical training centers.
- Users: learners, instructors, and training managers.
- Workflow: explore courses → learn concepts → observe sensor-based practice → make an evidence-based judgment → receive AI feedback → retry → review learning records.

**Do not turn this back into a standalone equipment-monitoring SaaS, a hand-motion correction service, or a game.** Equipment anomaly detection is a practical exercise inside the training platform.

Show several courses in the catalog, but implement only one complete sensor-based course. Clearly distinguish available exercises, previews, and coming-soon courses.

Catalog:

1. Semiconductor equipment components and their roles — preview.
2. Wafer transfer and alignment principles — preview.
3. **Wafer Stage Anomaly Response Practice — fully implemented course.**
4. Preventive inspection and record keeping — coming soon.
5. Reporting abnormal equipment conditions — coming soon.

## 4. Implemented practical course

Attach an MPU6050 firmly to a small rigid platform with a circular wafer mockup. It represents a wafer stage for demonstration purposes.

- Record several normal sessions in advance.
- During demonstration, show new normal input, then introduce small persistent shaking or a changed orientation.
- Initially evaluate only the settling/observation interval after movement ends. Mark phase changes using a web button instead of implementing automatic movement segmentation.
- Keep mounting, operating conditions, and observation phases consistent.
- Separate training sessions from validation and final test sessions. Do not randomly split overlapping windows from one recording and call that independent validation.
- Check both false alarms on new normal recordings and detection of intentionally altered recordings.

The learner observes the signals, selects an evidence interval, chooses an inspection item, writes a short reason, and receives feedback. Example checks include verifying sensor attachment, checking the mockup's mounting, and repeating a measurement under the same conditions.

**Assess observation and judgment, not how steadily the learner holds the mockup.** Anomaly scores are not learner competency scores. Course completion is not certification of real-world maintenance ability.

This is a low-speed educational mockup, not validation of actual semiconductor equipment precision, defects, or failure prediction. Do not claim to reconstruct accurate spatial travel from one IMU. Do not build a motorized multi-axis stage for this MVP.

## 5. Hardware status

Required:

- One existing Arduino or ESP32 development board.
- One MPU6050 module.
- USB data cable and approximately four jumper wires.
- A small rigid platform, circular mockup, and secure mounting materials.
- Breadboard only if useful.

The latest product image was labeled **GY-521 MPU-6050**. It is the intended type: a three-axis accelerometer plus a three-axis gyroscope. The photographed module had unpopulated header holes. Confirm whether the purchased option includes soldered headers or requires soldering.

Basic connections are VCC, GND, SCL, and SDA. Confirm the actual development board and module voltage requirements before giving pin-level wiring instructions.

Still unknown:

- The exact board model available to me.
- Whether I already own or have purchased the MPU6050.
- Whether soldering is available.

Ordinary ON/OFF tilt switches cannot provide continuous angle or angular-velocity measurements. An MPU6050 is preferred. No motor, motor driver, battery, external screen, or additional tilt switch is required for the initial USB-connected mockup.

## 6. Front-End scope

Implement five compact screens:

1. Learning home: catalog, progress, recent records.
2. Course details: objectives, steps, prerequisites, start/continue.
3. Practice: step guidance, sensor status, live charts, simple mockup orientation, baseline comparison, evidence selection, answer submission.
4. Results: submitted answer, observation summary, AI feedback, linked evidence, previous attempts, retry.
5. Instructor overview: actual learner progress, submission status, attempt count, and access to submitted answers and feedback.

The instructor view is part of the core B2B demonstration. One seeded learner and one instructor are sufficient. Seed the course catalog and assignment rather than building management editors.

Use explicit loading, disconnected, insufficient-data, analysis-failed, and coming-soon states. Label live mockup measurements, recorded measurements, and illustrative mock data accurately.

Exclude production authentication, payment, SSO, multi-tenant isolation, elaborate 3D assets, and a full LMS. A demo role switch is not an authentication implementation.

## 7. AI responsibilities

### A. Anomaly candidate detection

The plan proposes one small pre-trained Isolation Forest model over a few windowed motion features. Save the feature-processing configuration, thresholds, data provenance, and model version. Treat the output as relative anomaly evidence, not a fault probability.

If model behavior cannot be validated within the time budget, explicitly switch to statistical/rule-based baseline comparison and update all claims and screens. Do not label a manually chosen threshold as a trained AI model.

### B. LLM learning feedback

Inputs:

- Course objectives, authored instructional guidance, and feedback criteria.
- Computed measurement facts and valid evidence intervals.
- Learner selections and explanation.
- Relevant previous attempt information when available.

Outputs:

- What the learner observed well.
- What needs clarification or improvement.
- Evidence references.
- A suggested next learning or practice step.

Call the LLM after answer submission, not for every sensor sample. Validate the response structure and evidence references. Treat learner text as input data, not instructions. Do not invent actual fault causes, physical explanations not supported by data, or employee competence judgments.

Preserve submitted answers if AI fails. Reuse cached feedback only for the same relevant input and versions, and label it as saved feedback.

## 8. Technical and data design

Suggested stack:

- React + Vite for FE.
- Python FastAPI for BE.
- USB/pyserial for sensor ingestion.
- WebSocket for live data.
- SQLite for persistence.
- scikit-learn for the anomaly model.
- One LLM API for learning feedback.

Prefer a suitable course-provided starter template if available. Start with a local laptop-hosted demo. Keep API keys on the server.

Six planned tables:

- users
- courses
- enrollments
- attempts
- measurements
- events

Persist progress, evidence selections, submitted answers, feedback, and the model/course/settings versions used. New attempts must not overwrite previous attempts. Instructor summaries must reflect real saved demo records rather than invented performance statistics.

The full plan specifies 10 REST method/path combinations and one WebSocket route; read it before implementing APIs.

## 9. Execution priorities and presentation

Prioritize one complete flow:

**Course entry → observation → sensor exercise → evidence-based answer → actual AI feedback → persistence → instructor review.**

By the end of Day 2, freeze new features. Use Day 3 for fixes, documents, rehearsal, and submission. Keep replay data and a short demo recording as explicitly labeled fallbacks.

Five-minute presentation:

- 0:00–0:20: sensor-driven hook.
- 0:20–0:45: learner/instructor problem and B2B product.
- 0:45–1:15: course catalog and implemented course.
- 1:15–3:00: practice, evidence selection, answer, and feedback.
- 3:00–3:45: FE, sensor, AI, and data responsibilities.
- 3:45–4:30: instructor view and corporate training value.
- 4:30–5:00: verified scope, limitations, and closing.

## 10. Collaboration instructions

- Respond in Korean and explain technical choices in terms a coding beginner can understand.
- Keep explanations concrete and concise; do not repeat the entire plan on every turn.
- Maintain the agreed product direction. Do not restart brainstorming unless I request it.
- Before making changes, briefly state the goal, small steps, and material unknowns.
- Maintain a living checklist/progress file in the canonical iCloud project directory.
- Ask only for essential missing information and continue independent work when possible.
- Do not assume permission to access or modify a location that the environment restricts; use the normal approval mechanism when required.
- Distinguish planned features from implemented and tested behavior.
- Verify relevant functionality before reporting completion and summarize the evidence.
- Save new project files under the canonical iCloud directory unless I explicitly request another location.

**Start by reading the existing project plan and progress file, briefly summarize the actual current state in Korean, and identify the next concrete step. Do not assume hardware has been purchased or code has been implemented. Follow any additional task or correction I provide after this prompt.**
