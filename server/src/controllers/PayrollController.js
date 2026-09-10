import Payroll from '../models/Payroll.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Notification from '../models/Notification.js';
import CompanySetting from '../models/CompanySetting.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const round2 = (val) => Math.round((Number(val) || 0) * 100) / 100;

const calculatePayrollFigures = (data) => {
  const basicSalary = round2(data.basicSalary);
  const allowances = round2(data.allowances);
  const bonus = round2(data.bonus);
  const incentive = round2(data.incentive);
  const overtime = round2(data.overtime);

  const deductions = round2(data.deductions);
  const salaryAdvance = round2(data.salaryAdvance);
  const lopDeductions = round2(data.lopDeductions);
  const lopDays = Math.max(0, Number(data.lopDays) || 0);

  const gross = round2(basicSalary + allowances + bonus + incentive + overtime);
  const totalDeduction = round2(deductions + salaryAdvance + lopDeductions);
  const net = round2(Math.max(0, gross - totalDeduction));

  const month = data.month || data.payPeriod;
  const payPeriod = data.payPeriod || data.month;

  return {
    ...data,
    basicSalary,
    allowances,
    bonus,
    incentive,
    overtime,
    deductions,
    salaryAdvance,
    lopDays,
    lopDeductions,
    gross,
    totalDeduction,
    net,
    month,
    payPeriod,
    currency: data.currency || 'INR',
  };
};

export const PayrollController = {
  // 1. List Payroll Records with Filtering & Search
  list: asyncHandler(async (req, res) => {
    const isHR = isHrOrAdmin(req.user);
    const filter = {};

    if (!isHR) {
      filter.user = req.user.userId;
    } else {
      if (req.query.user) filter.user = req.query.user;
    }

    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }

    if (req.query.payPeriod && req.query.payPeriod !== 'All') {
      filter.payPeriod = req.query.payPeriod;
    } else if (req.query.month && req.query.month !== 'All') {
      filter.month = req.query.month;
    }

    let records = await Payroll.find(filter)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo bankDetails salaryDetails')
      .populate('processedBy', 'firstName lastName email')
      .populate('paidBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // In-memory department / search filter if requested
    if (req.query.department && req.query.department !== 'All') {
      records = records.filter((r) => {
        const dept = r.user?.department || r.user?.jobDetails?.department || '';
        return dept === req.query.department;
      });
    }

    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      records = records.filter((r) => {
        const name = `${r.user?.firstName || ''} ${r.user?.lastName || ''} ${r.user?.personalInfo?.fullName || ''}`.toLowerCase();
        const email = (r.user?.email || '').toLowerCase();
        const empId = (r.user?.jobDetails?.employeeId || '').toLowerCase();
        return name.includes(q) || email.includes(q) || empId.includes(q);
      });
    }

    res.json(successResponse(records, 'Payroll records retrieved'));
  }),

  // 2. Get Single Payroll Record by ID
  get: asyncHandler(async (req, res) => {
    const record = await Payroll.findById(req.params.id)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo bankDetails salaryDetails')
      .populate('processedBy', 'firstName lastName email')
      .populate('paidBy', 'firstName lastName email');

    if (!record) throw createNotFoundError('Payroll record not found');

    if (!isHrOrAdmin(req.user) && String(record.user?._id || record.user) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }

    res.json(successResponse(record, 'Payroll record retrieved'));
  }),

  // 3. Create a Single Payroll Record
  create: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Administrators can create payroll');

    const { user: userId, payPeriod, effectiveDate, basicSalary } = req.body;
    if (!userId || !payPeriod || !effectiveDate) {
      throw createValidationError('Employee, pay period, and effective date are required');
    }

    const existing = await Payroll.findOne({ user: userId, payPeriod });
    if (existing) {
      throw createValidationError(`Payroll record already exists for this employee for pay period ${payPeriod}`);
    }

    const calculated = calculatePayrollFigures(req.body);
    const created = await Payroll.create({
      ...calculated,
      status: req.body.status || 'Pending',
    });

    const populated = await Payroll.findById(created._id)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo bankDetails salaryDetails')
      .populate('processedBy', 'firstName lastName email')
      .populate('paidBy', 'firstName lastName email');

    res.status(201).json(createdResponse(populated, 'Payroll record created successfully'));
  }),

  // 4. Update an Existing Payroll Record
  update: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const existing = await Payroll.findById(req.params.id);
    if (!existing) throw createNotFoundError('Payroll record not found');

    const calculated = calculatePayrollFigures({
      ...existing.toObject(),
      ...req.body,
      // Retain existing user and payPeriod unless explicitly authorized
      user: existing.user,
      payPeriod: req.body.payPeriod || existing.payPeriod,
    });

    const updated = await Payroll.findByIdAndUpdate(req.params.id, calculated, {
      new: true,
      runValidators: true,
    })
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo bankDetails salaryDetails')
      .populate('processedBy', 'firstName lastName email')
      .populate('paidBy', 'firstName lastName email');

    res.json(successResponse(updated, 'Payroll updated successfully'));
  }),

  // 5. Generate Payroll in Bulk for a Given Month / Pay Period
  generate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Administrators can generate payroll');

    const { month, payPeriod = month, year, effectiveDate, department, user: singleUserId, employeeId } = req.body;
    if (!payPeriod) throw createValidationError('Please provide a pay period / month (e.g. "2026-09")');

    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();

    // Fetch active employees
    const activeEmployees = await User.find({
      role: 'employee',
      isActive: true,
      employmentStatus: { $nin: ['Exited', 'Terminated'] },
    })
      .populate('department', 'name')
      .select('firstName lastName email department designation jobDetails personalInfo bankDetails salaryDetails');

    if (!activeEmployees || activeEmployees.length === 0) {
      throw createValidationError('No active employees found to generate payroll');
    }

    // Optional department / employee filter
    let targetEmployees = activeEmployees;
    if (singleUserId || (employeeId && employeeId !== 'All')) {
      const targetId = String(singleUserId || employeeId);
      targetEmployees = targetEmployees.filter((emp) => String(emp._id) === targetId);
    } else if (department && department !== 'All') {
      const deptNormalized = String(department).trim().toLowerCase();
      targetEmployees = targetEmployees.filter((emp) => {
        let empDept = '';
        if (emp.department) {
          if (typeof emp.department === 'object' && emp.department.name) empDept = emp.department.name;
          else empDept = String(emp.department);
        } else if (emp.jobDetails?.department) {
          if (typeof emp.jobDetails.department === 'object' && emp.jobDetails.department.name) empDept = emp.jobDetails.department.name;
          else empDept = String(emp.jobDetails.department);
        }
        return empDept.trim().toLowerCase() === deptNormalized;
      });
    }

    if (!targetEmployees || targetEmployees.length === 0) {
      throw createValidationError('No eligible active employees found for the selected department/employee scope');
    }

    // Check which employees already have a payroll record for this pay period
    const existingRecords = await Payroll.find({ payPeriod }).select('user');
    const existingUserIds = new Set(existingRecords.map((r) => String(r.user)));

    const createdRecords = [];
    const skipped = [];

    // Optional: Determine date range for LOP deduction checks
    const [pYear, pMonth] = payPeriod.split('-').map(Number);
    const startOfMonth = pYear && pMonth ? new Date(pYear, pMonth - 1, 1) : null;
    const endOfMonth = pYear && pMonth ? new Date(pYear, pMonth, 0, 23, 59, 59) : null;

    for (const emp of targetEmployees) {
      if (existingUserIds.has(String(emp._id))) {
        skipped.push({
          userId: emp._id,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email,
          reason: 'Payroll already exists for this period',
        });
        continue;
      }

      // Check employee salary details or establish standard baseline
      const empSalary = emp.salaryDetails || {};
      const basicSalary = Number(empSalary.basicSalary) > 0 ? Number(empSalary.basicSalary) : 35000;
      const allowances = Number(empSalary.allowances) >= 0 ? Number(empSalary.allowances) : 5000;
      const bonus = Number(empSalary.bonus) || 0;
      const standardDeductions = Number(empSalary.deductions) || 0;

      // Calculate LOP: Approved Unpaid Leave + Attendance Absent records (deduplicated by date)
      let lopDays = 0;
      let lopDeductions = 0;
      if (startOfMonth && endOfMonth) {
        try {
          const monthPrefix = `${pYear}-${String(pMonth).padStart(2, '0')}`;

          // 1. Expand approved Unpaid Leave dates into a Set
          const unpaidLeaveDates = new Set();
          const approvedUnpaidLeaves = await LeaveRequest.find({
            user: emp._id,
            status: 'Approved',
            type: 'Unpaid',
            startDate: { $lte: endOfMonth },
            endDate: { $gte: startOfMonth },
          });
          approvedUnpaidLeaves.forEach((lv) => {
            const lvS = new Date(Math.max(new Date(lv.startDate), startOfMonth));
            const lvE = new Date(Math.min(new Date(lv.endDate), endOfMonth));
            const cur = new Date(lvS); cur.setHours(0, 0, 0, 0);
            const eN = new Date(lvE); eN.setHours(0, 0, 0, 0);
            while (cur <= eN) { unpaidLeaveDates.add(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
          });

          // 2. Collect explicit Attendance Absent dates for this month
          const attendanceAbsentDates = new Set();
          const absentRecs = await Attendance.find({
            user: emp._id,
            date: { $regex: `^${monthPrefix}` },
            status: 'Absent',
          }).select('date').lean();
          absentRecs.forEach((r) => attendanceAbsentDates.add(r.date));

          // 3. Union — each absent/unpaid date counted exactly once
          const lopDateSet = new Set([...unpaidLeaveDates, ...attendanceAbsentDates]);
          lopDays = lopDateSet.size;

          if (lopDays > 0) {
            const dailyRate = basicSalary / 30;
            lopDeductions = round2(dailyRate * lopDays);
          }
        } catch (err) {
          // If LOP lookup fails, proceed without LOP deduction
        }
      }

      const calculated = calculatePayrollFigures({
        user: emp._id,
        month: payPeriod,
        payPeriod,
        effectiveDate: effDate,
        basicSalary,
        allowances,
        bonus,
        incentive: 0,
        overtime: 0,
        salaryAdvance: 0,
        lopDays,
        lopDeductions,
        deductions: standardDeductions,
        currency: empSalary.currency || 'INR',
        status: 'Pending',
        notes: `Generated payroll for ${payPeriod}`,
      });

      try {
        const newRecord = await Payroll.create(calculated);
        createdRecords.push(newRecord);
      } catch (err) {
        skipped.push({
          userId: emp._id,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email,
          reason: err.message,
        });
      }
    }

    res.status(201).json(
      createdResponse(
        {
          generatedCount: createdRecords.length,
          skippedCount: skipped.length,
          skipped,
          payPeriod,
        },
        `Generated ${createdRecords.length} payroll records for ${payPeriod}`
      )
    );
  }),

  // 6. Process Payroll (Pending -> Processed)
  process: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Administrators can process payroll');

    const record = await Payroll.findById(req.params.id);
    if (!record) throw createNotFoundError('Payroll record not found');

    if (record.status === 'Paid') {
      throw createValidationError('Cannot process a payroll that has already been Paid');
    }

    record.status = 'Processed';
    record.processedBy = req.user.userId;
    record.processedAt = new Date();
    if (req.body.notes) record.notes = req.body.notes.trim();

    await record.save();

    // Send notification to employee
    try {
      await Notification.create({
        recipient: record.user,
        title: 'Payroll Processed',
        message: `Your payroll for ${record.payPeriod} has been processed. Net amount: ₹${record.net.toLocaleString()}`,
        type: 'Success',
      });
    } catch (e) {}

    const populated = await Payroll.findById(record._id)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo bankDetails salaryDetails')
      .populate('processedBy', 'firstName lastName email')
      .populate('paidBy', 'firstName lastName email');

    res.json(successResponse(populated, `Payroll for ${record.payPeriod} processed successfully`));
  }),

  // 7. Mark as Paid (Processed -> Paid)
  pay: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Administrators can record payroll payments');

    const record = await Payroll.findById(req.params.id);
    if (!record) throw createNotFoundError('Payroll record not found');

    record.status = 'Paid';
    record.paidBy = req.user.userId;
    record.paidAt = new Date();
    record.paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    record.paymentMethod = req.body.paymentMethod || 'Bank Transfer';
    record.paymentReference = (req.body.paymentReference || '').trim();
    if (req.body.notes) record.notes = req.body.notes.trim();

    await record.save();

    // Send notification to employee
    try {
      await Notification.create({
        recipient: record.user,
        title: 'Salary Paid',
        message: `Your salary for ${record.payPeriod} of ₹${record.net.toLocaleString()} has been paid via ${record.paymentMethod}.${record.paymentReference ? ` Ref: ${record.paymentReference}` : ''}`,
        type: 'Success',
      });
    } catch (e) {}

    const populated = await Payroll.findById(record._id)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo bankDetails salaryDetails')
      .populate('processedBy', 'firstName lastName email')
      .populate('paidBy', 'firstName lastName email');

    res.json(successResponse(populated, `Payroll for ${record.payPeriod} marked as Paid`));
  }),

  // 8. Update Employee Salary Structure in User Model
  updateEmployeeSalary: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and Administrators can manage employee salary structure');

    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) throw createNotFoundError('Employee not found');

    const { basicSalary, allowances, bonus, deductions, currency, effectiveDate } = req.body;

    user.salaryDetails = {
      basicSalary: round2(basicSalary),
      allowances: round2(allowances),
      bonus: round2(bonus),
      deductions: round2(deductions),
      currency: currency || 'INR',
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
    };

    await user.save();

    res.json(successResponse(user, 'Employee salary structure updated successfully'));
  }),

  // 9. Payroll Summary & Dynamic KPI Calculations
  summary: asyncHandler(async (req, res) => {
    const isHR = isHrOrAdmin(req.user);
    const filter = isHR ? {} : { user: req.user.userId };

    const [allRecords, activeEmployeeCount] = await Promise.all([
      Payroll.find(filter).populate('user', 'department jobDetails'),
      User.countDocuments({ role: 'employee', isActive: true, employmentStatus: { $nin: ['Exited', 'Terminated'] } }),
    ]);

    let pendingCount = 0;
    let processedCount = 0;
    let paidCount = 0;
    let totalNet = 0;
    let totalGross = 0;
    let totalDeductions = 0;

    const deptMap = {
      Tech: { totalEmployees: 0, totalNet: 0, count: 0 },
      Finance: { totalEmployees: 0, totalNet: 0, count: 0 },
      'Business Development': { totalEmployees: 0, totalNet: 0, count: 0 },
      'Digital Marketing': { totalEmployees: 0, totalNet: 0, count: 0 },
      'Video Editor': { totalEmployees: 0, totalNet: 0, count: 0 },
      HR: { totalEmployees: 0, totalNet: 0, count: 0 },
    };

    allRecords.forEach((r) => {
      if (r.status === 'Pending') pendingCount++;
      else if (r.status === 'Processed' || r.status === 'Processing') processedCount++;
      else if (r.status === 'Paid') paidCount++;

      totalNet += r.net || 0;
      totalGross += r.gross || 0;
      totalDeductions += r.totalDeduction || r.deductions || 0;

      const dept = r.user?.department || r.user?.jobDetails?.department;
      if (dept && deptMap[dept]) {
        deptMap[dept].count += 1;
        deptMap[dept].totalNet += r.net || 0;
      }
    });

    res.json(
      successResponse(
        {
          totalEmployees: activeEmployeeCount,
          totalRecords: allRecords.length,
          pendingCount,
          processedCount,
          paidCount,
          totalNet: round2(totalNet),
          totalGross: round2(totalGross),
          totalDeductions: round2(totalDeductions),
          departmentBreakdown: deptMap,
        },
        'Payroll summary retrieved'
      )
    );
  }),

  // 10. Generate Printable/Viewable Payslip
  payslip: asyncHandler(async (req, res) => {
    const record = await Payroll.findById(req.params.id)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo bankDetails')
      .populate('processedBy', 'firstName lastName email')
      .populate('paidBy', 'firstName lastName email');

    if (!record) throw createNotFoundError('Payroll record not found');

    if (!isHrOrAdmin(req.user) && String(record.user?._id || record.user) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }

    const companySetting = await CompanySetting.findOne({ key: 'company' }).catch(() => null);
    const companyName = companySetting?.companyName || 'Aasha SM Tech';

    const empName = `${record.user?.firstName || ''} ${record.user?.lastName || ''}`.trim() || record.user?.personalInfo?.fullName || 'Employee';
    const empId = record.user?.jobDetails?.employeeId || `EMP-${String(record.user?._id || '').slice(-5).toUpperCase()}`;
    const dept = record.user?.department || record.user?.jobDetails?.department || '—';
    const desig = record.user?.designation || record.user?.jobDetails?.designation || 'Staff';
    const bankName = record.user?.bankDetails?.bankName || '—';
    const accNum = record.user?.bankDetails?.accountNumber ? `•••• ${record.user.bankDetails.accountNumber.slice(-4)}` : '—';
    const ifsc = record.user?.bankDetails?.ifscCode || '—';

    // Fetch live attendance counts for this pay period
    let psPresent = 0, psLate = 0, psHalfDay = 0;
    try {
      const mpfx = record.payPeriod ? record.payPeriod.slice(0, 7) : '';
      if (mpfx && record.user?._id) {
        const psa = await Attendance.find({ user: record.user._id, date: { $regex: `^${mpfx}` } }).select('status').lean();
        psPresent = psa.filter((r) => r.status === 'Present').length;
        psLate    = psa.filter((r) => r.status === 'Late').length;
        psHalfDay = psa.filter((r) => r.status === 'Half Day').length;
      }
    } catch (_) { /* non-critical — payslip continues without attendance */ }
    const psLopDays = record.lopDays || 0;
    const psShowAtt = psPresent + psLate + psHalfDay + psLopDays > 0;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Payslip - ${empName} (${record.payPeriod})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #f8fafc; padding: 30px 20px; color: #0f172a; }
    .payslip-container { max-width: 800px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 36px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #ea580c; padding-bottom: 20px; margin-bottom: 24px; }
    .company-title { font-size: 24px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px; }
    .company-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .payslip-badge { background: #fff7ed; border: 1px solid #ffedd5; color: #c2410c; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; text-align: right; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px; font-size: 13px; }
    .meta-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .meta-label { color: #64748b; font-weight: 500; }
    .meta-val { font-weight: 700; color: #0f172a; }
    .salary-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
    td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; }
    .amount-col { text-align: right; font-weight: 600; }
    .total-row td { font-weight: 800; background: #f8fafc; border-top: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; }
    .net-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .net-title { font-size: 14px; font-weight: 700; color: #166534; }
    .net-amount { font-size: 26px; font-weight: 800; color: #15803d; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 18px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
    .print-btn { display: inline-block; background: #ea580c; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; cursor: pointer; text-decoration: none; margin-bottom: 20px; }
    @media print { .print-btn { display: none; } body { background: white; padding: 0; } .payslip-container { border: none; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div style="max-width: 800px; margin: 0 auto; text-align: right;">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="payslip-container">
    <div class="header">
      <div>
        <div class="company-title">
          <img src="/aasha-logo-new.jpg" alt="${companyName}" style="max-height: 42px; display: block; margin-bottom: 4px;" />
        </div>
        <div class="company-sub">Salary Statement & Payment Slip</div>
      </div>
      <div class="payslip-badge">
        <div>Pay Period: ${record.payPeriod}</div>
        <div style="font-size: 11px; font-weight: 500; color: #9a3412; margin-top: 2px;">Status: ${record.status}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <div class="meta-row"><span class="meta-label">Employee Name:</span><span class="meta-val">${empName}</span></div>
        <div class="meta-row"><span class="meta-label">Employee ID:</span><span class="meta-val">${empId}</span></div>
        <div class="meta-row"><span class="meta-label">Department:</span><span class="meta-val">${dept}</span></div>
        <div class="meta-row"><span class="meta-label">Designation:</span><span class="meta-val">${desig}</span></div>
      </div>
      <div>
        <div class="meta-row"><span class="meta-label">Bank Name:</span><span class="meta-val">${bankName}</span></div>
        <div class="meta-row"><span class="meta-label">Bank Account:</span><span class="meta-val">${accNum}</span></div>
        <div class="meta-row"><span class="meta-label">IFSC Code:</span><span class="meta-val">${ifsc}</span></div>
        <div class="meta-row"><span class="meta-label">Payment Date:</span><span class="meta-val">${record.paymentDate ? new Date(record.paymentDate).toLocaleDateString('en-GB') : '—'}</span></div>
      </div>
    </div>

    ${psShowAtt ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 18px;margin-bottom:20px;">
      <div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#475569;letter-spacing:0.05em;margin-bottom:10px;">Attendance Summary</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px;">
        ${psPresent > 0 ? `<span style="display:inline-flex;flex-direction:column;"><span style="color:#64748b;font-size:10px;text-transform:uppercase;">Present</span><strong style="color:#15803d;font-size:16px;">${psPresent}</strong></span>` : ''}
        ${psLate > 0 ? `<span style="display:inline-flex;flex-direction:column;"><span style="color:#64748b;font-size:10px;text-transform:uppercase;">Late</span><strong style="color:#d97706;font-size:16px;">${psLate}</strong></span>` : ''}
        ${psHalfDay > 0 ? `<span style="display:inline-flex;flex-direction:column;"><span style="color:#64748b;font-size:10px;text-transform:uppercase;">Half Day</span><strong style="color:#7c3aed;font-size:16px;">${psHalfDay}</strong></span>` : ''}
        ${psLopDays > 0 ? `<span style="display:inline-flex;flex-direction:column;"><span style="color:#64748b;font-size:10px;text-transform:uppercase;">LOP Days</span><strong style="color:#dc2626;font-size:16px;">${psLopDays}</strong></span>` : ''}
      </div>
    </div>` : ''}

    <div class="salary-tables">
      <div>
        <table>
          <thead>
            <tr><th>Earnings (Components)</th><th class="amount-col">Amount (₹)</th></tr>
          </thead>
          <tbody>
            <tr><td>Basic Salary</td><td class="amount-col">₹${record.basicSalary.toLocaleString()}</td></tr>
            <tr><td>House Rent & Allowances</td><td class="amount-col">₹${record.allowances.toLocaleString()}</td></tr>
            ${record.bonus > 0 ? `<tr><td>Performance Bonus</td><td class="amount-col">₹${record.bonus.toLocaleString()}</td></tr>` : ''}
            ${record.incentive > 0 ? `<tr><td>Special Incentives</td><td class="amount-col">₹${record.incentive.toLocaleString()}</td></tr>` : ''}
            ${record.overtime > 0 ? `<tr><td>Overtime Allowance</td><td class="amount-col">₹${record.overtime.toLocaleString()}</td></tr>` : ''}
            <tr class="total-row"><td>Gross Earnings</td><td class="amount-col" style="color: #0f172a;">₹${record.gross.toLocaleString()}</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <table>
          <thead>
            <tr><th>Deductions</th><th class="amount-col">Amount (₹)</th></tr>
          </thead>
          <tbody>
            <tr><td>Standard Deductions / Tax</td><td class="amount-col">₹${record.deductions.toLocaleString()}</td></tr>
            ${record.salaryAdvance > 0 ? `<tr><td>Salary Advance Recovery</td><td class="amount-col">₹${record.salaryAdvance.toLocaleString()}</td></tr>` : ''}
            ${record.lopDeductions > 0 ? `<tr><td>Loss of Pay (${record.lopDays} days)</td><td class="amount-col" style="color: #dc2626;">₹${record.lopDeductions.toLocaleString()}</td></tr>` : ''}
            <tr class="total-row"><td>Total Deductions</td><td class="amount-col" style="color: #dc2626;">- ₹${record.totalDeduction.toLocaleString()}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="net-box">
      <div>
        <div class="net-title">Total Net Salary Payable</div>
        <div style="font-size: 12px; color: #15803d; margin-top: 2px;">Gross Earnings minus Total Deductions</div>
      </div>
      <div class="net-amount">₹${record.net.toLocaleString()}</div>
    </div>

    ${record.paymentReference ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 20px; background: #f8fafc; padding: 10px 14px; border-radius: 6px;">Payment Ref / Txn ID: <strong>${record.paymentReference}</strong> via <strong>${record.paymentMethod}</strong></div>` : ''}

    <div class="footer">
      <div>System generated confidential payslip • ${companyName}</div>
      <div>Generated on ${new Date().toLocaleDateString('en-GB')}</div>
    </div>
  </div>
</body>
</html>`;

    res.type('html').send(html);
  }),

  // 11. Remove Payroll Record
  remove: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');
    const record = await Payroll.findByIdAndDelete(req.params.id);
    if (!record) throw createNotFoundError('Payroll record not found');
    res.json(successResponse({ id: req.params.id }, 'Payroll record deleted successfully'));
  }),

  // 12. Attendance Summary — real attendance + leave data for a user + pay period
  attendanceSummary: asyncHandler(async (req, res) => {
    const { userId, payPeriod } = req.query;
    if (!userId || !payPeriod) throw createValidationError('userId and payPeriod are required');

    if (!isHrOrAdmin(req.user) && String(req.user.userId) !== String(userId)) {
      throw createForbiddenError('Access denied');
    }

    const [pYear, pMonth] = payPeriod.split('-').map(Number);
    if (!pYear || !pMonth) throw createValidationError('payPeriod must be in YYYY-MM format');

    const startOfMonth = new Date(pYear, pMonth - 1, 1);
    const endOfMonth   = new Date(pYear, pMonth, 0, 23, 59, 59);
    const monthPrefix  = `${pYear}-${String(pMonth).padStart(2, '0')}`;

    // Calendar working days (Mon–Fri only — no holiday data in this system)
    let totalWorkingDays = 0;
    const wdCur = new Date(startOfMonth);
    while (wdCur <= endOfMonth) {
      const dow = wdCur.getDay();
      if (dow !== 0 && dow !== 6) totalWorkingDays++;
      wdCur.setDate(wdCur.getDate() + 1);
    }

    // Attendance records for this month
    const attRecs = await Attendance.find({
      user: userId,
      date: { $regex: `^${monthPrefix}` },
    }).select('date status').lean();

    const presentCount  = attRecs.filter((r) => r.status === 'Present').length;
    const lateCount     = attRecs.filter((r) => r.status === 'Late').length;
    const halfDayCount  = attRecs.filter((r) => r.status === 'Half Day').length;
    const absentDates   = new Set(attRecs.filter((r) => r.status === 'Absent').map((r) => r.date));

    // Leave requests overlapping this month
    const leaveReqs = await LeaveRequest.find({
      user: userId,
      startDate: { $lte: endOfMonth },
      endDate:   { $gte: startOfMonth },
    }).select('type status startDate endDate').lean();

    // Expand a date range to individual YYYY-MM-DD strings clipped to this month
    const expandDates = (start, end) => {
      const out = [];
      const s = new Date(Math.max(new Date(start), startOfMonth));
      const e = new Date(Math.min(new Date(end),   endOfMonth));
      const cur = new Date(s); cur.setHours(0, 0, 0, 0);
      const eN  = new Date(e); eN.setHours(0, 0, 0, 0);
      while (cur <= eN) { out.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
      return out;
    };

    const leaveByType = {};
    const unpaidApprovedDates = new Set();
    leaveReqs.forEach((lv) => {
      const dates = expandDates(lv.startDate, lv.endDate);
      const key   = lv.type;
      if (!leaveByType[key]) leaveByType[key] = { pending: 0, approved: 0, rejected: 0 };
      leaveByType[key][lv.status.toLowerCase()] = (leaveByType[key][lv.status.toLowerCase()] || 0) + dates.length;
      if (lv.status === 'Approved' && lv.type === 'Unpaid') dates.forEach((d) => unpaidApprovedDates.add(d));
    });

    // Deduplicate: union of Absent attendance + Approved Unpaid Leave dates
    const lopDateSet = new Set([...absentDates, ...unpaidApprovedDates]);
    const lopDays    = lopDateSet.size;

    // Salary lookup for estimated LOP amount
    const userDoc    = await User.findById(userId).select('salaryDetails').lean();
    const basicSal   = Number(userDoc?.salaryDetails?.basicSalary) || 0;
    const lopDeductions = round2((basicSal / 30) * lopDays);

    res.json(
      successResponse(
        {
          payPeriod,
          userId,
          totalWorkingDays,
          presentCount,
          lateCount,
          halfDayCount,
          absentCount:          absentDates.size,
          attendanceAbsentDays: absentDates.size,
          unpaidApprovedDays:   unpaidApprovedDates.size,
          lopDays,
          lopDeductions,
          basicSalary: basicSal,
          leaveByType,
        },
        'Attendance summary retrieved'
      )
    );
  }),
};

export default PayrollController;
