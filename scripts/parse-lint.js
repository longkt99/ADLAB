const fs = require('fs');
const data = JSON.parse(fs.readFileSync('lint-report.json', 'utf8'));

// Filter to files with errors only
const filesWithErrors = data.filter(f => f.errorCount > 0);

// Count errors by rule
const ruleErrors = {};
filesWithErrors.forEach(f => {
  f.messages.forEach(m => {
    if (m.severity === 2) {
      ruleErrors[m.ruleId] = (ruleErrors[m.ruleId] || 0) + 1;
    }
  });
});

// Sort rules by count
const sortedRules = Object.entries(ruleErrors).sort((a,b) => b[1] - a[1]);
console.log('=== TOTALS BY RULE ===');
sortedRules.forEach(([rule, count]) => {
  console.log(count.toString().padStart(4) + '  ' + rule);
});
console.log('');
console.log('Total errors:', sortedRules.reduce((a,b) => a + b[1], 0));
console.log('');

// Top 15 files by error count
const filesSorted = filesWithErrors
  .map(f => ({
    path: f.filePath.split('Content Machine')[1] || f.filePath,
    errorCount: f.errorCount,
    errors: f.messages.filter(m => m.severity === 2).reduce((acc, m) => {
      acc[m.ruleId] = (acc[m.ruleId] || 0) + 1;
      return acc;
    }, {})
  }))
  .sort((a,b) => b.errorCount - a.errorCount)
  .slice(0, 15);

console.log('=== TOP 15 FILES BY ERROR COUNT ===');
filesSorted.forEach((f, i) => {
  const rulesStr = Object.entries(f.errors).map(([r,c]) => r + ':' + c).join(', ');
  console.log((i+1).toString().padStart(2) + '. ' + f.path + ' (' + f.errorCount + ')');
  console.log('    ' + rulesStr);
});
