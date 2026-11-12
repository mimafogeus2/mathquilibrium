// Special days, Hebrew: "YYYY-MM-DD|Occasion|level line". On that date the daily is this one instead of the pool's.
// Each date is used once ever: a holiday gets one line per year (Israeli holidays move with the Hebrew calendar: dates are per year).
const SPECIAL = `

`.trim().split('\n');
if (typeof module === 'object') module.exports = SPECIAL;
