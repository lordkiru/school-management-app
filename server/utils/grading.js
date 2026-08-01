function computeGrade(total, section, maxTotal = 100) {
  const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : total;

  if (section === 'Secondary') {
    if (percentage >= 75) return 'A1';
    if (percentage >= 70) return 'B2';
    if (percentage >= 65) return 'B3';
    if (percentage >= 60) return 'C4';
    if (percentage >= 55) return 'C5';
    if (percentage >= 50) return 'C6';
    if (percentage >= 45) return 'D7';
    if (percentage >= 40) return 'E8';
    return 'F9';
  }

  if (percentage >= 90) return 'Excellent';
  if (percentage >= 80) return 'Very Good';
  if (percentage >= 70) return 'Good';
  if (percentage >= 60) return 'Fair';
  if (percentage >= 50) return 'Pass';
  return 'Poor';
}

module.exports = computeGrade;