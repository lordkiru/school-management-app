function computeGrade(total, section) {
  if (section === 'Secondary') {
    if (total >= 75) return 'A1';
    if (total >= 70) return 'B2';
    if (total >= 65) return 'B3';
    if (total >= 60) return 'C4';
    if (total >= 55) return 'C5';
    if (total >= 50) return 'C6';
    if (total >= 45) return 'D7';
    if (total >= 40) return 'E8';
    return 'F9';
  }

  // Primary, Nursery, Kindergarten, Creche
  if (total >= 90) return 'Excellent';
  if (total >= 80) return 'Very Good';
  if (total >= 70) return 'Good';
  if (total >= 60) return 'Fair';
  if (total >= 50) return 'Pass';
  return 'Poor';
}

module.exports = computeGrade;