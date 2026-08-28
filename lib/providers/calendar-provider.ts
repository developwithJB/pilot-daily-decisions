import { parseIcsSignals } from "../calendar-ics";
import { PROVIDER_CONTRACT_VERSION, type CalendarProvider, type CalendarSignalV1, type ProviderResult } from "./contracts";

const within = (event: CalendarSignalV1, from: Date, to: Date) => {
  const start = new Date(event.start).getTime();
  return Number.isFinite(start) && start >= from.getTime() && start <= to.getTime();
};

export class IcsCalendarProvider implements CalendarProvider {
  readonly id = "ics-local";
  constructor(private readonly text: string) {}
  async listSignals({ from, to }: { from: Date; to: Date }): Promise<ProviderResult<CalendarSignalV1[]>> {
    return {
      data: parseIcsSignals(this.text).filter((event) => within(event, from, to)),
      meta: { contractVersion: PROVIDER_CONTRACT_VERSION, provider: this.id, mode: "manual", fetchedAt: new Date().toISOString(), confidence: "high" },
      warnings: ["The ICS file was normalized locally; raw titles, descriptions, guests, and locations were not retained."],
    };
  }
}

export class ManualCalendarProvider implements CalendarProvider {
  readonly id = "manual";
  constructor(private readonly signals: CalendarSignalV1[]) {}
  async listSignals({ from, to }: { from: Date; to: Date }): Promise<ProviderResult<CalendarSignalV1[]>> {
    return {
      data: this.signals.filter((event) => within(event, from, to)),
      meta: { contractVersion: PROVIDER_CONTRACT_VERSION, provider: this.id, mode: "manual", fetchedAt: new Date().toISOString(), confidence: "medium" },
      warnings: ["Manual plans are only as current as the details you entered."],
    };
  }
}
