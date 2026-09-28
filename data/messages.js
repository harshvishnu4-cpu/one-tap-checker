// Each message lists which clues show a problem. The rule engine adds the
// star weight of every flagged clue to get a risk score.
// Balance notes (weights always total 10 stars, 1–5 per clue):
// - Three fake/misleading messages have exactly one problem clue (source, date,
//   image), so each of those clues needs 3+ stars to leave green on Balanced.
// - The two real alerts only use urgent words, so giving Urgent Words too many
//   stars makes the Strict style flag real news as suspicious.
// - A 3/3/3/1 rule (Urgent Words lowest) checks every message correctly.
window.MESSAGE_DATA = [
  {
    id: 'school-rain',
    body: 'Heavy rain is expected. Classes are closed today. Please check the school notice page for updates.',
    illustration: 'assets/icons/icon_school_rain_3d.png',
    title: 'School closed today',
    short: 'School closure',
    asset: 'assets/messages/message_school_closure_3d.png',
    issues: { source: false, date: false, image: false, urgent: true },
    truth: 'real',
    truthLabel: 'Real notice',
    note: 'It points to the school notice page and is dated today. Urgent words alone do not make it fake.'
  },
  {
    id: 'free-console',
    body: 'You won! Tap this link in the next 5 minutes or your prize will be given away.',
    illustration: 'assets/decor/message_prize.png',
    title: 'Free game console',
    short: 'Prize message',
    asset: 'assets/messages/message_free_console.png',
    issues: { source: true, date: false, image: false, urgent: true },
    truth: 'fake',
    truthLabel: 'Suspicious',
    note: 'The sender is unknown and the message pushes for an immediate click.'
  },
  {
    id: 'calm-claim',
    body: 'This post sounds calm, but it gives no source or evidence for its surprising claim.',
    illustration: 'assets/icons/icon_source_3d.png',
    title: 'A quiet claim to check',
    short: 'Calm claim',
    asset: 'assets/messages/message_calm_false_claim.png',
    issues: { source: true, date: false, image: false, urgent: false },
    truth: 'fake',
    truthLabel: 'Unsupported claim',
    note: 'Calm wording can still hide a claim with no trustworthy source.'
  },
  {
    id: 'weather-alert',
    body: 'Strong winds are expected after 6 PM. This alert links to the official forecast.',
    illustration: 'assets/decor/message_weather.png',
    title: 'Weather alert',
    short: 'Weather alert',
    asset: 'assets/messages/message_weather_alert.png',
    issues: { source: false, date: false, image: false, urgent: true },
    truth: 'real',
    truthLabel: 'Real advisory',
    note: 'It links to the official forecast. A real weather alert may need urgent language.'
  },
  {
    id: 'old-event',
    body: 'Bring your project by 8:00 AM. Check the date — this notice was posted last year.',
    illustration: 'assets/icons/icon_date_3d.png',
    title: 'Science fair this Friday',
    short: 'Old event',
    asset: 'assets/messages/message_old_event_notice.png',
    issues: { source: false, date: true, image: false, urgent: false },
    truth: 'misleading',
    truthLabel: 'Out of date',
    note: 'The notice was posted last year, so “this Friday” is no longer true.'
  },
  {
    id: 'reused-flood',
    body: "This dramatic photo is being shared again. Does it really show today's weather?",
    illustration: 'assets/decor/message_flood.png',
    title: 'Flooding in our town now',
    short: 'Reused image',
    asset: 'assets/messages/message_reused_flood.png',
    issues: { source: false, date: false, image: true, urgent: false },
    truth: 'misleading',
    truthLabel: 'Misleading image',
    note: 'The photo is being shared again from another event, so it does not prove today’s flooding.'
  },
  {
    id: 'school-library',
    body: 'The school library closes at 4:30 PM this week. See the official school page.',
    illustration: 'assets/icons/icon_source_3d.png',
    title: 'Library hours updated',
    short: 'School circular',
    asset: 'assets/messages/message_legitimate_school.png',
    issues: { source: false, date: false, image: false, urgent: false },
    truth: 'real',
    truthLabel: 'Real notice',
    note: 'It matches a current notice on the official school page.'
  },
  {
    id: 'health-claim',
    body: 'Doctors do not want you to know this. Share now so everyone can try it!',
    illustration: 'assets/decor/message_health.png',
    title: 'One drink prevents every illness',
    short: 'Health claim',
    asset: 'assets/messages/message_herbal_immunity.png',
    issues: { source: true, date: false, image: false, urgent: true },
    truth: 'fake',
    truthLabel: 'Unsupported claim',
    note: 'No doctor or source is named, and it pressures you to share right now.'
  }
];
