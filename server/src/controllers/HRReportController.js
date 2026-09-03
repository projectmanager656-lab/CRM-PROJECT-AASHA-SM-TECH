import User from '../models/User.js';
import Department from '../models/Department.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Payroll from '../models/Payroll.js';
import PerformanceReview from '../models/PerformanceReview.js';
import JobRequisition from '../models/JobRequisition.js';
import Candidate from '../models/Candidate.js';
import Asset from '../models/Asset.js';
import Document from '../models/Document.js';
import Resignation from '../models/Resignation.js';
import { successResponse } from '../utils/apiResponse.js';
import { createNotFoundError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const HRReportController = {
  // 1. Consolidated Executive Overview Analytics
  overview: asyncHandler(async (req, res) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      allUsers,
      departments,
      attendances,
      leaveRequests,
      payrolls,
      performanceReviews,
      jobs,
      candidates,
      assets,
    ] = await Promise.all([
      User.find({ role: 'employee' }).lean(),
      Department.find().lean(),
      Attendance.find().populate('user', 'firstName lastName email department').lean(),
      LeaveRequest.find().populate('user', 'firstName lastName email department').lean(),
      Payroll.find().populate('user', 'firstName lastName email department').lean(),
      PerformanceReview.find().populate('user', 'firstName lastName email department').lean(),
      JobRequisition.find().lean(),
      Candidate.find().lean(),
      Asset.find().populate('assignedTo', 'firstName lastName email department').lean(),
    ]);

    // Employee Metrics
    const totalEmployees = allUsers.length;
    let activeEmployees = 0;
    let inactiveEmployees = 0;
    let newJoinersCount = 0;

    const departmentHeadcounts = {};
    const designationCounts = {};

    allUsers.forEach((u) => {
      if (u.isActive !== false && u.employmentStatus !== 'Exited' && u.employmentStatus !== 'Terminated') {
        activeEmployees += 1;
      } else {
        inactiveEmployees += 1;
      }

      if (u.createdAt && new Date(u.createdAt) >= thirtyDaysAgo) {
        newJoinersCount += 1;
      }

      const dept = u.jobDetails?.department || u.department || 'Unassigned';
      departmentHeadcounts[dept] = (departmentHeadcounts[dept] || 0) + 1;

      const desig = u.jobDetails?.designation || u.designation || 'Staff';
      designationCounts[desig] = (designationCounts[desig] || 0) + 1;
    });

    // Attendance Metrics
    const todayAttendances = attendances.filter((a) => a.date === todayStr);
    let presentToday = 0;
    let lateToday = 0;
    let halfDayToday = 0;
    let totalWorkingMins = 0;

    todayAttendances.forEach((a) => {
      if (a.status === 'Present') presentToday += 1;
      else if (a.status === 'Late') lateToday += 1;
      else if (a.status === 'Half Day') halfDayToday += 1;
      totalWorkingMins += Number(a.totalWorkingMinutes || 0);
    });

    const attendanceRatePercent = activeEmployees > 0 ? Math.round(((presentToday + lateToday + halfDayToday) / activeEmployees) * 100) : 0;

    // Leave Metrics
    let pendingLeaveCount = 0;
    let approvedLeaveCount = 0;
    let onLeaveTodayCount = 0;
    const leaveTypeCounts = {};

    leaveRequests.forEach((l) => {
      if (l.status === 'Pending') pendingLeaveCount += 1;
      else if (l.status === 'Approved') {
        approvedLeaveCount += 1;
        const start = l.startDate ? new Date(l.startDate).toISOString().slice(0, 10) : '';
        const end = l.endDate ? new Date(l.endDate).toISOString().slice(0, 10) : '';
        if (start && end && todayStr >= start && todayStr <= end) {
          onLeaveTodayCount += 1;
        }
      }

      const t = l.type || 'Other';
      leaveTypeCounts[t] = (leaveTypeCounts[t] || 0) + 1;
    });

    // Payroll Metrics
    let totalPayrollGross = 0;
    let totalPayrollNet = 0;
    let totalPayrollDeductions = 0;
    let payrollProcessedCount = 0;
    let payrollPendingCount = 0;
    let payrollPaidCount = 0;

    payrolls.forEach((p) => {
      totalPayrollGross += Number(p.gross || 0);
      totalPayrollNet += Number(p.net || 0);
      totalPayrollDeductions += Number(p.totalDeduction || p.deductions || 0);

      if (p.status === 'Paid') payrollPaidCount += 1;
      else if (p.status === 'Processed') payrollProcessedCount += 1;
      else payrollPendingCount += 1;
    });

    // Performance Metrics
    let totalScoreSum = 0;
    let completedReviewsCount = 0;
    const ratingDistribution = { excellent: 0, good: 0, average: 0, needsImprovement: 0 };

    performanceReviews.forEach((r) => {
      if (r.overallScore) {
        const score = Number(r.overallScore);
        totalScoreSum += score;
        completedReviewsCount += 1;

        if (score >= 4.5) ratingDistribution.excellent += 1;
        else if (score >= 3.5) ratingDistribution.good += 1;
        else if (score >= 2.5) ratingDistribution.average += 1;
        else ratingDistribution.needsImprovement += 1;
      }
    });

    const averagePerformanceScore = completedReviewsCount > 0 ? Number((totalScoreSum / completedReviewsCount).toFixed(2)) : 0;

    // Recruitment Metrics
    const openPositionsCount = jobs.filter((j) => j.status === 'Open').length;
    const totalCandidatesCount = candidates.length;
    let hiredCandidatesCount = 0;
    const stageCounts = { applied: 0, screening: 0, interview: 0, selected: 0, hired: 0, rejected: 0 };

    candidates.forEach((c) => {
      const st = (c.stage || 'Applied').toLowerCase();
      if (stageCounts[st] !== undefined) stageCounts[st] += 1;
      else stageCounts.applied += 1;

      if (c.status === 'Hired' || c.stage === 'Hired') hiredCandidatesCount += 1;
    });

    const conversionRatePercent = totalCandidatesCount > 0 ? Math.round((hiredCandidatesCount / totalCandidatesCount) * 100) : 0;

    // Asset Metrics
    const totalAssetsCount = assets.length;
    let availableAssetsCount = 0;
    let allocatedAssetsCount = 0;
    let underRepairAssetsCount = 0;
    let lostDamagedAssetsCount = 0;
    let totalAssetValuation = 0;

    assets.forEach((a) => {
      totalAssetValuation += Number(a.purchaseCost || 0);
      if (a.status === 'Available' || a.status === 'Returned') availableAssetsCount += 1;
      else if (a.status === 'Allocated') allocatedAssetsCount += 1;
      else if (a.status === 'Under Repair') underRepairAssetsCount += 1;
      else if (a.status === 'Lost' || a.status === 'Damaged') lostDamagedAssetsCount += 1;
    });

    res.json(
      successResponse(
        {
          totalEmployees,
          activeEmployees,
          inactiveEmployees,
          newJoinersCount,
          departmentHeadcounts,
          designationCounts,
          todayAttendance: {
            present: presentToday,
            late: lateToday,
            halfDay: halfDayToday,
            attendanceRatePercent,
            totalLogs: todayAttendances.length,
          },
          leaveMetrics: {
            pending: pendingLeaveCount,
            approved: approvedLeaveCount,
            onLeaveToday: onLeaveTodayCount,
            typeCounts: leaveTypeCounts,
          },
          payrollMetrics: {
            totalGross: totalPayrollGross,
            totalNet: totalPayrollNet,
            totalDeductions: totalPayrollDeductions,
            paid: payrollPaidCount,
            processed: payrollProcessedCount,
            pending: payrollPendingCount,
          },
          performanceMetrics: {
            averageScore: averagePerformanceScore,
            totalReviews: completedReviewsCount,
            ratingDistribution,
          },
          recruitmentMetrics: {
            openPositions: openPositionsCount,
            totalCandidates: totalCandidatesCount,
            hired: hiredCandidatesCount,
            conversionRatePercent,
            stageCounts,
          },
          assetMetrics: {
            total: totalAssetsCount,
            available: availableAssetsCount,
            allocated: allocatedAssetsCount,
            underRepair: underRepairAssetsCount,
            lostDamaged: lostDamagedAssetsCount,
            totalValuation: totalAssetValuation,
          },
        },
        'Executive HR Analytics Overview retrieved successfully'
      )
    );
  }),

  // 2. Consolidated Department Analytics Workspace
  departmentAnalytics: asyncHandler(async (req, res) => {
    const { department } = req.query;

    if (!department || department === 'All') {
      // Return aggregated department list
      const departments = await Department.find().populate('manager', 'firstName lastName email').lean();
      const allUsers = await User.find({ role: 'employee' }).lean();
      const assets = await Asset.find().lean();
      const payrolls = await Payroll.find().lean();

      const list = departments.map((d) => {
        const staff = allUsers.filter(
          (u) => (u.jobDetails?.department || u.department || '').toLowerCase() === d.name.toLowerCase()
        );
        const deptAssets = assets.filter(
          (a) => (a.department || '').toLowerCase() === d.name.toLowerCase()
        );
        const deptPayrolls = payrolls.filter(
          (p) => staff.some((s) => String(s._id) === String(p.user))
        );

        const totalSalary = deptPayrolls.reduce((sum, p) => sum + (Number(p.gross) || 0), 0);
        const totalAssetVal = deptAssets.reduce((sum, a) => sum + (Number(a.purchaseCost) || 0), 0);

        return {
          _id: d._id,
          name: d.name,
          manager: d.manager ? `${d.manager.firstName || ''} ${d.manager.lastName || ''}`.trim() || d.manager.email : 'Unassigned',
          headcount: staff.length,
          activeCount: staff.filter((s) => s.isActive !== false).length,
          totalSalaryExpenditure: totalSalary,
          assignedAssetsCount: deptAssets.length,
          totalAssetValue: totalAssetVal,
        };
      });

      return res.json(successResponse(list, 'Department summary list retrieved'));
    }

    // Specific Department Deep-Dive
    const deptName = String(department).trim();

    const [deptDoc, staff, attendances, leaveRequests, payrolls, reviews, assets, jobs] = await Promise.all([
      Department.findOne({ name: { $regex: new RegExp(`^${deptName}$`, 'i') } }).populate('manager', 'firstName lastName email designation').lean(),
      User.find({
        role: 'employee',
        $or: [
          { department: { $regex: new RegExp(`^${deptName}$`, 'i') } },
          { 'jobDetails.department': { $regex: new RegExp(`^${deptName}$`, 'i') } },
        ],
      }).lean(),
      Attendance.find().populate('user', 'firstName lastName email department').lean(),
      LeaveRequest.find().populate('user', 'firstName lastName email department').lean(),
      Payroll.find().populate('user', 'firstName lastName email department').lean(),
      PerformanceReview.find().populate('user', 'firstName lastName email department').lean(),
      Asset.find({ department: { $regex: new RegExp(`^${deptName}$`, 'i') } }).populate('assignedTo', 'firstName lastName email').lean(),
      JobRequisition.find({ department: { $regex: new RegExp(`^${deptName}$`, 'i') } }).lean(),
    ]);

    const staffIds = new Set(staff.map((s) => String(s._id)));

    // Department Attendance
    const deptAttendances = attendances.filter((a) => staffIds.has(String(a.user?._id || a.user)));
    const presentCount = deptAttendances.filter((a) => a.status === 'Present').length;
    const lateCount = deptAttendances.filter((a) => a.status === 'Late').length;

    // Department Leaves
    const deptLeaves = leaveRequests.filter((l) => staffIds.has(String(l.user?._id || l.user)));
    const pendingLeaves = deptLeaves.filter((l) => l.status === 'Pending').length;
    const approvedLeaves = deptLeaves.filter((l) => l.status === 'Approved').length;

    // Department Payroll
    const deptPayrolls = payrolls.filter((p) => staffIds.has(String(p.user?._id || p.user)));
    const totalGross = deptPayrolls.reduce((sum, p) => sum + (Number(p.gross) || 0), 0);
    const totalNet = deptPayrolls.reduce((sum, p) => sum + (Number(p.net) || 0), 0);

    // Department Performance
    const deptReviews = reviews.filter((r) => staffIds.has(String(r.user?._id || r.user)));
    const avgScore = deptReviews.length > 0 ? deptReviews.reduce((sum, r) => sum + (Number(r.overallScore) || 0), 0) / deptReviews.length : 0;

    // Department Assets
    const totalAssetVal = assets.reduce((sum, a) => sum + (Number(a.purchaseCost) || 0), 0);

    // Enriched Employee List for this department
    const employeeRoster = staff.map((emp) => {
      const empId = String(emp._id);
      const empAtt = deptAttendances.filter((a) => String(a.user?._id || a.user) === empId);
      const empLeaves = deptLeaves.filter((l) => String(l.user?._id || l.user) === empId);
      const empPay = deptPayrolls.filter((p) => String(p.user?._id || p.user) === empId).pop();
      const empReview = deptReviews.filter((r) => String(r.user?._id || r.user) === empId).pop();
      const empAssets = assets.filter((a) => String(a.assignedTo?._id || a.assignedTo) === empId);

      return {
        _id: emp._id,
        name: emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email,
        email: emp.email,
        employeeCode: emp.jobDetails?.employeeId || `EMP-${String(emp._id).slice(-5).toUpperCase()}`,
        designation: emp.jobDetails?.designation || emp.designation || 'Staff',
        joiningDate: emp.jobDetails?.joiningDate || emp.createdAt,
        isActive: emp.isActive !== false,
        attendanceCount: empAtt.length,
        leavesCount: empLeaves.length,
        lastGrossSalary: empPay?.gross || 0,
        lastNetSalary: empPay?.net || 0,
        performanceScore: empReview?.overallScore || null,
        assignedAssetsCount: empAssets.length,
      };
    });

    res.json(
      successResponse(
        {
          departmentName: deptName,
          manager: deptDoc?.manager
            ? `${deptDoc.manager.firstName || ''} ${deptDoc.manager.lastName || ''}`.trim() || deptDoc.manager.email
            : 'Unassigned',
          description: deptDoc?.description || '',
          headcount: staff.length,
          activeCount: staff.filter((s) => s.isActive !== false).length,
          totalGrossSalary: totalGross,
          totalNetSalary: totalNet,
          averagePerformanceScore: Number(avgScore.toFixed(2)),
          totalAssetsCount: assets.length,
          totalAssetValuation: totalAssetVal,
          openPositionsCount: jobs.filter((j) => j.status === 'Open').length,
          attendanceSummary: {
            totalRecords: deptAttendances.length,
            present: presentCount,
            late: lateCount,
          },
          leaveSummary: {
            totalRequests: deptLeaves.length,
            pending: pendingLeaves,
            approved: approvedLeaves,
          },
          employeeRoster,
        },
        `Department analytics for ${deptName} retrieved`
      )
    );
  }),

  // 3. Consolidated Employee 360° Dossier
  employee360: asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const [user, attendances, leaves, payrolls, reviews, documents, assets, resignations] = await Promise.all([
      User.findById(userId).lean(),
      Attendance.find({ user: userId }).sort({ date: -1 }).lean(),
      LeaveRequest.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      Payroll.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      PerformanceReview.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      Document.find({ user: userId }).sort({ createdAt: -1 }).lean(),
      Asset.find({ assignedTo: userId }).lean(),
      Resignation.find({ user: userId }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!user) {
      throw createNotFoundError('Employee record not found');
    }

    // Attendance stats
    const totalAttendanceDays = attendances.length;
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let totalWorkingHours = 0;

    attendances.forEach((a) => {
      if (a.status === 'Present') presentDays += 1;
      else if (a.status === 'Late') lateDays += 1;
      else if (a.status === 'Half Day') halfDays += 1;
      totalWorkingHours += Number(a.totalWorkingMinutes || 0) / 60;
    });

    const attendanceRatePercent = totalAttendanceDays > 0 ? Math.round(((presentDays + lateDays + halfDays) / totalAttendanceDays) * 100) : 0;

    // Leave stats
    let approvedLeaves = 0;
    let pendingLeaves = 0;
    let rejectedLeaves = 0;

    leaves.forEach((l) => {
      if (l.status === 'Approved') approvedLeaves += 1;
      else if (l.status === 'Pending') pendingLeaves += 1;
      else if (l.status === 'Rejected') rejectedLeaves += 1;
    });

    // Performance review summaries
    const latestReview = reviews[0] || null;
    const averageScore = reviews.length > 0 ? Number((reviews.reduce((s, r) => s + (Number(r.overallScore) || 0), 0) / reviews.length).toFixed(2)) : null;

    // Documents stats
    let verifiedDocs = 0;
    let pendingDocs = 0;
    let expiredDocs = 0;

    documents.forEach((d) => {
      if (d.status === 'Verified') verifiedDocs += 1;
      else if (d.status === 'Pending Verification' || d.status === 'Pending') pendingDocs += 1;
      if (d.status === 'Expired' || (d.expiryDate && new Date(d.expiryDate) < new Date())) expiredDocs += 1;
    });

    // Asset valuation for this employee
    const totalAssetValuation = assets.reduce((sum, a) => sum + (Number(a.purchaseCost) || 0), 0);

    res.json(
      successResponse(
        {
          profile: {
            _id: user._id,
            fullName: user.personalInfo?.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.personalInfo?.phone || user.phone || '—',
            employeeId: user.jobDetails?.employeeId || `EMP-${String(user._id).slice(-5).toUpperCase()}`,
            department: user.jobDetails?.department || user.department || 'General',
            designation: user.jobDetails?.designation || user.designation || 'Staff',
            joiningDate: user.jobDetails?.joiningDate || user.createdAt,
            isActive: user.isActive !== false,
            employmentStatus: user.employmentStatus || (user.isActive ? 'Active' : 'Inactive'),
            employmentType: user.jobDetails?.employmentType || 'Full-time',
            reportingManager: user.jobDetails?.reportingManager || '—',
            workLocation: user.jobDetails?.workLocation || 'Main Office',
          },
          attendanceSummary: {
            totalDaysRecorded: totalAttendanceDays,
            presentDays,
            lateDays,
            halfDays,
            totalWorkingHours: Number(totalWorkingHours.toFixed(1)),
            attendanceRatePercent,
            recentLogs: attendances.slice(0, 7),
          },
          leaveSummary: {
            totalApplications: leaves.length,
            approved: approvedLeaves,
            pending: pendingLeaves,
            rejected: rejectedLeaves,
            recentRequests: leaves.slice(0, 5),
          },
          payrollSummary: {
            totalPayrolls: payrolls.length,
            latestRecord: payrolls[0] || null,
            baseSalary: user.jobDetails?.salary || payrolls[0]?.baseSalary || 0,
            recentPayrolls: payrolls.slice(0, 6),
          },
          performanceSummary: {
            totalReviews: reviews.length,
            averageScore,
            latestReview,
            reviewsList: reviews,
          },
          documentSummary: {
            totalDocuments: documents.length,
            verified: verifiedDocs,
            pending: pendingDocs,
            expired: expiredDocs,
            documentsList: documents,
          },
          assetSummary: {
            assignedCount: assets.length,
            totalValuation: totalAssetValuation,
            assignedAssets: assets,
          },
          resignationStatus: resignations[0] || null,
        },
        'Employee 360 Dossier retrieved successfully'
      )
    );
  }),
};
