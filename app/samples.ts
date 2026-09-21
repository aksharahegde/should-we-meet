/** Paste-ready threads, one per row of the spec's edge-case table. `expected` is what the call should be. */
export type Sample = { name: string; expected: string; thread: string; note?: string; invitePending?: boolean }

export const SAMPLES: Sample[] = [
  {
    name: 'They offered two slots',
    expected: 'Meet: a time on the table and a decider brought in',
    thread: `Client A  Tue 10:02
Thanks for the walkthrough doc, this answers most of what we were stuck on.

Us  Tue 10:40
Glad it landed. Anything you want to dig into?

Client A  Tue 11:15
Yes. Can we get 45 minutes this week? Thursday 2pm or Friday 11am both work
on our side. I'll bring our migration budget owner.`,
  },
  {
    name: 'Can you present to the board',
    expected: 'Meet: asked into their process, live, with a decision attached',
    thread: `Client B  Mon 16:20
Update: we took your proposal to the exec review and it cleared the first gate.

Client B  Mon 16:22
The board meets on the 14th. Can you present the rollout plan and the security
section? 20 minutes, and they'll ask about the SOC2 timeline.`,
  },
  {
    name: 'Pricing only',
    expected: 'Async: rule 2, a document is not a meeting',
    thread: `Us  Wed 09:05
Following up on our conversation. Happy to set up a call to walk through
how the tiers work.

Client C  Wed 14:31
No need for a call yet. Can you just send the pricing sheet and the
comparison against your Growth tier? I'll circulate internally.`,
  },
  {
    name: '“Looks great!” and nothing else',
    expected: 'Async: warmth with no time, no person, no ask',
    thread: `Us  Thu 08:12
Sent over the case study from the last rollout. Worth a quick sync?

Client D  Thu 08:44
Looks great!`,
  },
  {
    name: 'Champion excited, buyer silent',
    expected: 'Async or Wait: rule 3, a cc is not an attendee',
    thread: `Client E  Fri 13:10
Personally I love this. It solves the reconciliation mess we've been
living with for two years.

Client E  Fri 13:11
I've forwarded it to our CFO and cc'd them here. They'll have thoughts
on the commercial side.

Us  Mon 09:00
Thanks. Happy to find time this week if useful.

(no reply from the CFO)`,
  },
  {
    name: 'Regroup next quarter',
    expected: 'Wait: a date exists, so not a Drop yet',
    note: "it's been 3 weeks",
    thread: `Client F  Tue 11:48
This is good work and the team liked the pilot numbers.

Client F  Tue 11:49
That said, budget is locked until the new fiscal year. Let's regroup in
early Q1. Ping me the first week of January and we'll pick it back up.`,
  },
  {
    name: 'Only our outbound',
    expected: 'Wait: edge case 1, never Meet, thin evidence',
    thread: `Us  Mon 09:15
Hi, following up on the intro from last week. Would love 20 minutes to
understand how your team handles vendor onboarding today.

Us  Thu 09:02
Bumping this in case it got buried. Happy to work around your calendar.

Us  (next Wed) 08:50
Last note from me, still keen to find time if there's interest.`,
  },
  {
    name: 'They went with someone else',
    expected: 'Drop: interest ended',
    thread: `Client G  Wed 15:40
Wanted to close the loop rather than leave you hanging. We've signed with
another vendor for this workstream. Their existing integration with our ERP
made the internal case easier.

Client G  Wed 15:41
Genuinely appreciated the depth you went into. If the ERP situation changes
I'll reach back out.`,
  },
  {
    name: 'Please stop emailing',
    expected: 'Drop, clear',
    thread: `Client H  Fri 07:58
We are not evaluating anything in this category and I've asked twice to be
taken off this list. Please stop emailing me.`,
  },
  {
    name: 'Ceremonial invite already on the calendar',
    expected: 'Async or Wait: rule 6, the call may contradict the calendar',
    invitePending: true,
    thread: `Invite: "Intro / explore synergies", Thu 3:00pm, 30 min
Organizer: Client J
Attendees: us, Client J

Client J  Tue 10:05
Popping something on the calendar to catch up and explore where there might
be synergies. No agenda needed, just a get-to-know-you.`,
  },
]
