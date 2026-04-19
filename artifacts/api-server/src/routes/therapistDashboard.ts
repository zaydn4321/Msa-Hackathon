import { Router, type IRouter } from "express";
import { and, eq, gte, sql, inArray, desc } from "drizzle-orm";
import {
  db,
  therapistsTable,
  patientsTable,
  intakeSessionsTable,
  patientTherapistMatchesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { computeCadenceForPatients, RESCREEN_INTERVAL_DAYS } from "../lib/screenerCadence";
import { instrumentLabel, type Instrument } from "../lib/screenerCatalog";

const router: IRouter = Router();

router.get("/therapist/dashboard-stats", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId!;

  const [therapist] = await db
    .select()
    .from(therapistsTable)
    .where(eq(therapistsTable.clerkUserId, clerkUserId));

  if (!therapist) {
    res.status(403).json({ error: "Therapist account not found." });
    return;
  }

  const [assignedSessions, matches] = await Promise.all([
    db
      .select()
      .from(intakeSessionsTable)
      .where(eq(intakeSessionsTable.assignedTherapistId, therapist.id)),
    db
      .select()
      .from(patientTherapistMatchesTable)
      .where(eq(patientTherapistMatchesTable.therapistId, therapist.id)),
  ]);

  const matchSessionIds = matches.map((m) => m.sessionId);
  const matchSessions = matchSessionIds.length
    ? await db
        .select()
        .from(intakeSessionsTable)
        .where(inArray(intakeSessionsTable.id, matchSessionIds))
    : [];
  const matchSessionMap = new Map(matchSessions.map((s) => [s.id, s]));

  // Distinct patient ids combining accepted matches and assigned sessions
  const acceptedPatientIds = new Set<number>();
  for (const m of matches) {
    if (m.status === "accepted") acceptedPatientIds.add(m.patientId);
  }
  for (const s of assignedSessions) {
    if (s.patientId) acceptedPatientIds.add(s.patientId);
  }
  const totalPatients = acceptedPatientIds.size;

  // High priority = matches whose linked session has phq9 or gad7 score >= 15 (moderately severe / severe)
  let highPriority = 0;
  for (const m of matches) {
    const s = matchSessionMap.get(m.sessionId);
    const phq9 = (s?.phq9 as { score?: number } | null) ?? null;
    const gad7 = (s?.gad7 as { score?: number } | null) ?? null;
    if ((phq9?.score ?? 0) >= 15 || (gad7?.score ?? 0) >= 15) highPriority += 1;
  }

  const pendingIntakes = matches.filter((m) => m.status === "pending").length;

  // Session volume: last 7 days, count of matches received per day (request volume).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const count = matches.filter((m) => {
      const t = new Date(m.createdAt).getTime();
      return t >= day.getTime() && t < next.getTime();
    }).length;
    series.push({ date: day.toISOString().slice(0, 10), count });
  }

  // Build checklist from real outstanding work.
  const patientIds = [
    ...new Set([
      ...matches.map((m) => m.patientId),
      ...assignedSessions.map((s) => s.patientId).filter((x): x is number => x !== null),
    ]),
  ];
  const patients = patientIds.length
    ? await db.select().from(patientsTable).where(inArray(patientsTable.id, patientIds))
    : [];
  const patientNameMap = new Map(patients.map((p) => [p.id, p.name]));

  const shortName = (full: string | undefined): string => {
    if (!full) return "patient";
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  };

  type ChecklistItem = {
    id: string;
    label: string;
    due: "today" | "tomorrow" | "later";
    href?: string;
  };
  const checklist: ChecklistItem[] = [];

  // Pending matches → "Review new intake"
  for (const m of matches.filter((m) => m.status === "pending")) {
    checklist.push({
      id: `match-${m.id}`,
      label: `Review new intake: ${shortName(patientNameMap.get(m.patientId))}`,
      due: "today",
      href: `/therapist-portal/sessions/${m.sessionId}`,
    });
  }
  // Accepted matches whose screeners are unapproved → "Approve screeners"
  for (const m of matches.filter((m) => m.status === "accepted")) {
    const s = matchSessionMap.get(m.sessionId);
    const phq9 = (s?.phq9 as { approvedAt?: string | null } | null) ?? null;
    const gad7 = (s?.gad7 as { approvedAt?: string | null } | null) ?? null;
    if ((phq9 && !phq9.approvedAt) || (gad7 && !gad7.approvedAt)) {
      checklist.push({
        id: `screener-${m.id}`,
        label: `Approve screeners for ${shortName(patientNameMap.get(m.patientId))}`,
        due: "tomorrow",
        href: `/therapist-portal/sessions/${m.sessionId}`,
      });
    }
  }
  // Assigned sessions still in progress (no endedAt) → "Finalize notes"
  for (const s of assignedSessions.filter((s) => !s.endedAt)) {
    checklist.push({
      id: `session-${s.id}`,
      label: `Finalize notes for ${shortName(s.patientId ? patientNameMap.get(s.patientId) : undefined)}`,
      due: "tomorrow",
      href: `/therapist-portal/sessions/${s.id}`,
    });
  }

  // Cadence: patients overdue for re-screen → "Send re-screen"
  const acceptedPatientIdList = [...acceptedPatientIds];
  const cadenceMap = await computeCadenceForPatients(acceptedPatientIdList);
  type DueRow = {
    patientId: number;
    patientName: string;
    instrument: Instrument;
    instrumentLabel: string;
    daysSince: number | null;
    lastApprovedAt: string | null;
    hasOpenRequest: boolean;
    sessionId: number | null;
  };
  const dueRescreens: DueRow[] = [];
  // Find one (most recent) sessionId per accepted patient for href routing.
  const latestSessionByPatient = new Map<number, number>();
  for (const s of [...assignedSessions, ...matchSessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )) {
    if (s.patientId !== null && !latestSessionByPatient.has(s.patientId)) {
      latestSessionByPatient.set(s.patientId, s.id);
    }
  }
  for (const pid of acceptedPatientIdList) {
    const cad = cadenceMap.get(pid);
    if (!cad) continue;
    for (const entry of [cad.phq9, cad.gad7]) {
      if (!entry.due) continue;
      dueRescreens.push({
        patientId: pid,
        patientName: shortName(patientNameMap.get(pid)),
        instrument: entry.instrument,
        instrumentLabel: instrumentLabel(entry.instrument),
        daysSince: entry.daysSince,
        lastApprovedAt: entry.lastApprovedAt,
        hasOpenRequest: entry.hasOpenRequest,
        sessionId: latestSessionByPatient.get(pid) ?? null,
      });
      if (entry.hasOpenRequest) continue;
      const sid = latestSessionByPatient.get(pid);
      checklist.push({
        id: `rescreen-${pid}-${entry.instrument}`,
        label: `Send ${instrumentLabel(entry.instrument)} re-screen to ${shortName(patientNameMap.get(pid))}`,
        due: "today",
        href: sid ? `/therapist-portal/sessions/${sid}` : `/therapist-portal`,
      });
    }
  }

  // Recent activity (last 5 matches across all statuses) — used for "Upcoming/Recent" panel.
  const recentMatches = [...matches]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      patientName: shortName(patientNameMap.get(m.patientId)),
      status: m.status,
      createdAt: m.createdAt,
      sessionId: m.sessionId,
    }));

  res.json({
    totalPatients,
    highPriority,
    pendingIntakes,
    priorityAlerts: highPriority + pendingIntakes,
    sessionVolumeSeries: series,
    checklist,
    recentMatches,
    dueRescreens,
    rescreenIntervalDays: RESCREEN_INTERVAL_DAYS,
  });
});

export default router;
