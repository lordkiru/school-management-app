// Lemida Question Bank: a shared bank of exam questions that belongs to Lemida, not to any school.
//
// Boundaries (please keep them):
//  - Nothing in this folder imports SchoolManager domain code (Tenant, Student, Class, Subject, Score,
//    fees, plans...). SchoolManager may call the functions exported here; this module never calls it.
//  - Shared infrastructure comes in as arguments: createQuestionBankRouter({ requireAuth, requireRole }).
//  - Every permission check goes through canManageBank (permissions.js).
//
// API routes: see router.js. Functions for SchoolManager (no HTTP): listApprovedSubjects,
// pickApprovedQuestions. Import file format and the CLI: see README.md.
const { createQuestionBankRouter } = require('./router');
const { listApprovedSubjects, pickApprovedQuestions } = require('./service');
const { importQuestionBank } = require('./importer');
const { canManageBank } = require('./permissions');

module.exports = {
  createQuestionBankRouter,
  listApprovedSubjects,
  pickApprovedQuestions,
  importQuestionBank,
  canManageBank,
};
