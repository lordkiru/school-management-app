const Counter = require('../models/Counter');

async function getNextSequence(name, tenantId) {
  const counter = await Counter.findOneAndUpdate(
    { name, tenantId },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
}

module.exports = getNextSequence;
