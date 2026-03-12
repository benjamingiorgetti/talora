---
name: talora-mvp-qa
description: "Validate Talora's MVP end-to-end for a real demo company. Use when the user asks to prove the MVP works, prepare a demo account, verify Google Calendar/Evolution/turnos flow, or decide whether something is truly 'done' versus only implemented."
user_invocable: true
---

Run a Talora-specific MVP validation workflow. This is not a generic QA pass. The goal is to prove that the current product is sellable for one real vertical and one real company.

## Use this skill when

- The user says the MVP has to "funcionar de verdad"
- The user asks to prepare a demo company
- The user asks to validate Google Calendar, WhatsApp, or appointments end-to-end
- The user asks whether a feature is actually done

## Rules

- Validate one vertical at a time. Recommended default: `peluqueria` or `dentista`.
- Read `todos.md` and `CLAUDE.md` first.
- Do not move a card to `Done` without real evidence.
- "Implemented" is not enough; prove the flow with API or UI evidence.

## Validation order

### 1. Access and scope

- Log in as `superadmin`
- Check `/companies`
- If needed, impersonate one client company
- Confirm `admin_empresa` only sees `/workspace/*`
- Confirm `/agent` remains internal and is not the client workspace

### 2. Google Calendar real

- Verify `GET /auth/google/status?company_id=...`
- Verify `GET /auth/google/calendars?company_id=...`
- Confirm accessible calendars are real
- Confirm professionals map to real accessible calendars
- Confirm invalid `calendar_id` is rejected if Google is connected

### 3. WhatsApp / Evolution real

- Verify Docker/Evolution health first
- Check `/instances`
- Check `/instances/:id/connect`
- Check `/instances/:id/qr`
- Treat `qr_pending` as valid while waiting for scan
- Only call WhatsApp "connected" with real evidence

### 4. Appointment flow

- Create or reuse one company with professionals and services
- Validate availability lookup
- Validate create appointment
- Validate reprogram appointment
- Validate cancel appointment
- Confirm Google Calendar remains source of truth

### 5. Workspace surfaces

- `/workspace`
- `/workspace/calendar`
- `/workspace/whatsapp`
- `/workspace/appointments`
- `/workspace/clients`

Look for operational consistency, not pixel polish only.

## Expected output

Return a short MVP QA report:

```text
MVP QA REPORT
=============
Vertical: ...
Company: ...

[PASS/FAIL] Superadmin setup
[PASS/FAIL] Client workspace scope
[PASS/FAIL] Google Calendar mapping
[PASS/FAIL] WhatsApp instance / QR / connection
[PASS/FAIL] Create appointment
[PASS/FAIL] Reprogram appointment
[PASS/FAIL] Cancel appointment
[PASS/FAIL] Workspace surfaces usable

Evidence:
- ...

Blockers:
- ...

Next move:
- ...
```

## After validation

- Update `todos.md` if the evidence changes backlog status
- Prefer moving work to `Built / Unvalidated` instead of `Done` when proof is incomplete
