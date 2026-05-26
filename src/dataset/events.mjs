import { appendText, fillerText, mutableText } from "./scenarios/coursework.mjs";

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choice(random, values) {
  return values[Math.floor(random() * values.length)];
}

function plannedMutableEvents(scenario, eventCount, random) {
  const planned = [];

  for (const slot of scenario.mutableSlots) {
    for (let index = 0; index < slot.values.length; index += 1) {
      const value = slot.values[index];
      const bandStart = index * Math.floor(eventCount / 3);
      const bandWidth = Math.floor(eventCount / 3) - 20;
      const position = bandStart + 5 + Math.floor(random() * Math.max(1, bandWidth));

      planned.push({
        position,
        text: mutableText(slot, value, index),
        facts: [
          {
            subject: slot.subject,
            predicate: slot.predicate,
            object: value,
            mutable: true,
            confidence: 0.95
          }
        ]
      });
    }
  }

  return planned;
}

function plannedAppendEvents(scenario, eventCount, random) {
  const planned = [];

  for (const slot of scenario.appendSlots) {
    for (const value of slot.values) {
      planned.push({
        position: 20 + Math.floor(random() * (eventCount - 40)),
        text: appendText(slot, value),
        facts: [
          {
            subject: slot.subject,
            predicate: slot.predicate,
            object: value,
            mutable: false,
            confidence: 0.95
          }
        ]
      });
    }
  }

  return planned;
}

function addFillerEvents(planned, scenario, eventCount, random) {
  while (planned.length < eventCount) {
    const subject = choice(random, scenario.fillerSubjects);
    const predicate = choice(random, scenario.fillerPredicates);
    const object = choice(random, scenario.fillerObjects);

    planned.push({
      position: Math.floor(random() * eventCount),
      text: fillerText(subject, predicate, object),
      facts: [
        {
          subject,
          predicate,
          object,
          mutable: false,
          confidence: 0.6
        }
      ]
    });
  }
}

function materializedEvent(event) {
  return {
    text: event.text,
    facts: event.facts
  };
}

function materializedBucket(bucket) {
  const texts = [];
  const facts = [];

  for (const event of bucket) {
    texts.push(event.text);

    for (const fact of event.facts) {
      facts.push(fact);
    }
  }

  return {
    text: texts.join(" "),
    facts
  };
}

function materializeEvents(planned, eventCount) {
  planned.sort((a, b) => a.position - b.position);

  if (planned.length <= eventCount) {
    const events = [];

    for (const event of planned) {
      events.push(materializedEvent(event));
    }

    return events;
  }

  const buckets = Array.from({ length: eventCount }, () => []);

  for (let index = 0; index < planned.length; index += 1) {
    const bucketIndex = Math.min(eventCount - 1, Math.floor((index * eventCount) / planned.length));
    buckets[bucketIndex].push(planned[index]);
  }

  const events = [];

  for (const bucket of buckets) {
    events.push(materializedBucket(bucket));
  }

  return events;
}

function eventId(index) {
  return `e${String(index + 1).padStart(4, "0")}`;
}

function eventTimestamp(baseTime, index) {
  return new Date(baseTime + index * 60_000).toISOString();
}

function serializeEvents(materializedEvents, baseTime) {
  const events = [];

  for (let index = 0; index < materializedEvents.length; index += 1) {
    const event = materializedEvents[index];

    events.push({
      id: eventId(index),
      timestamp: eventTimestamp(baseTime, index),
      type: "user_message",
      text: event.text,
      facts: event.facts
    });
  }

  return events;
}

export function buildDatasetEvents({ scenario, eventCount, seed }) {
  const random = mulberry32(seed);
  const planned = [
    ...plannedMutableEvents(scenario, eventCount, random),
    ...plannedAppendEvents(scenario, eventCount, random)
  ];

  addFillerEvents(planned, scenario, eventCount, random);

  return serializeEvents(materializeEvents(planned, eventCount), scenario.baseTime);
}
