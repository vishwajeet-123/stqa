import { Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import {
  ApiTestHistory,
  AuditLog,
  Defect,
  NonFunctionalTest,
  Order,
  QAReport,
  Requirement,
  TestCase,
  TestExecution,
  TestSuite,
} from '../models.ts';
import { recordAuditLog, requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.ts';
import { runPlaywrightTest } from '../playwrightRunner.ts';
import { seedDatabase } from '../seed.ts';

export function createStqaRouter(io: SocketIOServer) {
  const router = Router();

  // Strictly protect all STQA Dashboard endpoints for qa_admin only
  router.use(requireAuth, requireRole('qa_admin'));

  // --- OVERVIEW ANALYTICS (Dynamically computed from MongoDB) ---
  router.get('/overview', async (_req, res) => {
    try {
      const [testCases, defects, executions, auditLogs, suites, requirements, ordersCount] =
        await Promise.all([
          TestCase.find().lean(),
          Defect.find().lean(),
          TestExecution.find().sort({ createdAt: -1 }).limit(50).lean(),
          AuditLog.find().sort({ createdAt: -1 }).limit(20).lean(),
          TestSuite.find().lean(),
          Requirement.find().lean(),
          Order.countDocuments(),
        ]);

      const totalTestCases = testCases.length;
      const passedCount = testCases.filter((t) => t.status === 'Passed').length;
      const failedCount = testCases.filter((t) => t.status === 'Failed').length;
      const blockedCount = testCases.filter((t) => t.status === 'Blocked').length;
      const notExecutedCount = testCases.filter((t) => t.status === 'Not Executed').length;
      const executedCount = totalTestCases - notExecutedCount;

      const totalDefects = defects.length;
      const openDefects = defects.filter((d) => d.status !== 'Closed').length;
      const criticalDefects = defects.filter(
        (d) => d.severity === 'Critical' && d.status !== 'Closed'
      ).length;

      const executionPercentage =
        totalTestCases > 0 ? Number(((executedCount / totalTestCases) * 100).toFixed(1)) : 0;
      const passPercentage =
        executedCount > 0 ? Number(((passedCount / executedCount) * 100).toFixed(1)) : 0;

      const statusDistribution = [
        { name: 'Passed', value: passedCount, color: '#10b981' },
        { name: 'Failed', value: failedCount, color: '#ef4444' },
        { name: 'Blocked', value: blockedCount, color: '#f59e0b' },
        { name: 'Not Executed', value: notExecutedCount, color: '#94a3b8' },
      ];

      // Module-wise breakdown
      const moduleMap = new Map<
        string,
        { module: string; Passed: number; Failed: number; Blocked: number; NotExecuted: number }
      >();
      for (const tc of testCases) {
        if (!moduleMap.has(tc.module)) {
          moduleMap.set(tc.module, {
            module: tc.module,
            Passed: 0,
            Failed: 0,
            Blocked: 0,
            NotExecuted: 0,
          });
        }
        const entry = moduleMap.get(tc.module)!;
        if (tc.status === 'Passed') entry.Passed += 1;
        else if (tc.status === 'Failed') entry.Failed += 1;
        else if (tc.status === 'Blocked') entry.Blocked += 1;
        else entry.NotExecuted += 1;
      }

      const defectsBySeverity = ['Critical', 'Major', 'Minor', 'Trivial'].map((sev) => ({
        severity: sev,
        count: defects.filter((d) => d.severity === sev).length,
      }));

      // Execution history grouped by date
      const historyMap = new Map<
        string,
        { date: string; Passed: number; Failed: number; Blocked: number }
      >();
      for (const ex of [...executions].reverse()) {
        const day = new Date(ex.createdAt).toISOString().slice(0, 10);
        if (!historyMap.has(day)) {
          historyMap.set(day, { date: day, Passed: 0, Failed: 0, Blocked: 0 });
        }
        const h = historyMap.get(day)!;
        if (ex.status === 'Passed') h.Passed += 1;
        else if (ex.status === 'Failed') h.Failed += 1;
        else h.Blocked += 1;
      }

      const coveredReqs = requirements.filter((r) => (r.linkedTestCaseIds?.length || 0) > 0).length;

      return res.json({
        kpis: {
          totalTestCases,
          passedCount,
          failedCount,
          blockedCount,
          notExecutedCount,
          totalDefects,
          openDefects,
          criticalDefects,
          executionPercentage,
          passPercentage,
          totalSuites: suites.length,
          totalRequirements: requirements.length,
          coveredRequirements: coveredReqs,
          liveOrdersCount: ordersCount,
        },
        charts: {
          statusDistribution,
          moduleExecution: Array.from(moduleMap.values()),
          defectsBySeverity,
          executionHistory: Array.from(historyMap.values()),
        },
        recentExecutions: executions.slice(0, 10),
        recentActivities: auditLogs,
      });
    } catch (err) {
      console.error('[STQA] Overview error:', err);
      return res.status(500).json({ error: 'Failed to compute STQA overview metrics.' });
    }
  });

  // --- TEST SUITES ---
  router.get('/test-suites', async (_req, res) => {
    const suites = await TestSuite.find().sort({ isCustom: 1, name: 1 }).lean();
    const cases = await TestCase.find().select('suiteId status').lean();
    const enriched = suites.map((s) => {
      const suiteCases = cases.filter((c) => String(c.suiteId) === String(s._id));
      return {
        ...s,
        totalCases: suiteCases.length,
        passedCases: suiteCases.filter((c) => c.status === 'Passed').length,
        failedCases: suiteCases.filter((c) => c.status === 'Failed').length,
      };
    });
    return res.json({ suites: enriched });
  });

  router.post('/test-suites', async (req: AuthedRequest, res) => {
    try {
      const { name, description, moduleCategory } = req.body || {};
      if (!name || !description || !moduleCategory) {
        return res.status(400).json({ error: 'Suite name, description, and module category are required.' });
      }
      const slug = String(name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const existing = await TestSuite.findOne({ $or: [{ name: String(name).trim() }, { slug }] });
      if (existing) return res.status(409).json({ error: 'A test suite with this name already exists.' });

      const suite = await TestSuite.create({
        name: String(name).trim(),
        slug,
        description: String(description).trim(),
        moduleCategory: String(moduleCategory).trim(),
        isCustom: true,
        isSeeded: false,
      });

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'SUITE_CREATED',
        module: 'STQA Suites',
        entityType: 'TestSuite',
        entityId: suite.name,
        details: `Created custom test suite "${suite.name}"`,
      });

      return res.status(201).json({ suite });
    } catch {
      return res.status(500).json({ error: 'Failed to create test suite.' });
    }
  });

  router.delete('/test-suites/:id', async (req: AuthedRequest, res) => {
    const suite = await TestSuite.findById(req.params.id);
    if (!suite) return res.status(404).json({ error: 'Suite not found.' });
    const count = await TestCase.countDocuments({ suiteId: suite._id });
    if (count > 0) {
      return res.status(400).json({
        error: `Cannot delete suite with ${count} assigned test cases. Reassign or remove test cases first.`,
      });
    }
    await TestSuite.deleteOne({ _id: suite._id });
    return res.json({ deleted: true });
  });

  // --- TEST CASES ---
  router.get('/test-cases', async (req, res) => {
    try {
      const { search, module, priority, status, suiteId } = req.query;
      const filter: Record<string, any> = {};
      if (module && module !== 'All') filter.module = String(module);
      if (priority && priority !== 'All') filter.priority = String(priority);
      if (status && status !== 'All') filter.status = String(status);
      if (suiteId && suiteId !== 'All') filter.suiteId = String(suiteId);
      if (search && String(search).trim()) {
        const regex = new RegExp(String(search).trim(), 'i');
        filter.$or = [
          { testCaseId: regex },
          { title: regex },
          { testScenario: regex },
          { module: regex },
        ];
      }

      const testCases = await TestCase.find(filter)
        .populate('suiteId', 'name slug')
        .sort({ testCaseId: 1 })
        .lean();

      return res.json({ testCases });
    } catch {
      return res.status(500).json({ error: 'Failed to load test cases.' });
    }
  });

  router.post('/test-cases', async (req: AuthedRequest, res) => {
    try {
      const {
        testCaseId,
        title,
        suiteId,
        module,
        testScenario,
        preconditions,
        testSteps,
        testData,
        expectedResult,
        priority,
      } = req.body || {};

      if (!title || !suiteId || !module || !testScenario || !expectedResult) {
        return res.status(400).json({
          error: 'Title, suite, module, test scenario, and expected result are required.',
        });
      }

      let resolvedCode = testCaseId ? String(testCaseId).trim().toUpperCase() : '';
      if (!resolvedCode) {
        const allCodes = await TestCase.find().select('testCaseId').lean();
        const maxNum = allCodes.reduce((max, item) => {
          const num = parseInt(item.testCaseId.replace(/[^0-9]/g, ''), 10);
          return Number.isFinite(num) && num > max ? num : max;
        }, 0);
        resolvedCode = `TC-${String(maxNum + 1).padStart(3, '0')}`;
      }

      const dup = await TestCase.findOne({ testCaseId: resolvedCode });
      if (dup) {
        return res.status(409).json({ error: `Test case ID ${resolvedCode} already exists.` });
      }

      const stepsArray = Array.isArray(testSteps)
        ? testSteps.map((s) => String(s).trim()).filter(Boolean)
        : String(testSteps || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);

      const tc = await TestCase.create({
        testCaseId: resolvedCode,
        title: String(title).trim(),
        suiteId,
        module: String(module).trim(),
        testScenario: String(testScenario).trim(),
        preconditions: String(preconditions || 'Application running and database connected').trim(),
        testSteps: stepsArray.length > 0 ? stepsArray : ['Execute test scenario'],
        testData: String(testData || '').trim(),
        expectedResult: String(expectedResult).trim(),
        actualResult: '',
        priority: priority || 'Medium',
        status: 'Not Executed',
        createdBy: req.user!.userId,
        isSeeded: false,
      });

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'TEST_CASE_CREATED',
        module: 'STQA Test Cases',
        entityType: 'TestCase',
        entityId: tc.testCaseId,
        details: `Created ${tc.testCaseId}: ${tc.title}`,
      });

      io.emit('stqa:updated', { type: 'test_case_created', testCaseId: tc.testCaseId });
      const populated = await TestCase.findById(tc._id).populate('suiteId', 'name slug').lean();
      return res.status(201).json({ testCase: populated });
    } catch {
      return res.status(500).json({ error: 'Failed to create test case.' });
    }
  });

  router.put('/test-cases/:id', async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        suiteId,
        module,
        testScenario,
        preconditions,
        testSteps,
        testData,
        expectedResult,
        priority,
      } = req.body || {};

      const stepsArray = Array.isArray(testSteps)
        ? testSteps.map((s) => String(s).trim()).filter(Boolean)
        : String(testSteps || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean);

      const updated = await TestCase.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            ...(title ? { title: String(title).trim() } : {}),
            ...(suiteId ? { suiteId } : {}),
            ...(module ? { module: String(module).trim() } : {}),
            ...(testScenario ? { testScenario: String(testScenario).trim() } : {}),
            ...(preconditions !== undefined ? { preconditions: String(preconditions).trim() } : {}),
            ...(stepsArray.length > 0 ? { testSteps: stepsArray } : {}),
            ...(testData !== undefined ? { testData: String(testData).trim() } : {}),
            ...(expectedResult ? { expectedResult: String(expectedResult).trim() } : {}),
            ...(priority ? { priority } : {}),
          },
        },
        { new: true }
      ).populate('suiteId', 'name slug');

      if (!updated) return res.status(404).json({ error: 'Test case not found.' });

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'TEST_CASE_UPDATED',
        module: 'STQA Test Cases',
        entityType: 'TestCase',
        entityId: updated.testCaseId,
        details: `Updated ${updated.testCaseId}`,
      });

      io.emit('stqa:updated', { type: 'test_case_updated', testCaseId: updated.testCaseId });
      return res.json({ testCase: updated });
    } catch {
      return res.status(500).json({ error: 'Failed to update test case.' });
    }
  });

  router.delete('/test-cases/:id', async (req: AuthedRequest, res) => {
    const tc = await TestCase.findByIdAndDelete(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Test case not found.' });
    await TestExecution.deleteMany({ testCaseId: tc._id });
    await Requirement.updateMany({}, { $pull: { linkedTestCaseIds: tc._id } });
    io.emit('stqa:updated', { type: 'test_case_deleted', testCaseId: tc.testCaseId });
    return res.json({ deleted: true });
  });

  // --- TEST EXECUTION (Manual & Playwright Automated) ---
  router.get('/test-executions', async (req, res) => {
    const { testCaseId } = req.query;
    const filter: Record<string, any> = {};
    if (testCaseId) filter.testCaseId = String(testCaseId);
    const executions = await TestExecution.find(filter)
      .populate('testCaseId', 'testCaseId title module')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ executions });
  });

  router.post('/test-executions/manual', async (req: AuthedRequest, res) => {
    try {
      const { testCaseId, status, actualResult, comments, evidenceScreenshot } = req.body || {};
      if (!testCaseId || !['Passed', 'Failed', 'Blocked'].includes(status) || !actualResult) {
        return res.status(400).json({
          error: 'Test case ID, valid execution status (Passed/Failed/Blocked), and actual result are required.',
        });
      }

      const tc = await TestCase.findById(testCaseId);
      if (!tc) return res.status(404).json({ error: 'Test case not found.' });

      const execution = await TestExecution.create({
        testCaseId: tc._id,
        tcCode: tc.testCaseId,
        executionMode: 'Manual',
        status,
        actualResult: String(actualResult).trim(),
        comments: String(comments || '').trim(),
        evidenceScreenshot: String(evidenceScreenshot || ''),
        durationMs: 0,
        logs: [`Manual execution recorded by ${req.user!.name} (${status})`],
        executedBy: req.user!.userId,
        executorName: req.user!.name,
      });

      tc.status = status;
      tc.actualResult = String(actualResult).trim();
      await tc.save();

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'TEST_EXECUTED_MANUAL',
        module: 'STQA Execution',
        entityType: 'TestExecution',
        entityId: tc.testCaseId,
        details: `${tc.testCaseId} marked ${status} (Manual)`,
      });

      io.emit('stqa:updated', { type: 'test_executed', testCaseId: tc.testCaseId, status });
      return res.status(201).json({ execution, testCase: tc });
    } catch {
      return res.status(500).json({ error: 'Failed to save manual test execution.' });
    }
  });

  router.post('/test-executions/automated', async (req: AuthedRequest, res) => {
    try {
      const { testCaseId } = req.body || {};
      const tc = await TestCase.findById(testCaseId);
      if (!tc) return res.status(404).json({ error: 'Test case not found.' });
      if (!tc.automationKey) {
        return res.status(400).json({
          error: `${tc.testCaseId} does not have a Playwright automation script mapped. Record a manual execution instead.`,
        });
      }

      const runResult = await runPlaywrightTest(tc.automationKey, tc.testCaseId);

      const execution = await TestExecution.create({
        testCaseId: tc._id,
        tcCode: tc.testCaseId,
        executionMode: 'Automated (Playwright)',
        status: runResult.status,
        actualResult: runResult.actualResult,
        comments: `Automated Playwright run completed in ${runResult.durationMs}ms.`,
        evidenceScreenshot: runResult.evidenceScreenshot,
        durationMs: runResult.durationMs,
        logs: runResult.logs,
        executedBy: req.user!.userId,
        executorName: `${req.user!.name} (Playwright)`,
      });

      tc.status = runResult.status;
      tc.actualResult = runResult.actualResult;
      await tc.save();

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'TEST_EXECUTED_PLAYWRIGHT',
        module: 'STQA Execution',
        entityType: 'TestExecution',
        entityId: tc.testCaseId,
        details: `Playwright run for ${tc.testCaseId} -> ${runResult.status} (${runResult.durationMs}ms)`,
      });

      io.emit('stqa:updated', {
        type: 'test_executed_automated',
        testCaseId: tc.testCaseId,
        status: runResult.status,
      });

      return res.status(201).json({ execution, testCase: tc });
    } catch (err) {
      console.error('[STQA] Playwright execution error:', err);
      return res.status(500).json({ error: 'Automated Playwright execution failed.' });
    }
  });

  // --- DEFECTS ---
  router.get('/defects', async (req, res) => {
    const { module, severity, status, search } = req.query;
    const filter: Record<string, any> = {};
    if (module && module !== 'All') filter.module = String(module);
    if (severity && severity !== 'All') filter.severity = String(severity);
    if (status && status !== 'All') filter.status = String(status);
    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ defectId: regex }, { title: regex }, { description: regex }];
    }

    const defects = await Defect.find(filter)
      .populate('linkedTestCaseId', 'testCaseId title status')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ defects });
  });

  router.post('/defects', async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        module,
        description,
        stepsToReproduce,
        expectedResult,
        actualResult,
        severity,
        priority,
        assignedTo,
        linkedTestCaseId,
        linkedExecutionId,
        evidenceScreenshot,
      } = req.body || {};

      if (!title || !module || !description || !stepsToReproduce || !expectedResult || !actualResult) {
        return res.status(400).json({
          error: 'Title, module, description, steps to reproduce, expected result, and actual result are required.',
        });
      }

      const existing = await Defect.find().select('defectId').lean();
      const maxNum = existing.reduce((max, d) => {
        const num = parseInt(d.defectId.replace(/[^0-9]/g, ''), 10);
        return Number.isFinite(num) && num > max ? num : max;
      }, 0);
      const defectId = `BUG-${String(maxNum + 1).padStart(3, '0')}`;

      const defect = await Defect.create({
        defectId,
        title: String(title).trim(),
        module: String(module).trim(),
        description: String(description).trim(),
        stepsToReproduce: String(stepsToReproduce).trim(),
        expectedResult: String(expectedResult).trim(),
        actualResult: String(actualResult).trim(),
        severity: severity || 'Major',
        priority: priority || 'Medium',
        status: assignedTo && assignedTo !== 'Unassigned' ? 'Assigned' : 'Open',
        assignedTo: String(assignedTo || 'Unassigned').trim(),
        linkedTestCaseId: linkedTestCaseId || null,
        linkedExecutionId: linkedExecutionId || null,
        evidenceScreenshot: String(evidenceScreenshot || ''),
        reportedBy: req.user!.userId,
        reportedByName: req.user!.name,
        reportedDate: new Date(),
        statusHistory: [
          {
            status: assignedTo && assignedTo !== 'Unassigned' ? 'Assigned' : 'Open',
            changedBy: req.user!.name,
            note: 'Defect reported',
            timestamp: new Date(),
          },
        ],
      });

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'DEFECT_REPORTED',
        module: 'STQA Defects',
        entityType: 'Defect',
        entityId: defect.defectId,
        details: `Reported ${defect.defectId} [${defect.severity}]: ${defect.title}`,
      });

      io.emit('stqa:updated', { type: 'defect_created', defectId: defect.defectId });
      const populated = await Defect.findById(defect._id)
        .populate('linkedTestCaseId', 'testCaseId title status')
        .lean();
      return res.status(201).json({ defect: populated });
    } catch {
      return res.status(500).json({ error: 'Failed to report defect.' });
    }
  });

  router.put('/defects/:id', async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        module,
        description,
        stepsToReproduce,
        expectedResult,
        actualResult,
        severity,
        priority,
        assignedTo,
        linkedTestCaseId,
      } = req.body || {};

      const defect = await Defect.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            ...(title ? { title: String(title).trim() } : {}),
            ...(module ? { module: String(module).trim() } : {}),
            ...(description ? { description: String(description).trim() } : {}),
            ...(stepsToReproduce ? { stepsToReproduce: String(stepsToReproduce).trim() } : {}),
            ...(expectedResult ? { expectedResult: String(expectedResult).trim() } : {}),
            ...(actualResult ? { actualResult: String(actualResult).trim() } : {}),
            ...(severity ? { severity } : {}),
            ...(priority ? { priority } : {}),
            ...(assignedTo !== undefined ? { assignedTo: String(assignedTo).trim() } : {}),
            ...(linkedTestCaseId !== undefined ? { linkedTestCaseId: linkedTestCaseId || null } : {}),
          },
        },
        { new: true }
      ).populate('linkedTestCaseId', 'testCaseId title status');

      if (!defect) return res.status(404).json({ error: 'Defect not found.' });
      io.emit('stqa:updated', { type: 'defect_updated', defectId: defect.defectId });
      return res.json({ defect });
    } catch {
      return res.status(500).json({ error: 'Failed to update defect.' });
    }
  });

  router.patch('/defects/:id/status', async (req: AuthedRequest, res) => {
    try {
      const { status, note, assignedTo } = req.body || {};
      const defect = await Defect.findById(req.params.id);
      if (!defect) return res.status(404).json({ error: 'Defect not found.' });

      // Enforce retest verification when closing a defect linked to a failed test case
      if (status === 'Closed' && defect.linkedTestCaseId) {
        const linkedTc = await TestCase.findById(defect.linkedTestCaseId);
        if (linkedTc && linkedTc.status !== 'Passed') {
          return res.status(400).json({
            error: `Cannot close ${defect.defectId}: linked test case ${linkedTc.testCaseId} is currently "${linkedTc.status}". Retest and pass ${linkedTc.testCaseId} first.`,
          });
        }
      }

      if (assignedTo !== undefined) defect.assignedTo = String(assignedTo).trim();
      defect.status = status;
      defect.statusHistory.push({
        status,
        changedBy: req.user!.name,
        note: note ? String(note).trim() : `Status changed to ${status}`,
        timestamp: new Date(),
      });
      await defect.save();

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'DEFECT_STATUS_CHANGED',
        module: 'STQA Defects',
        entityType: 'Defect',
        entityId: defect.defectId,
        details: `${defect.defectId} transitioned to ${status}`,
      });

      io.emit('stqa:updated', { type: 'defect_status', defectId: defect.defectId, status });
      const populated = await Defect.findById(defect._id)
        .populate('linkedTestCaseId', 'testCaseId title status')
        .lean();
      return res.json({ defect: populated });
    } catch {
      return res.status(500).json({ error: 'Failed to update defect status.' });
    }
  });

  router.post('/defects/:id/comments', async (req: AuthedRequest, res) => {
    try {
      const { text } = req.body || {};
      if (!text || !String(text).trim()) {
        return res.status(400).json({ error: 'Comment text is required.' });
      }
      const defect = await Defect.findById(req.params.id);
      if (!defect) return res.status(404).json({ error: 'Defect not found.' });

      defect.comments.push({
        authorId: req.user!.userId,
        authorName: req.user!.name,
        role: req.user!.role,
        text: String(text).trim(),
        createdAt: new Date(),
      } as any);
      await defect.save();

      const populated = await Defect.findById(defect._id)
        .populate('linkedTestCaseId', 'testCaseId title status')
        .lean();
      return res.json({ defect: populated });
    } catch {
      return res.status(500).json({ error: 'Failed to add comment.' });
    }
  });

  // --- REQUIREMENTS TRACEABILITY MATRIX (RTM) ---
  router.get('/rtm', async (_req, res) => {
    const [requirements, defects] = await Promise.all([
      Requirement.find()
        .populate('linkedTestCaseIds', 'testCaseId title status module priority')
        .sort({ reqId: 1 })
        .lean(),
      Defect.find().select('defectId status severity linkedTestCaseId').lean(),
    ]);

    const matrix = requirements.map((reqDoc: any) => {
      const linkedCases = reqDoc.linkedTestCaseIds || [];
      const linkedCaseIds = new Set(linkedCases.map((c: any) => String(c._id)));
      const linkedDefects = defects.filter(
        (d) => d.linkedTestCaseId && linkedCaseIds.has(String(d.linkedTestCaseId))
      );

      let coverageStatus = 'Uncovered';
      if (linkedCases.length > 0) {
        const allPassed = linkedCases.every((c: any) => c.status === 'Passed');
        const anyFailed = linkedCases.some((c: any) => c.status === 'Failed');
        const anyExecuted = linkedCases.some((c: any) => c.status !== 'Not Executed');
        if (anyFailed) coverageStatus = 'Failed';
        else if (allPassed) coverageStatus = 'Fully Passed';
        else if (anyExecuted) coverageStatus = 'Partially Executed';
        else coverageStatus = 'Mapped (Not Executed)';
      }

      return {
        ...reqDoc,
        linkedDefects,
        coverageStatus,
      };
    });

    const totalReqs = matrix.length;
    const mappedReqs = matrix.filter((r) => r.linkedTestCaseIds.length > 0).length;
    const passedReqs = matrix.filter((r) => r.coverageStatus === 'Fully Passed').length;

    return res.json({
      matrix,
      summary: {
        totalRequirements: totalReqs,
        mappedRequirements: mappedReqs,
        uncoveredRequirements: totalReqs - mappedReqs,
        passedRequirements: passedReqs,
        mappingCoveragePercent: totalReqs > 0 ? Number(((mappedReqs / totalReqs) * 100).toFixed(1)) : 0,
      },
    });
  });

  router.post('/rtm', async (req: AuthedRequest, res) => {
    try {
      const { reqId, title, description, module, priority, linkedTestCaseIds } = req.body || {};
      if (!title || !description || !module) {
        return res.status(400).json({ error: 'Title, description, and module are required.' });
      }

      let code = reqId ? String(reqId).trim().toUpperCase() : '';
      if (!code) {
        const all = await Requirement.find().select('reqId').lean();
        const maxNum = all.reduce((m, r) => {
          const n = parseInt(r.reqId.replace(/[^0-9]/g, ''), 10);
          return Number.isFinite(n) && n > m ? n : m;
        }, 0);
        code = `REQ-${String(maxNum + 1).padStart(3, '0')}`;
      }

      const requirement = await Requirement.create({
        reqId: code,
        title: String(title).trim(),
        description: String(description).trim(),
        module: String(module).trim(),
        priority: priority || 'High',
        linkedTestCaseIds: Array.isArray(linkedTestCaseIds) ? linkedTestCaseIds : [],
        isSeeded: false,
      });

      return res.status(201).json({ requirement });
    } catch {
      return res.status(500).json({ error: 'Failed to create requirement.' });
    }
  });

  router.patch('/rtm/:id/link', async (req, res) => {
    try {
      const { linkedTestCaseIds } = req.body || {};
      const updated = await Requirement.findByIdAndUpdate(
        req.params.id,
        { $set: { linkedTestCaseIds: Array.isArray(linkedTestCaseIds) ? linkedTestCaseIds : [] } },
        { new: true }
      ).populate('linkedTestCaseIds', 'testCaseId title status module priority');
      if (!updated) return res.status(404).json({ error: 'Requirement not found.' });
      return res.json({ requirement: updated });
    } catch {
      return res.status(500).json({ error: 'Failed to update requirement linkage.' });
    }
  });

  // --- API TESTING WORKBENCH ---
  router.get('/api-test/history', async (_req, res) => {
    const history = await ApiTestHistory.find().sort({ createdAt: -1 }).limit(30).lean();
    return res.json({ history });
  });

  router.post('/api-test/execute', async (req: AuthedRequest, res) => {
    try {
      const { method = 'GET', endpoint, headers = {}, body } = req.body || {};
      const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      if (!allowedMethods.includes(String(method).toUpperCase())) {
        return res.status(400).json({ error: 'Invalid HTTP method.' });
      }

      const cleanEndpoint = String(endpoint || '').trim();
      if (!cleanEndpoint.startsWith('/api/')) {
        return res.status(400).json({
          error: 'Only relative project API endpoints starting with "/api/" are permitted.',
        });
      }

      // Protect destructive reset endpoints from accidental trigger inside API tester
      if (cleanEndpoint.includes('/reset-demo') || cleanEndpoint.includes('/api-test')) {
        return res.status(403).json({
          error: 'Protected administrative endpoint cannot be invoked from the API tester.',
        });
      }

      const port = process.env.PORT || 3000;
      const targetUrl = `http://127.0.0.1:${port}${cleanEndpoint}`;
      const upperMethod = String(method).toUpperCase();

      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(typeof headers === 'object' && headers !== null ? headers : {}),
      };
      if (!reqHeaders.Authorization && !reqHeaders.authorization && req.headers.authorization) {
        reqHeaders.Authorization = req.headers.authorization;
      }

      const t0 = performance.now();
      const response = await fetch(targetUrl, {
        method: upperMethod,
        headers: reqHeaders,
        body:
          upperMethod !== 'GET' && upperMethod !== 'DELETE' && body !== undefined && body !== null
            ? typeof body === 'string'
              ? body
              : JSON.stringify(body)
            : undefined,
      });
      const responseTimeMs = Math.round(performance.now() - t0);
      const rawText = await response.text();
      let parsedBody: any = rawText;
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        // leave as string
      }

      const record = await ApiTestHistory.create({
        method: upperMethod as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        endpoint: cleanEndpoint,
        requestHeaders: { ...reqHeaders, Authorization: reqHeaders.Authorization ? '[REDACTED]' : undefined },
        requestBody: body ?? null,
        statusCode: response.status,
        responseTimeMs,
        responseBody: parsedBody,
        executedBy: req.user!.userId,
        executorName: req.user!.name,
      });

      return res.json({ result: record });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'API test request failed.' });
    }
  });

  // --- NON-FUNCTIONAL TESTING ---
  router.get('/non-functional', async (req, res) => {
    const { category } = req.query;
    const filter: Record<string, any> = {};
    if (category && category !== 'All') filter.category = String(category);
    const records = await NonFunctionalTest.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ records });
  });

  router.post('/non-functional', async (req: AuthedRequest, res) => {
    try {
      const { category, title, metricName, measuredValue, threshold, status, observations, evidenceNote } =
        req.body || {};
      if (!category || !title || !metricName || !measuredValue || !threshold || !status || !observations) {
        return res.status(400).json({ error: 'All non-functional test fields are required.' });
      }
      const record = await NonFunctionalTest.create({
        category,
        title: String(title).trim(),
        metricName: String(metricName).trim(),
        measuredValue: String(measuredValue).trim(),
        threshold: String(threshold).trim(),
        status,
        observations: String(observations).trim(),
        evidenceNote: String(evidenceNote || '').trim(),
        measurementMethod: 'Manual Observation',
        recordedBy: req.user!.userId,
        recordedByName: req.user!.name,
      });
      return res.status(201).json({ record });
    } catch {
      return res.status(500).json({ error: 'Failed to save non-functional observation.' });
    }
  });

  router.post('/non-functional/benchmark', async (req: AuthedRequest, res) => {
    try {
      const { endpoint = '/api/products', concurrency = 5 } = req.body || {};
      const cleanEndpoint = String(endpoint).startsWith('/api/') ? String(endpoint) : '/api/products';
      const count = Math.min(Math.max(Number(concurrency) || 5, 1), 20);
      const port = process.env.PORT || 3000;
      const targetUrl = `http://127.0.0.1:${port}${cleanEndpoint}`;

      const tStart = performance.now();
      const timings = await Promise.all(
        Array.from({ length: count }).map(async () => {
          const t0 = performance.now();
          const r = await fetch(targetUrl, {
            headers: req.headers.authorization
              ? { Authorization: req.headers.authorization }
              : undefined,
          });
          await r.text();
          return { ms: Math.round(performance.now() - t0), ok: r.ok };
        })
      );
      const totalElapsed = Math.round(performance.now() - tStart);
      const avgMs = Math.round(timings.reduce((a, b) => a + b.ms, 0) / timings.length);
      const maxMs = Math.max(...timings.map((t) => t.ms));
      const failures = timings.filter((t) => !t.ok).length;

      const record = await NonFunctionalTest.create({
        category: 'Performance Testing',
        title: `Concurrent HTTP Benchmark (${cleanEndpoint})`,
        metricName: `Avg Latency across ${count} parallel requests`,
        measuredValue: `${avgMs}ms avg / ${maxMs}ms max (${totalElapsed}ms total)`,
        threshold: '< 300ms average',
        status: avgMs < 300 && failures === 0 ? 'Passed' : 'Failed',
        observations: `Executed ${count} concurrent GET requests against ${cleanEndpoint}. ${count - failures}/${count} returned 2xx.`,
        evidenceNote: `Individual latencies: ${timings.map((t) => `${t.ms}ms`).join(', ')}`,
        measurementMethod: 'Automated HTTP Benchmark',
        recordedBy: req.user!.userId,
        recordedByName: req.user!.name,
      });

      return res.status(201).json({ record });
    } catch {
      return res.status(500).json({ error: 'Benchmark failed.' });
    }
  });

  // --- QA REPORTS ---
  router.get('/reports/preview', async (req, res) => {
    try {
      const { dateFrom, dateTo, module: moduleFilter } = req.query;

      const tcFilter: Record<string, any> = {};
      if (moduleFilter && moduleFilter !== 'All') tcFilter.module = String(moduleFilter);

      const execFilter: Record<string, any> = {};
      if (dateFrom || dateTo) {
        execFilter.createdAt = {};
        if (dateFrom) execFilter.createdAt.$gte = new Date(String(dateFrom));
        if (dateTo) {
          const end = new Date(String(dateTo));
          end.setHours(23, 59, 59, 999);
          execFilter.createdAt.$lte = end;
        }
      }

      const defectFilter: Record<string, any> = {};
      if (moduleFilter && moduleFilter !== 'All') defectFilter.module = String(moduleFilter);
      if (dateFrom || dateTo) {
        defectFilter.reportedDate = {};
        if (dateFrom) defectFilter.reportedDate.$gte = new Date(String(dateFrom));
        if (dateTo) {
          const end = new Date(String(dateTo));
          end.setHours(23, 59, 59, 999);
          defectFilter.reportedDate.$lte = end;
        }
      }

      const [testCases, executions, defects] = await Promise.all([
        TestCase.find(tcFilter).lean(),
        TestExecution.find(execFilter).lean(),
        Defect.find(defectFilter).lean(),
      ]);

      // If date filter is provided, compute test case status based on latest execution within date range
      let effectiveCases = testCases;
      if (dateFrom || dateTo) {
        const latestByTc = new Map<string, string>();
        for (const ex of executions) {
          latestByTc.set(String(ex.testCaseId), ex.status);
        }
        effectiveCases = testCases.map((tc) => ({
          ...tc,
          status: (latestByTc.get(String(tc._id)) as any) || 'Not Executed',
        }));
      }

      const totalTestCases = effectiveCases.length;
      const passed = effectiveCases.filter((c) => c.status === 'Passed').length;
      const failed = effectiveCases.filter((c) => c.status === 'Failed').length;
      const blocked = effectiveCases.filter((c) => c.status === 'Blocked').length;
      const notExecuted = effectiveCases.filter((c) => c.status === 'Not Executed').length;
      const executed = totalTestCases - notExecuted;

      const executionRate =
        totalTestCases > 0 ? Number(((executed / totalTestCases) * 100).toFixed(1)) : 0;
      const passRate = executed > 0 ? Number(((passed / executed) * 100).toFixed(1)) : 0;

      const severitySummary = {
        Critical: defects.filter((d) => d.severity === 'Critical').length,
        Major: defects.filter((d) => d.severity === 'Major').length,
        Minor: defects.filter((d) => d.severity === 'Minor').length,
        Trivial: defects.filter((d) => d.severity === 'Trivial').length,
      };

      const moduleSet = Array.from(new Set(effectiveCases.map((c) => c.module)));
      const moduleBreakdown = moduleSet.map((mod) => {
        const mCases = effectiveCases.filter((c) => c.module === mod);
        const mDefects = defects.filter((d) => d.module === mod);
        return {
          module: mod,
          total: mCases.length,
          passed: mCases.filter((c) => c.status === 'Passed').length,
          failed: mCases.filter((c) => c.status === 'Failed').length,
          blocked: mCases.filter((c) => c.status === 'Blocked').length,
          notExecuted: mCases.filter((c) => c.status === 'Not Executed').length,
          defects: mDefects.length,
        };
      });

      return res.json({
        snapshot: {
          totalTestCases,
          passed,
          failed,
          blocked,
          notExecuted,
          executionRate,
          passRate,
          totalDefects: defects.length,
          openDefects: defects.filter((d) => d.status !== 'Closed').length,
          severitySummary,
          moduleBreakdown,
          executionsRecorded: executions.length,
        },
        testCases: effectiveCases,
        defects,
      });
    } catch {
      return res.status(500).json({ error: 'Failed to generate QA report preview.' });
    }
  });

  router.get('/reports', async (_req, res) => {
    const reports = await QAReport.find().sort({ createdAt: -1 }).limit(20).lean();
    return res.json({ reports });
  });

  router.post('/reports', async (req: AuthedRequest, res) => {
    try {
      const { title, dateFrom, dateTo, moduleFilter, summarySnapshot, observations, qualityAssessment } =
        req.body || {};
      if (!title || !summarySnapshot) {
        return res.status(400).json({ error: 'Report title and summary snapshot are required.' });
      }
      const count = await QAReport.countDocuments();
      const reportId = `RPT-${String(count + 1).padStart(3, '0')}`;
      const report = await QAReport.create({
        reportId,
        title: String(title).trim(),
        generatedBy: req.user!.userId,
        generatedByName: req.user!.name,
        dateFrom: String(dateFrom || ''),
        dateTo: String(dateTo || ''),
        moduleFilter: String(moduleFilter || 'All'),
        summarySnapshot,
        observations: String(observations || '').trim(),
        qualityAssessment: String(qualityAssessment || '').trim(),
      });

      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'QA_REPORT_SAVED',
        module: 'STQA Reports',
        entityType: 'QAReport',
        entityId: report.reportId,
        details: `Saved QA report "${report.title}"`,
      });

      return res.status(201).json({ report });
    } catch {
      return res.status(500).json({ error: 'Failed to save QA report.' });
    }
  });

  // --- AUDIT LOGS ---
  router.get('/audit-logs', async (req, res) => {
    const { module } = req.query;
    const filter: Record<string, any> = {};
    if (module && module !== 'All') filter.module = String(module);
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ logs });
  });

  // --- RESET DEMO DATA (Preserves real user-registered accounts!) ---
  router.post('/reset-demo', async (req: AuthedRequest, res) => {
    try {
      await seedDatabase(true);
      await recordAuditLog({
        actorId: req.user!.userId,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'DEMO_RESET_TRIGGERED',
        module: 'System',
        entityType: 'Database',
        details: 'Reset seeded GroceryGo & STQA demo data while preserving real user accounts.',
      });
      io.emit('stqa:updated', { type: 'demo_reset' });
      return res.json({
        message: 'Demo testing data reset cleanly. Real user-registered accounts were preserved.',
      });
    } catch {
      return res.status(500).json({ error: 'Failed to reset demo data.' });
    }
  });

  return router;
}
