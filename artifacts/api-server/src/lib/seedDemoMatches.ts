import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  patientsTable,
  therapistsTable,
  intakeSessionsTable,
  patientTherapistMatchesTable,
} from "@workspace/db";
import { logger } from "./logger";

type DemoMatchSeed = {
  patientName: string;
  therapistName: string;
  matchStatus: "pending" | "accepted";
  sessionLabel: string;
  daysAgo: number;
  brief: {
    subjective: string;
    assessment: string;
    plan: string;
    clinicalProfile: string;
    averageHr: number;
    peakHr: number;
  };
  phq9: { score: number; rationale: string; approved?: boolean };
  gad7: { score: number; rationale: string; approved?: boolean };
};

const DEMO_MATCHES: DemoMatchSeed[] = [
  {
    patientName: "Alex Rivera",
    therapistName: "Dr. Evelyn Hart",
    matchStatus: "pending",
    sessionLabel: "Initial Intake",
    daysAgo: 2,
    brief: {
      subjective:
        "Patient reports recurrent intrusive memories of a workplace incident two years ago, with worsening hypervigilance and sleep disruption over the past six weeks. Describes startle response when colleagues approach unexpectedly. Reports flat affect and loss of interest in previously enjoyed activities including cycling and music.",
      assessment:
        "Presentation consistent with Complex PTSD with comorbid moderate depression. Trauma response appears chronic with recent acute exacerbation likely tied to anniversary effect. Functional impairment moderate-to-severe across work and relational domains.",
      plan:
        "Recommend trauma-focused CBT or EMDR. Sleep hygiene intervention and short-term medication consultation may be beneficial. Schedule weekly sessions for first 8 weeks with re-evaluation at 4 weeks.",
      clinicalProfile: "complex-ptsd",
      averageHr: 84,
      peakHr: 112,
    },
    phq9: {
      score: 16,
      rationale:
        "Moderately severe depression: anhedonia, fatigue, sleep disturbance, and feelings of worthlessness reported across multiple intake segments.",
      approved: true,
    },
    gad7: {
      score: 14,
      rationale:
        "Moderate anxiety with prominent hypervigilance and intrusive worry tied to trauma reminders.",
    },
  },
  {
    patientName: "Mina Thompson",
    therapistName: "Dr. Priya Nair",
    matchStatus: "accepted",
    sessionLabel: "Initial Intake",
    daysAgo: 9,
    brief: {
      subjective:
        "Patient describes 'running on empty' for the past four months following a promotion at work. Reports difficulty disconnecting in evenings, weekend rumination about Monday meetings, and recent panic-like episodes before video calls. Denies suicidal ideation.",
      assessment:
        "Presentation consistent with occupational burnout with overlapping generalized anxiety. No clear depressive episode but mood is reactive and fragile. Strong protective factors: stable partnership, intact support network, motivated for change.",
      plan:
        "Begin weekly CBT focused on cognitive restructuring around perfectionism and limit-setting. Introduce paced breathing for pre-call panic. Reassess after 6 sessions; consider ACT framework if avoidance patterns persist.",
      clinicalProfile: "burnout",
      averageHr: 78,
      peakHr: 96,
    },
    phq9: {
      score: 9,
      rationale:
        "Mild depressive symptoms primarily driven by sleep disturbance and reduced energy; mood and self-worth largely preserved.",
      approved: true,
    },
    gad7: {
      score: 13,
      rationale:
        "Moderate anxiety with prominent anticipatory worry about work performance and difficulty controlling worry.",
      approved: true,
    },
  },
  {
    patientName: "Jordan Kim",
    therapistName: "Dr. Marcus Webb",
    matchStatus: "pending",
    sessionLabel: "Initial Intake",
    daysAgo: 1,
    brief: {
      subjective:
        "Patient reports compulsive checking behaviors (locks, stove, email sent-folder) that have intensified over the past three months and now consume an estimated 90 minutes per day. Describes intrusive thoughts about causing accidental harm. Acknowledges behaviors are excessive but feels unable to resist.",
      assessment:
        "Presentation consistent with OCD, primarily checking subtype, with secondary generalized anxiety. Insight is preserved. No significant depressive features at this time. Symptoms appear to have escalated following a recent relocation.",
      plan:
        "Initiate Exposure and Response Prevention (ERP) protocol with hierarchy development in first session. Psychoeducation around OCD cycle. Weekly sessions for 12 weeks; consider SSRI consultation if response inadequate at week 8.",
      clinicalProfile: "ocd",
      averageHr: 81,
      peakHr: 104,
    },
    phq9: {
      score: 6,
      rationale:
        "Mild depressive symptoms; mostly secondary to functional impairment from OCD rituals rather than primary mood disorder.",
    },
    gad7: {
      score: 15,
      rationale:
        "Severe anxiety with intrusive worry, difficulty relaxing, and irritability reported throughout the interview.",
    },
  },
];

const DEMO_PATIENTS_TO_ENSURE: Array<{ name: string; demographics: any }> = [
  {
    name: "Jordan Kim",
    demographics: {
      age: 31,
      gender: "non-binary",
      clinicalProfiles: ["ocd", "anxiety"],
    },
  },
];

export async function seedDemoMatches(): Promise<void> {
  // Make sure any patients referenced by the demo matches exist.
  for (const p of DEMO_PATIENTS_TO_ENSURE) {
    const [existing] = await db
      .select()
      .from(patientsTable)
      .where(eq(patientsTable.name, p.name));
    if (!existing) {
      await db.insert(patientsTable).values(p);
    }
  }

  // Resolve therapists/patients up-front by name.
  const therapistNames = [...new Set(DEMO_MATCHES.map((m) => m.therapistName))];
  const patientNames = [...new Set(DEMO_MATCHES.map((m) => m.patientName))];

  const therapists = therapistNames.length
    ? await db.select().from(therapistsTable).where(inArray(therapistsTable.name, therapistNames))
    : [];
  const patients = patientNames.length
    ? await db.select().from(patientsTable).where(inArray(patientsTable.name, patientNames))
    : [];

  const therapistByName = new Map(therapists.map((t) => [t.name, t]));
  const patientByName = new Map(patients.map((p) => [p.name, p]));

  let created = 0;
  let skipped = 0;

  for (const seed of DEMO_MATCHES) {
    const therapist = therapistByName.get(seed.therapistName);
    const patient = patientByName.get(seed.patientName);
    if (!therapist || !patient) {
      logger.warn(
        { seed: seed.patientName, therapist: seed.therapistName, patient: seed.patientName },
        "[demo-matches] Missing therapist or patient — skipping",
      );
      continue;
    }

    // Check if this patient already has any match — if so, treat the demo
    // pairing as already seeded so we don't keep stacking sessions on every
    // server restart.
    const [anyMatch] = await db
      .select()
      .from(patientTherapistMatchesTable)
      .where(eq(patientTherapistMatchesTable.patientId, patient.id))
      .limit(1);
    if (anyMatch) {
      skipped++;
      continue;
    }

    // Create a completed intake session with a brief + screeners.
    const startedAt = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000);
    const endedAt = new Date(startedAt.getTime() + 18 * 60 * 1000);

    const [session] = await db
      .insert(intakeSessionsTable)
      .values({
        label: seed.sessionLabel,
        patientId: patient.id,
        startedAt,
        endedAt,
        assignedTherapistId: therapist.id,
        clinicalBrief: {
          sessionId: 0, // back-filled after insert
          generatedAt: endedAt,
          subjective: seed.brief.subjective,
          objective: {
            averageHr: seed.brief.averageHr,
            averageHrv: 48,
            peakHr: seed.brief.peakHr,
            readingCount: 36,
            biometricSubtextEvents: [],
          },
          assessment: seed.brief.assessment,
          plan: seed.brief.plan,
          clinicalProfile: seed.brief.clinicalProfile,
        } as any,
        phq9: {
          score: seed.phq9.score,
          maxScore: 27,
          severity:
            seed.phq9.score >= 20
              ? "severe"
              : seed.phq9.score >= 15
              ? "moderately-severe"
              : seed.phq9.score >= 10
              ? "moderate"
              : seed.phq9.score >= 5
              ? "mild"
              : "minimal",
          rationale: seed.phq9.rationale,
          approvedAt: seed.phq9.approved ? endedAt.toISOString() : null,
          approvedBy: seed.phq9.approved ? therapist.id : null,
        } as any,
        gad7: {
          score: seed.gad7.score,
          maxScore: 21,
          severity:
            seed.gad7.score >= 15
              ? "severe"
              : seed.gad7.score >= 10
              ? "moderate"
              : seed.gad7.score >= 5
              ? "mild"
              : "minimal",
          rationale: seed.gad7.rationale,
          approvedAt: seed.gad7.approved ? endedAt.toISOString() : null,
          approvedBy: seed.gad7.approved ? therapist.id : null,
        } as any,
      })
      .returning();

    // Back-fill the brief's sessionId now that we know the row id.
    await db
      .update(intakeSessionsTable)
      .set({
        clinicalBrief: {
          ...(session.clinicalBrief as any),
          sessionId: session.id,
        } as any,
      })
      .where(eq(intakeSessionsTable.id, session.id));

    await db
      .insert(patientTherapistMatchesTable)
      .values({
        patientId: patient.id,
        sessionId: session.id,
        therapistId: therapist.id,
        status: seed.matchStatus,
        message: null,
      })
      .onConflictDoNothing({
        target: [
          patientTherapistMatchesTable.patientId,
          patientTherapistMatchesTable.sessionId,
          patientTherapistMatchesTable.therapistId,
        ],
      });

    if (seed.matchStatus === "accepted") {
      await db
        .update(patientTherapistMatchesTable)
        .set({ respondedAt: endedAt })
        .where(
          and(
            eq(patientTherapistMatchesTable.patientId, patient.id),
            eq(patientTherapistMatchesTable.sessionId, session.id),
            eq(patientTherapistMatchesTable.therapistId, therapist.id),
          ),
        );
    }

    created++;
  }

  logger.info({ created, skipped }, "[demo-matches] Seed completed");
}
