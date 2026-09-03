const axios = require('axios');

/**
 * Create a Paystack Subaccount so a school's fee income settles directly
 * into their own bank account. percentage_charge is 0 because the platform
 * takes no commission — the school keeps 100% of the split (Paystack's own
 * processing fee is deducted separately via bearer_type: "subaccount").
 */
async function createSubaccount({ businessName, bankCode, accountNumber }) {
  const response = await axios.post(
    'https://api.paystack.co/subaccount',
    {
      business_name: businessName,
      bank_code: bankCode,
      account_number: accountNumber,
      percentage_charge: 0,
    },
    {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    }
  );
  return response.data.data;
}

module.exports = { createSubaccount };
