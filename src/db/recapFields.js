// The seeded pool of recap measurements. Covers the app's prior built-in recap
// fields AND a complete trader's daily-recap template, so a fresh install has a
// rich default and any user can add/remove/extend from Settings.
// `key` is the stable storage/matching key. `aliases` are extra labels the
// importer will recognize (lowercased, punctuation-insensitive at match time).

export const DEFAULT_RECAP_FIELDS = [
  // — Day —
  { key: 'session', label: 'Session traded', type: 'select', section: 'Day', options: ['NYAM', 'NYPM', 'London', 'Asia', 'Other'], showByDefault: true, aliases: ['session', 'session traded'] },
  { key: 'market', label: 'Market traded', type: 'text', section: 'Day', showByDefault: false, aliases: ['market', 'market traded', 'instrument', 'main instrument', 'ticker', 'ticker/contract'] },
  { key: 'marketCondition', label: 'Market condition', type: 'select', section: 'Day', options: ['Trend', 'Range', 'Choppy', 'News-driven'], showByDefault: false, aliases: ['market condition'] },
  { key: 'followedRules', label: 'Did I follow my rules?', type: 'yesno', section: 'Day', showByDefault: true, aliases: ['did i follow my rules', 'followed rules', 'followed my rules'] },
  // — Pre-session plan —
  { key: 'bias', label: 'Bias', type: 'select', section: 'Pre-session plan', options: ['Bullish', 'Bearish', 'Neutral'], showByDefault: true, aliases: ['bias'] },
  { key: 'keyLevels', label: 'Key levels', type: 'longtext', section: 'Pre-session plan', showByDefault: false, aliases: ['key levels'] },
  { key: 'mainSetup', label: 'Main setup I was looking for', type: 'longtext', section: 'Pre-session plan', showByDefault: true, aliases: ['main setup i was looking for', 'main setup', 'setup i was looking for'] },
  { key: 'invalidation', label: 'Invalidation level', type: 'text', section: 'Pre-session plan', showByDefault: false, aliases: ['invalidation level', 'invalidation'] },
  { key: 'news', label: 'News / events I was aware of', type: 'text', section: 'Pre-session plan', showByDefault: false, aliases: ['news/events i was aware of', 'news events i was aware of', 'news', 'news/events', 'events'] },
  // — Execution review —
  { key: 'didChase', label: 'Did I chase?', type: 'yesno', section: 'Execution review', showByDefault: true, aliases: ['did i chase', 'chase'] },
  { key: 'didRevenge', label: 'Did I revenge trade?', type: 'yesno', section: 'Execution review', showByDefault: true, aliases: ['did i revenge trade', 'revenge trade', 'revenge'] },
  { key: 'didOvertrade', label: 'Did I overtrade?', type: 'yesno', section: 'Execution review', showByDefault: true, aliases: ['did i overtrade', 'overtrade'] },
  { key: 'movedStop', label: 'Did I move my stop?', type: 'yesno', section: 'Execution review', showByDefault: true, aliases: ['did i move my stop', 'moved stop', 'move my stop', 'moved my stop'] },
  { key: 'tookProfitsPlan', label: 'Did I take profits according to plan?', type: 'yesno', section: 'Execution review', showByDefault: false, aliases: ['did i take profits according to plan', 'took profits according to plan', 'take profits according to plan'] },
  { key: 'hesitated', label: 'Did I hesitate on a valid setup?', type: 'yesno', section: 'Execution review', showByDefault: false, aliases: ['did i hesitate on a valid setup', 'hesitate', 'hesitated'] },
  { key: 'enteredWithoutConfirm', label: 'Did I enter without confirmation?', type: 'yesno', section: 'Execution review', showByDefault: false, aliases: ['did i enter without confirmation', 'entered without confirmation', 'enter without confirmation'] },
  { key: 'bestTrade', label: 'Best trade of the day', type: 'text', section: 'Execution review', showByDefault: true, aliases: ['best trade of the day', 'best trade'] },
  { key: 'worstTrade', label: 'Worst trade of the day', type: 'text', section: 'Execution review', showByDefault: true, aliases: ['worst trade of the day', 'worst trade'] },
  { key: 'bestSetup', label: 'What setup worked best?', type: 'text', section: 'Execution review', showByDefault: false, aliases: ['what setup worked best', 'best setup'] },
  { key: 'failedSetup', label: 'What setup failed?', type: 'text', section: 'Execution review', showByDefault: false, aliases: ['what setup failed', 'failed setup'] },
  { key: 'followedMaxTrades', label: 'Did I follow max trades?', type: 'yesno', section: 'Execution review', showByDefault: false, aliases: ['did i follow max trades', 'followed max trades'] },
  { key: 'respectedRisk', label: 'Did I respect risk?', type: 'yesno', section: 'Execution review', showByDefault: false, aliases: ['did i respect risk', 'respected risk'] },
  { key: 'forcedAnything', label: 'Did I force anything?', type: 'yesno', section: 'Execution review', showByDefault: false, aliases: ['did i force anything', 'forced anything'] },
  // — Discipline —
  { key: 'disciplineScore', label: 'Discipline score (1–10)', type: 'rating', section: 'Discipline', showByDefault: true, aliases: ["rate today's discipline from 1-10", "rate today's discipline", 'discipline score', 'discipline'] },
  { key: 'disciplineWhy', label: 'Why that score?', type: 'longtext', section: 'Discipline', showByDefault: true, aliases: ['why that score', 'why that discipline score'] },
  { key: 'grade', label: 'Daily grade', type: 'select', section: 'Discipline', options: ['A+', 'A', 'B', 'C', 'D', 'F'], showByDefault: false, aliases: ['daily grade', 'grade'] },
  // — Reflection —
  { key: 'mainMistake', label: 'Main mistake today', type: 'longtext', section: 'Reflection', showByDefault: true, aliases: ['the biggest thing i did wrong was', 'main mistake today', 'main mistake', 'biggest mistake', 'biggest thing i did wrong'] },
  { key: 'mainWin', label: 'Main win today', type: 'longtext', section: 'Reflection', showByDefault: true, aliases: ['the biggest thing i did right was', 'main win today', 'main win', 'biggest win', 'biggest thing i did right'] },
  { key: 'lesson', label: 'Lesson from today', type: 'longtext', section: 'Reflection', showByDefault: true, aliases: ['what did today teach me', 'lesson from today', 'lesson'] },
  { key: 'ruleTomorrow', label: 'Rule for tomorrow', type: 'longtext', section: 'Reflection', showByDefault: true, aliases: ['tomorrow i will focus on', 'rule for tomorrow', 'focus tomorrow'] },
  { key: 'didWell', label: 'One thing I did well', type: 'longtext', section: 'Reflection', showByDefault: false, aliases: ['one thing i did well', 'what i did well', 'did well'] },
  { key: 'toFix', label: 'One thing to fix tomorrow', type: 'longtext', section: 'Reflection', showByDefault: false, aliases: ['one thing to fix tomorrow', 'what to fix', 'to fix'] },
  // — Wellbeing (optional; the app's older mental-state fields) —
  { key: 'sleep', label: 'Hours of sleep', type: 'number', section: 'Wellbeing', unit: 'hrs', showByDefault: false, aliases: ['hours of sleep', 'sleep'] },
  { key: 'energy', label: 'Energy', type: 'select', section: 'Wellbeing', options: ['Low', 'Medium', 'High'], showByDefault: false, aliases: ['energy'] },
  { key: 'stress', label: 'Stress', type: 'select', section: 'Wellbeing', options: ['Low', 'Medium', 'High'], showByDefault: false, aliases: ['stress'] },
]

// old recap key -> new field key (for migrating existing saved recaps)
export const RECAP_MIGRATION_MAP = {
  instrument: 'market', marketCondition: 'marketCondition', bestTrade: 'bestTrade', worstTrade: 'worstTrade',
  followedMaxTrades: 'followedMaxTrades', respectedRisk: 'respectedRisk', forcedAnything: 'forcedAnything',
  bestSetup: 'bestSetup', failedSetup: 'failedSetup', didWell: 'didWell', toFix: 'toFix',
  grade: 'grade', sleep: 'sleep', energy: 'energy', stress: 'stress',
}

export const SECTION_ORDER = ['Day', 'Pre-session plan', 'Execution review', 'Discipline', 'Reflection', 'Wellbeing', 'Custom', 'Other']

// Idempotent seed — only adds defaults if the table is empty.
export async function seedRecapFields(db) {
  const n = await db.recapFields.count()
  if (n > 0) return
  await db.recapFields.bulkAdd(DEFAULT_RECAP_FIELDS.map((f, i) => ({ ...f, options: f.options || [], aliases: f.aliases || [], order: i, archived: false })))
}
