export interface TranscriptSegment {
  id: string;
  timestamp: Date;
  text: string;
}

export interface BiometricReading {
  metric: "HR" | "HRV";
  value: number;
  recordedAt: Date;
}

export interface AnnotatedSegment extends TranscriptSegment {
  nearestHr: number | null;
  nearestHrv: number | null;
  isBiometricSubtext: boolean;
  spikePercent: number | null;
}

export interface BiometricSubtextEvent {
  transcriptSegmentId: string;
  timestamp: Date;
  hrValue: number;
  baselineHr: number;
  spikePercent: number;
  text: string;
}

function findNearestReading(
  readings: BiometricReading[],
  metric: "HR" | "HRV",
  timestamp: Date
): number | null {
  const metricReadings = readings.filter((r) => r.metric === metric);
  if (metricReadings.length === 0) return null;

  let nearest = metricReadings[0];
  let minDiff = Math.abs(timestamp.getTime() - nearest.recordedAt.getTime());

  for (const reading of metricReadings) {
    const diff = Math.abs(timestamp.getTime() - reading.recordedAt.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      nearest = reading;
    }
  }

  return nearest.value;
}

function computeBaseline(readings: BiometricReading[], metric: "HR" | "HRV"): number | null {
  const metricReadings = readings.filter((r) => r.metric === metric);
  if (metricReadings.length === 0) return null;
  const sum = metricReadings.reduce((acc, r) => acc + r.value, 0);
  return sum / metricReadings.length;
}

export function correlateWithTranscript(
  readings: BiometricReading[],
  segments: TranscriptSegment[],
  spikeThresholdPct = 15
): {
  annotated: AnnotatedSegment[];
  subtextEvents: BiometricSubtextEvent[];
} {
  const baseline = computeBaseline(readings, "HR");

  const annotated: AnnotatedSegment[] = segments.map((seg) => {
    const nearestHr = findNearestReading(readings, "HR", seg.timestamp);
    const nearestHrv = findNearestReading(readings, "HRV", seg.timestamp);

    let isBiometricSubtext = false;
    let spikePercent: number | null = null;

    if (nearestHr !== null && baseline !== null) {
      spikePercent = ((nearestHr - baseline) / baseline) * 100;
      isBiometricSubtext = spikePercent >= spikeThresholdPct;
    }

    return {
      ...seg,
      nearestHr,
      nearestHrv,
      isBiometricSubtext,
      spikePercent,
    };
  });

  const subtextEvents: BiometricSubtextEvent[] = annotated
    .filter((seg) => seg.isBiometricSubtext && seg.nearestHr !== null && baseline !== null)
    .map((seg) => ({
      transcriptSegmentId: seg.id,
      timestamp: seg.timestamp,
      hrValue: seg.nearestHr!,
      baselineHr: baseline!,
      spikePercent: seg.spikePercent!,
      text: seg.text,
    }));

  return { annotated, subtextEvents };
}
