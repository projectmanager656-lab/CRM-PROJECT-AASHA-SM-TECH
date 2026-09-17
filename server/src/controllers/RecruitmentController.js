import mongoose from 'mongoose';
import JobRequisition from '../models/JobRequisition.js';
import Candidate from '../models/Candidate.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import CalendarEvent from '../models/CalendarEvent.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const actorName = (user) => {
  if (!user) return 'System / HR';
  if (user.firstName || user.lastName) return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return user.email || 'HR';
};

const generateJobId = () => `JOB-${Math.floor(10000 + Math.random() * 90000)}`;
const generateCandidateId = () => `CAN-${Math.floor(10000 + Math.random() * 90000)}`;

export const RecruitmentController = {
  // 1. Summary KPIs & Pipeline Metrics
  summary: asyncHandler(async (req, res) => {
    const jobFilter = {};
    const candidateFilter = {};
    if (req.query.appliedJob && req.query.appliedJob !== 'All') {
      candidateFilter.appliedJob = req.query.appliedJob;
    }

    const [jobs, allCandidates] = await Promise.all([
      JobRequisition.find(jobFilter).lean(),
      Candidate.find().populate('appliedJob', 'title department jobId').lean(),
    ]);

    const candidates = req.query.appliedJob && req.query.appliedJob !== 'All'
      ? allCandidates.filter((c) => String(c.appliedJob?._id || c.appliedJob) === String(req.query.appliedJob))
      : allCandidates;

    const openPositions = jobs.filter((j) => j.status === 'Open').length;
    const totalApplicants = candidates.length;
    const newApplicants = candidates.filter((c) => c.status === 'New' || c.stage === 'Applied').length;
    const shortlistedCandidates = candidates.filter((c) => c.stage === 'Shortlisted').length;

    let interviewsScheduled = 0;
    candidates.forEach((c) => {
      (c.interviews || []).forEach((inv) => {
        if (inv.status === 'Scheduled') interviewsScheduled += 1;
      });
    });

    const selectedCandidates = candidates.filter((c) => c.stage === 'Selected' || c.status === 'Offered').length;
    const positionsFilled = candidates.filter((c) => c.status === 'Hired' || c.stage === 'Hired').length;

    // Pipeline stage breakdown
    const STAGES = [
      'Applied',
      'Screening',
      'Shortlisted',
      'Assessment',
      'Interview',
      'Technical Round',
      'Final / HR Round',
      'HR Round',
      'Selected',
      'Offer',
      'Hired',
      'Rejected',
      'Withdrawn',
      'On Hold',
    ];
    const stageCounts = {};
    STAGES.forEach((s) => { stageCounts[s] = 0; });
    candidates.forEach((c) => {
      const st = c.stage || 'Applied';
      if (stageCounts[st] !== undefined) stageCounts[st] += 1;
    });

    // Department breakdown
    const deptStats = {};
    const OFFICIAL_DEPTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
    OFFICIAL_DEPTS.forEach((d) => {
      deptStats[d] = { openJobs: 0, applicants: 0, hired: 0 };
    });

    jobs.forEach((j) => {
      if (j.status === 'Open' && deptStats[j.department]) {
        deptStats[j.department].openJobs += j.openings || 1;
      }
    });

    candidates.forEach((c) => {
      if (deptStats[c.department]) {
        deptStats[c.department].applicants += 1;
        if (c.status === 'Hired' || c.stage === 'Hired') {
          deptStats[c.department].hired += 1;
        }
      }
    });

    res.json(
      successResponse(
        {
          openPositions,
          totalApplicants,
          newApplicants,
          shortlistedCandidates,
          interviewsScheduled,
          selectedCandidates,
          positionsFilled,
          stageCounts,
          deptStats,
        },
        'Recruitment metrics retrieved'
      )
    );
  }),

  // ─── 2. JOB REQUISITION CONTROLLERS ──────────────────────────────────────
  listJobs: asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.department && req.query.department !== 'All') {
      filter.department = req.query.department;
    }
    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }
    if (req.query.employmentType && req.query.employmentType !== 'All') {
      filter.employmentType = req.query.employmentType;
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ title: regex }, { jobId: regex }, { designation: regex }];
    }

    const jobs = await JobRequisition.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    // Attach real applicant count per job
    const jobIds = jobs.map((j) => j._id);
    const applicantCounts = await Candidate.aggregate([
      { $match: { appliedJob: { $in: jobIds } } },
      { $group: { _id: '$appliedJob', count: { $sum: 1 } } },
    ]);
    const countMap = new Map();
    applicantCounts.forEach((ac) => countMap.set(String(ac._id), ac.count));

    const enrichedJobs = jobs.map((j) => ({
      ...j,
      applicantCount: countMap.get(String(j._id)) || 0,
    }));

    res.json(successResponse(enrichedJobs, 'Job requisitions retrieved'));
  }),

  createJob: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const {
      title,
      department,
      designation,
      openings,
      employmentType,
      location,
      experience,
      salaryRange,
      priority,
      openingDate,
      closingDate,
      description,
      responsibilities,
      requirements,
      qualifications,
      status,
    } = req.body;

    if (!title || !department || !designation) {
      throw createValidationError('Title, department, and designation are required');
    }

    let uniqueJobId = generateJobId();
    while (await JobRequisition.exists({ jobId: uniqueJobId })) {
      uniqueJobId = generateJobId();
    }

    const job = await JobRequisition.create({
      jobId: uniqueJobId,
      title: title.trim(),
      department: department.trim(),
      designation: designation.trim(),
      openings: Number(openings) || 1,
      employmentType: employmentType || 'Full Time',
      location: location || 'In-Office / Hybrid',
      experience: experience || '1-3 Years',
      salaryRange: salaryRange || 'Competitive',
      priority: priority || 'Medium',
      openingDate: openingDate ? new Date(openingDate) : new Date(),
      closingDate: closingDate ? new Date(closingDate) : null,
      description: description || '',
      responsibilities: responsibilities || '',
      requirements: requirements || '',
      qualifications: qualifications || '',
      status: status || 'Open',
      createdBy: req.user.userId,
    });

    res.status(201).json(createdResponse(job, 'Job requisition created successfully'));
  }),

  getJob: asyncHandler(async (req, res) => {
    const job = await JobRequisition.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .lean();
    if (!job) throw createNotFoundError('Job requisition not found');

    const candidates = await Candidate.find({ appliedJob: job._id })
      .select('candidateId name email phone experience stage status createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json(successResponse({ ...job, candidates }, 'Job requisition details retrieved'));
  }),

  updateJob: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const job = await JobRequisition.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!job) throw createNotFoundError('Job requisition not found');

    res.json(successResponse(job, 'Job requisition updated'));
  }),

  deleteJob: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const job = await JobRequisition.findByIdAndDelete(req.params.id);
    if (!job) throw createNotFoundError('Job requisition not found');

    res.json(successResponse({ id: req.params.id }, 'Job requisition deleted'));
  }),

  // ─── 3. CANDIDATE / APPLICANT CONTROLLERS ─────────────────────────────────
  listCandidates: asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.department && req.query.department !== 'All') {
      filter.department = req.query.department;
    }
    if (req.query.stage && req.query.stage !== 'All') {
      filter.stage = req.query.stage;
    }
    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }
    if (req.query.appliedJob) {
      filter.appliedJob = req.query.appliedJob;
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: regex }, { email: regex }, { candidateId: regex }, { appliedPosition: regex }];
    }

    const candidates = await Candidate.find(filter)
      .populate('appliedJob', 'jobId title department')
      .populate('recruiter', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    res.json(successResponse(candidates, 'Candidates retrieved'));
  }),

  createCandidate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const {
      name,
      email,
      phone,
      location,
      appliedJob,
      appliedPosition,
      department,
      experience,
      skills,
      education,
      currentCompany,
      noticePeriod,
      resumeUrl,
      source,
      notes,
    } = req.body;

    if (!name || !email || !phone || !appliedPosition || !department) {
      throw createValidationError('Name, email, phone, applied position, and department are required');
    }

    let uniqueCandidateId = generateCandidateId();
    while (await Candidate.exists({ candidateId: uniqueCandidateId })) {
      uniqueCandidateId = generateCandidateId();
    }

    const skillsArray = Array.isArray(skills)
      ? skills
      : String(skills || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const candidate = await Candidate.create({
      candidateId: uniqueCandidateId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      location: location || '',
      appliedJob: appliedJob || null,
      appliedPosition: appliedPosition.trim(),
      department: department.trim(),
      experience: experience || '0 Years',
      skills: skillsArray,
      education: education || 'Graduate',
      currentCompany: currentCompany || '',
      noticePeriod: noticePeriod || 'Immediate',
      resumeUrl: resumeUrl || '',
      source: source || 'Direct Application',
      stage: 'Applied',
      status: 'New',
      notes: notes || '',
      recruiter: req.user.userId,
      history: [{ stage: 'Applied', updatedAt: new Date(), notes: 'Candidate registered in system' }],
    });

    res.status(201).json(createdResponse(candidate, 'Candidate profile created successfully'));
  }),

  getCandidate: asyncHandler(async (req, res) => {
    const candidate = await Candidate.findById(req.params.id)
      .populate('appliedJob', 'jobId title department location openings')
      .populate('recruiter', 'firstName lastName email')
      .populate('convertedEmployeeId', 'firstName lastName email department designation')
      .populate('history.changedBy', 'firstName lastName email')
      .lean();

    if (!candidate) throw createNotFoundError('Candidate not found');
    res.json(successResponse(candidate, 'Candidate profile retrieved'));
  }),

  updateCandidate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    if (req.body.skills && !Array.isArray(req.body.skills)) {
      req.body.skills = String(req.body.skills)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const candidate = await Candidate.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!candidate) throw createNotFoundError('Candidate not found');

    res.json(successResponse(candidate, 'Candidate updated'));
  }),

  updateStage: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { stage, fromStage, reason, notes } = req.body;
    if (!stage) throw createValidationError('Stage is required');

    const ALLOWED_STAGES = [
      'Applied',
      'Screening',
      'Shortlisted',
      'Assessment',
      'Interview',
      'Technical Round',
      'HR Round',
      'Final / HR Round',
      'Selected',
      'Offer',
      'Hired',
      'Rejected',
      'Withdrawn',
      'On Hold',
    ];
    if (!ALLOWED_STAGES.includes(stage)) {
      throw createValidationError(`Invalid stage: "${stage}". Allowed: ${ALLOWED_STAGES.join(', ')}`);
    }

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    const oldStage = candidate.stage || 'Applied';

    // Business transition validation rules
    const VALID_TRANSITIONS = {
      'Applied': ['Screening', 'Shortlisted', 'Rejected', 'Withdrawn', 'On Hold'],
      'Screening': ['Applied', 'Shortlisted', 'Assessment', 'Interview', 'Technical Round', 'Rejected', 'Withdrawn', 'On Hold'],
      'Shortlisted': ['Screening', 'Assessment', 'Interview', 'Technical Round', 'Rejected', 'Withdrawn', 'On Hold'],
      'Assessment': ['Shortlisted', 'Interview', 'Technical Round', 'Final / HR Round', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
      'Interview': ['Shortlisted', 'Assessment', 'Technical Round', 'HR Round', 'Final / HR Round', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
      'Technical Round': ['Assessment', 'Interview', 'HR Round', 'Final / HR Round', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
      'HR Round': ['Technical Round', 'Interview', 'Final / HR Round', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
      'Final / HR Round': ['Technical Round', 'Interview', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
      'Selected': ['Offer', 'Interview', 'Final / HR Round', 'Technical Round', 'Rejected', 'Withdrawn', 'On Hold'],
      'Offer': ['Hired', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
      'Hired': ['Offer', 'Selected', 'Withdrawn'],
      'On Hold': ['Applied', 'Screening', 'Shortlisted', 'Assessment', 'Interview', 'Technical Round', 'Final / HR Round', 'Selected', 'Offer', 'Rejected', 'Withdrawn'],
      'Rejected': ['Applied', 'Screening', 'Shortlisted', 'Assessment', 'Interview', 'Technical Round', 'Selected'],
      'Withdrawn': ['Applied', 'Screening', 'Shortlisted', 'Assessment', 'Interview', 'Selected'],
    };

    if (stage !== oldStage) {
      const allowedTargets = VALID_TRANSITIONS[oldStage];
      if (allowedTargets && !allowedTargets.includes(stage)) {
        throw createValidationError(
          `Invalid stage transition: Cannot move candidate directly from "${oldStage}" to "${stage}". Valid progression required.`
        );
      }
    }

    candidate.stage = stage;

    if (stage === 'Selected') candidate.status = 'In Review';
    else if (stage === 'Offer') candidate.status = 'Offered';
    else if (stage === 'Hired') candidate.status = 'Hired';
    else if (stage === 'Rejected') {
      candidate.status = 'Rejected';
      candidate.rejection = {
        reason: reason || 'Stage moved to Rejected',
        notes: notes || '',
        rejectedBy: req.user.userId,
        rejectedByName: actorName(req.user),
        rejectedAt: new Date(),
      };
    } else if (stage === 'Withdrawn') {
      candidate.status = 'Withdrawn';
      candidate.withdrawal = {
        reason: reason || 'Stage moved to Withdrawn',
        notes: notes || '',
        recordedBy: req.user.userId,
        recordedByName: actorName(req.user),
        withdrawnAt: new Date(),
      };
    } else if (stage === 'On Hold') {
      candidate.status = 'On Hold';
    } else if (stage === 'Shortlisted') candidate.status = 'Shortlisted';
    else if (stage === 'Assessment') candidate.status = 'In Review';
    else if (stage === 'Screening') candidate.status = 'In Review';
    else if (['Interview', 'Technical Round', 'HR Round', 'Final / HR Round'].includes(stage)) candidate.status = 'Interviewing';
    else if (stage === 'Applied') candidate.status = 'New';

    candidate.history.push({
      fromStage: fromStage || oldStage,
      toStage: stage,
      stage,
      changedBy: req.user.userId,
      changedByName: actorName(req.user),
      reason: reason || '',
      notes: notes || `Candidate transitioned from ${fromStage || oldStage} to ${stage}`,
      updatedAt: new Date(),
    });

    await candidate.save();
    res.json(successResponse(candidate, `Candidate stage updated to ${stage}`));
  }),

  recordAssessment: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { name, score, maxScore, result, evaluator, feedback, dueDate } = req.body;
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    const scoreNum = Number(score) || 0;
    const maxScoreNum = Number(maxScore) || 100;
    const computedPercentage = maxScoreNum > 0 ? Math.round((scoreNum / maxScoreNum) * 100) : 0;

    candidate.assessment = {
      name: name || 'Technical Assessment',
      assignedDate: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      score: scoreNum,
      maxScore: maxScoreNum,
      result: result || (computedPercentage >= 60 ? 'Passed' : 'Failed'),
      evaluator: evaluator || actorName(req.user),
      feedback: feedback || '',
      submittedAt: new Date(),
    };

    if (computedPercentage > 0) {
      candidate.atsScore = computedPercentage;
    }

    const oldStage = candidate.stage || 'Assessment';
    if (result === 'Passed' || (!result && computedPercentage >= 60)) {
      candidate.stage = 'Interview';
      candidate.status = 'Interviewing';
      candidate.history.push({
        fromStage: oldStage,
        toStage: 'Interview',
        stage: 'Interview',
        changedBy: req.user.userId,
        changedByName: actorName(req.user),
        reason: `Assessment Passed (${scoreNum}/${maxScoreNum})`,
        notes: feedback || 'Candidate passed technical assessment and progressed to interview round',
        updatedAt: new Date(),
      });
    } else if (result === 'Failed') {
      candidate.stage = 'Rejected';
      candidate.status = 'Rejected';
      candidate.rejection = {
        reason: 'Failed technical assessment',
        notes: feedback || `Scored ${scoreNum}/${maxScoreNum}`,
        rejectedBy: req.user.userId,
        rejectedByName: actorName(req.user),
        rejectedAt: new Date(),
      };
      candidate.history.push({
        fromStage: oldStage,
        toStage: 'Rejected',
        stage: 'Rejected',
        changedBy: req.user.userId,
        changedByName: actorName(req.user),
        reason: 'Assessment Failed',
        notes: feedback || `Scored ${scoreNum}/${maxScoreNum}`,
        updatedAt: new Date(),
      });
    } else {
      candidate.stage = 'Assessment';
      candidate.status = 'In Review';
      candidate.history.push({
        fromStage: oldStage,
        toStage: 'Assessment',
        stage: 'Assessment',
        changedBy: req.user.userId,
        changedByName: actorName(req.user),
        reason: 'Assessment recorded: ' + (result || 'Pending'),
        notes: feedback || `Score: ${scoreNum}/${maxScoreNum}`,
        updatedAt: new Date(),
      });
    }

    await candidate.save();
    res.json(successResponse(candidate, 'Assessment record saved successfully'));
  }),

  recordScreening: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const {
      screeningDate,
      recruiter,
      recruiterName,
      skillsMatch,
      experienceMatch,
      communicationAssessment,
      notes,
      decision,
      rejectionReason,
    } = req.body;

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    const validDecisions = ['Pass', 'Hold', 'Fail', ''];
    if (decision && !validDecisions.includes(decision)) {
      throw createValidationError('Invalid screening decision. Allowed: Pass, Hold, Fail');
    }

    let recruiterId = null;
    let currentRecruiterName = recruiterName || '';
    if (recruiter && mongoose.Types.ObjectId.isValid(recruiter)) {
      recruiterId = recruiter;
    } else if (recruiter && typeof recruiter === 'string') {
      currentRecruiterName = recruiter;
    }
    if (!recruiterId && req.user?.userId && mongoose.Types.ObjectId.isValid(req.user.userId)) {
      recruiterId = req.user.userId;
    }
    if (!currentRecruiterName) {
      currentRecruiterName = actorName(req.user);
    }

    candidate.screening = {
      screeningDate: screeningDate ? new Date(screeningDate) : new Date(),
      recruiter: recruiterId,
      recruiterName: currentRecruiterName,
      skillsMatch: Number(skillsMatch) || 3,
      experienceMatch: Number(experienceMatch) || 3,
      communicationAssessment: Number(communicationAssessment) || 3,
      notes: notes || '',
      decision: decision || 'Pass',
      submittedAt: new Date(),
      submittedBy: req.user.userId,
    };

    const oldStage = candidate.stage || 'Screening';
    if (decision === 'Pass') {
      candidate.stage = 'Shortlisted';
      candidate.status = 'Shortlisted';
      candidate.history.push({
        fromStage: oldStage,
        toStage: 'Shortlisted',
        stage: 'Shortlisted',
        changedBy: req.user.userId,
        changedByName: actorName(req.user),
        reason: 'Screening Evaluation: Pass',
        notes: notes || 'Candidate cleared screening assessment',
        updatedAt: new Date(),
      });
    } else if (decision === 'Fail') {
      candidate.stage = 'Rejected';
      candidate.status = 'Rejected';
      candidate.rejection = {
        reason: rejectionReason || 'Failed screening assessment',
        notes: notes || '',
        rejectedBy: req.user.userId,
        rejectedByName: actorName(req.user),
        rejectedAt: new Date(),
      };
      candidate.history.push({
        fromStage: oldStage,
        toStage: 'Rejected',
        stage: 'Rejected',
        changedBy: req.user.userId,
        changedByName: actorName(req.user),
        reason: rejectionReason || 'Screening Evaluation: Fail',
        notes: notes || 'Candidate did not pass screening assessment',
        updatedAt: new Date(),
      });
    } else if (decision === 'Hold') {
      candidate.stage = 'Screening';
      candidate.status = 'In Review';
      candidate.history.push({
        fromStage: oldStage,
        toStage: 'Screening',
        stage: 'Screening',
        changedBy: req.user.userId,
        changedByName: actorName(req.user),
        reason: 'Screening Evaluation: On Hold',
        notes: notes || 'Screening placed on hold',
        updatedAt: new Date(),
      });
    }

    await candidate.save();
    res.json(successResponse(candidate, 'Screening assessment saved successfully'));
  }),

  shortlistCandidate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    const oldStage = candidate.stage || 'Applied';
    candidate.stage = 'Shortlisted';
    candidate.status = 'Shortlisted';
    candidate.history.push({
      fromStage: oldStage,
      toStage: 'Shortlisted',
      stage: 'Shortlisted',
      changedBy: req.user.userId,
      changedByName: actorName(req.user),
      reason: 'Candidate shortlisted for interview rounds',
      notes: req.body.notes || 'Shortlisted',
      updatedAt: new Date(),
    });
    await candidate.save();

    res.json(successResponse(candidate, 'Candidate shortlisted successfully'));
  }),

  rejectCandidate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { reason, notes } = req.body;
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    const oldStage = candidate.stage || 'Applied';
    candidate.stage = 'Rejected';
    candidate.status = 'Rejected';
    candidate.rejection = {
      reason: reason || 'Candidate not suitable',
      notes: notes || '',
      rejectedBy: req.user.userId,
      rejectedByName: actorName(req.user),
      rejectedAt: new Date(),
    };

    candidate.history.push({
      fromStage: oldStage,
      toStage: 'Rejected',
      stage: 'Rejected',
      changedBy: req.user.userId,
      changedByName: actorName(req.user),
      reason: reason || 'Candidate rejected',
      notes: notes || '',
      updatedAt: new Date(),
    });
    await candidate.save();

    res.json(successResponse(candidate, 'Candidate rejected successfully'));
  }),

  recordWithdrawal: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { reason, notes } = req.body;
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    const oldStage = candidate.stage || 'Applied';
    candidate.stage = 'Withdrawn';
    candidate.status = 'Withdrawn';
    candidate.withdrawal = {
      reason: reason || 'Candidate withdrew application',
      notes: notes || '',
      recordedBy: req.user.userId,
      recordedByName: actorName(req.user),
      withdrawnAt: new Date(),
    };

    candidate.history.push({
      fromStage: oldStage,
      toStage: 'Withdrawn',
      stage: 'Withdrawn',
      changedBy: req.user.userId,
      changedByName: actorName(req.user),
      reason: reason || 'Withdrawn',
      notes: notes || 'Candidate application withdrawn',
      updatedAt: new Date(),
    });
    await candidate.save();

    res.json(successResponse(candidate, 'Candidate application marked as Withdrawn'));
  }),

  getTimeline: asyncHandler(async (req, res) => {
    const candidate = await Candidate.findById(req.params.id)
      .select('candidateId name stage status history screening rejection withdrawal interviews offer convertedEmployeeId')
      .populate('history.changedBy', 'firstName lastName email')
      .lean();

    if (!candidate) throw createNotFoundError('Candidate not found');

    const history = (candidate.history || []).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(successResponse({ candidateId: candidate.candidateId, name: candidate.name, history }, 'Candidate timeline retrieved'));
  }),

  // ─── 4. INTERVIEW MANAGEMENT CONTROLLERS ─────────────────────────────────
  interviewSummary: asyncHandler(async (_req, res) => {
    const candidates = await Candidate.find({ 'interviews.0': { $exists: true } })
      .select('interviews')
      .lean();

    const all = [];
    candidates.forEach((c) => {
      (c.interviews || []).forEach((inv) => all.push(inv));
    });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const total = all.length;
    const scheduled = all.filter((i) => i.status === 'Scheduled').length;
    const today = all.filter((i) => {
      if (!i.date) return false;
      return new Date(i.date).toISOString().slice(0, 10) === todayStr;
    }).length;
    const upcoming = all.filter((i) => {
      if (!i.date || ['Completed', 'Cancelled'].includes(i.status)) return false;
      return new Date(i.date) >= now;
    }).length;
    const completed = all.filter((i) => i.status === 'Completed').length;
    const pendingFeedback = all.filter(
      (i) => (i.status === 'Scheduled' && new Date(i.date) <= now) || (i.status === 'Completed' && !i.feedback)
    ).length;
    const cancelled = all.filter((i) => i.status === 'Cancelled').length;

    res.json(
      successResponse(
        { total, scheduled, today, upcoming, completed, pendingFeedback, cancelled },
        'Interview summary calculated'
      )
    );
  }),

  listInterviews: asyncHandler(async (req, res) => {
    const candidates = await Candidate.find({ 'interviews.0': { $exists: true } })
      .populate('appliedJob', 'title department jobId')
      .lean();

    let list = [];
    candidates.forEach((c) => {
      (c.interviews || []).forEach((inv) => {
        list.push({
          ...inv,
          candidateId: c._id,
          candidateCode: c.candidateId,
          candidateName: c.name,
          candidateEmail: c.email,
          candidatePhone: c.phone,
          appliedPosition: c.appliedPosition,
          department: c.department,
          candidateStage: c.stage,
          candidateStatus: c.status,
        });
      });
    });

    if (req.query.department && req.query.department !== 'All') {
      list = list.filter((i) => i.department === req.query.department);
    }
    if (req.query.status && req.query.status !== 'All') {
      list = list.filter((i) => i.status === req.query.status);
    }
    if (req.query.round && req.query.round !== 'All') {
      list = list.filter((i) => i.round === req.query.round);
    }
    if (req.query.type && req.query.type !== 'All') {
      list = list.filter((i) => i.type === req.query.type);
    }
    if (req.query.date) {
      list = list.filter((i) => i.date && new Date(i.date).toISOString().slice(0, 10) === req.query.date);
    }
    if (req.query.search) {
      const q = req.query.search.toLowerCase().trim();
      list = list.filter(
        (i) =>
          (i.candidateName || '').toLowerCase().includes(q) ||
          (i.candidateEmail || '').toLowerCase().includes(q) ||
          (i.interviewer || '').toLowerCase().includes(q) ||
          (i.appliedPosition || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    res.json(successResponse(list, 'Interviews list retrieved'));
  }),

  scheduleInterview: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const {
      round,
      interviewer,
      interviewerId,
      date,
      time,
      duration = '45 Mins',
      type = 'Online Video',
      meetingLink = '',
      location = '',
      notes = '',
      ignoreConflict = false,
    } = req.body;

    if (!date) throw createValidationError('Interview date is required');

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    // Calculate event start and end times for calendar sync and conflict check
    const d = new Date(date);
    let hours = 11;
    let minutes = 0;
    if (time) {
      const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const ampm = match[3] ? match[3].toUpperCase() : '';
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }
    const startAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, 0);
    const durMatch = String(duration).match(/(\d+)/);
    const durMins = durMatch ? parseInt(durMatch[1], 10) : 45;
    const endAt = new Date(startAt.getTime() + durMins * 60000);

    // Conflict detection against interviewer calendar
    let conflictWarning = null;
    if (interviewerId && mongoose.Types.ObjectId.isValid(interviewerId)) {
      const conflict = await CalendarEvent.findOne({
        assignedTo: interviewerId,
        status: { $ne: 'Cancelled' },
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      }).lean();

      if (conflict) {
        conflictWarning = `Interviewer already has an overlapping event: "${conflict.title}"`;
        if (!ignoreConflict) {
          return res.status(409).json({
            status: 'conflict',
            message: conflictWarning,
            conflict,
          });
        }
      }
    }

    // Create synchronized CalendarEvent in MongoDB Atlas
    let calendarEvent = null;
    try {
      calendarEvent = await CalendarEvent.create({
        title: `Interview: ${candidate.name} - ${round || 'Round'}`,
        description: notes || `Interview round ${round || '1'} with candidate ${candidate.name}`,
        startAt,
        endAt,
        location: location || '',
        meetingLink: meetingLink || '',
        department: candidate.department || 'Tech',
        type: 'Interview',
        status: 'Scheduled',
        assignedTo: interviewerId && mongoose.Types.ObjectId.isValid(interviewerId) ? interviewerId : req.user.userId,
        participants: interviewerId && mongoose.Types.ObjectId.isValid(interviewerId) ? [interviewerId] : [],
        createdBy: req.user.userId,
        candidate: candidate._id,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        candidatePhone: candidate.phone,
        jobPosition: candidate.appliedPosition,
        interviewRound: round || 'Technical Round 1',
        interviewType: type || 'Online Video',
        notes: notes || '',
      });
    } catch (calErr) {
      console.error('Failed to create calendar event for interview:', calErr);
    }

    candidate.interviews.push({
      round: round || 'Technical Round 1',
      interviewer: interviewer || 'HR / Tech Lead',
      interviewerId: interviewerId && mongoose.Types.ObjectId.isValid(interviewerId) ? interviewerId : null,
      date: new Date(date),
      time: time || '11:00 AM',
      duration: duration || '45 Mins',
      type: type || 'Online Video',
      meetingLink: meetingLink || '',
      location: location || '',
      notes: notes || '',
      status: 'Scheduled',
      calendarEventId: calendarEvent ? calendarEvent._id : null,
    });

    const oldStage = candidate.stage || 'Shortlisted';
    if (['Applied', 'Screening', 'Shortlisted'].includes(oldStage)) {
      candidate.stage = 'Interview';
      candidate.status = 'Interviewing';
    }

    candidate.history.push({
      fromStage: oldStage,
      toStage: candidate.stage,
      stage: candidate.stage,
      changedBy: req.user.userId,
      changedByName: actorName(req.user),
      reason: `Scheduled ${round || 'Interview'}`,
      notes: `Scheduled for ${new Date(date).toLocaleDateString()} at ${time || '11:00 AM'} (${duration || '45 Mins'})`,
      updatedAt: new Date(),
    });

    await candidate.save();
    res.status(201).json(
      createdResponse(
        { candidate, calendarEvent, warning: conflictWarning },
        'Interview scheduled and calendar synchronized successfully'
      )
    );
  }),

  updateInterview: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { candidateId, interviewId } = req.params;
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) throw createNotFoundError('Candidate not found');

    const interview = candidate.interviews.id(interviewId);
    if (!interview) throw createNotFoundError('Interview not found');

    const {
      status,
      round,
      date,
      time,
      duration,
      type,
      meetingLink,
      location,
      notes,
      feedback,
      interviewer,
      interviewerId,
      cancellationReason,
      action,
    } = req.body;

    if (round !== undefined) interview.round = round;
    if (type !== undefined) interview.type = type;
    if (meetingLink !== undefined) interview.meetingLink = meetingLink;
    if (location !== undefined) interview.location = location;
    if (notes !== undefined) interview.notes = notes;
    if (interviewer !== undefined) interview.interviewer = interviewer;
    if (interviewerId !== undefined && mongoose.Types.ObjectId.isValid(interviewerId)) {
      interview.interviewerId = interviewerId;
    }

    // 1. Reschedule Action
    if (action === 'reschedule' || (date && time && status === 'Rescheduled')) {
      interview.date = new Date(date);
      interview.time = time;
      if (duration) interview.duration = duration;
      interview.status = 'Rescheduled';

      // Update CalendarEvent
      if (interview.calendarEventId) {
        const d = new Date(interview.date);
        let hours = 11;
        let minutes = 0;
        if (interview.time) {
          const match = interview.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (match) {
            hours = parseInt(match[1], 10);
            minutes = parseInt(match[2], 10);
            const ampm = match[3] ? match[3].toUpperCase() : '';
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
          }
        }
        const startAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, 0);
        const durMatch = String(interview.duration || '45').match(/(\d+)/);
        const durMins = durMatch ? parseInt(durMatch[1], 10) : 45;
        const endAt = new Date(startAt.getTime() + durMins * 60000);

        await CalendarEvent.findByIdAndUpdate(interview.calendarEventId, {
          startAt,
          endAt,
          status: 'Rescheduled',
          meetingLink: interview.meetingLink || '',
          location: interview.location || '',
          assignedTo: interview.interviewerId || req.user.userId,
        }).catch(() => {});
      }

      candidate.history.push({
        fromStage: candidate.stage,
        toStage: candidate.stage,
        stage: candidate.stage,
        changedBy: req.user.userId,
        changedByName: actorName(req.user),
        reason: `Interview Rescheduled: ${interview.round}`,
        notes: `New date: ${new Date(date).toLocaleDateString()} at ${time} (${notes || ''})`,
        updatedAt: new Date(),
      });
    }

    // 2. Cancel Action
    if (action === 'cancel' || status === 'Cancelled') {
      interview.status = 'Cancelled';
      interview.cancellationReason = cancellationReason || notes || 'Cancelled by HR';
      interview.cancelledBy = req.user.userId;
      interview.cancelledAt = new Date();

      if (interview.calendarEventId) {
        await CalendarEvent.findByIdAndUpdate(interview.calendarEventId, {
          status: 'Cancelled',
        }).catch(() => {});
      }

      candidate.history.push({
        fromStage: candidate.stage,
        toStage: candidate.stage,
        stage: candidate.stage,
        changedBy: req.user.userId,
        changedByName: actorName(req.user),
        reason: `Interview Cancelled: ${interview.round}`,
        notes: interview.cancellationReason,
        updatedAt: new Date(),
      });
    }

    // 3. Status explicit update (if not reschedule or cancel)
    if (status !== undefined && !['Rescheduled', 'Cancelled'].includes(status)) {
      interview.status = status;
      if (interview.calendarEventId) {
        await CalendarEvent.findByIdAndUpdate(interview.calendarEventId, { status }).catch(() => {});
      }
    }

    // 4. Feedback Submission
    if (feedback) {
      interview.feedback = {
        technicalSkills: Number(feedback.technicalSkills) || 4,
        communication: Number(feedback.communication) || 4,
        problemSolving: Number(feedback.problemSolving) || 4,
        teamwork: Number(feedback.teamwork) || 4,
        overallRating: Number(feedback.overallRating) || 4,
        strengths: feedback.strengths || '',
        weaknesses: feedback.weaknesses || '',
        comments: feedback.comments || '',
        recommendation: feedback.recommendation || 'Hire',
        submittedAt: new Date(),
      };
      interview.status = 'Completed';

      if (interview.calendarEventId) {
        await CalendarEvent.findByIdAndUpdate(interview.calendarEventId, {
          status: 'Completed',
        }).catch(() => {});
      }

      candidate.rating = Number(feedback.overallRating) || candidate.rating;

      const prev = candidate.stage;
      if (['Strong Hire', 'Hire', 'Selected'].includes(feedback.recommendation)) {
        candidate.stage = 'Selected';
        candidate.status = 'In Review';
        candidate.history.push({
          fromStage: prev,
          toStage: 'Selected',
          stage: 'Selected',
          changedBy: req.user.userId,
          changedByName: actorName(req.user),
          reason: `Interview Recommendation: ${feedback.recommendation}`,
          notes: feedback.comments || 'Interview completed with positive recommendation',
          updatedAt: new Date(),
        });
      } else if (feedback.recommendation === 'Next Round') {
        const nextRoundStage = interview.round.includes('Technical') ? 'Technical Round' : 'Final / HR Round';
        candidate.stage = nextRoundStage;
        candidate.status = 'Interviewing';
        candidate.history.push({
          fromStage: prev,
          toStage: nextRoundStage,
          stage: nextRoundStage,
          changedBy: req.user.userId,
          changedByName: actorName(req.user),
          reason: 'Interview Cleared: Next Round Recommended',
          notes: feedback.comments || `Progressed from ${interview.round} to ${nextRoundStage}`,
          updatedAt: new Date(),
        });
      } else if (feedback.recommendation === 'Reject') {
        candidate.stage = 'Rejected';
        candidate.status = 'Rejected';
        candidate.rejection = {
          reason: 'Interview evaluation not met',
          notes: feedback.comments || '',
          rejectedBy: req.user.userId,
          rejectedByName: actorName(req.user),
          rejectedAt: new Date(),
        };
        candidate.history.push({
          fromStage: prev,
          toStage: 'Rejected',
          stage: 'Rejected',
          changedBy: req.user.userId,
          changedByName: actorName(req.user),
          reason: 'Interview Recommendation: Reject',
          notes: feedback.comments || 'Candidate rejected following interview feedback',
          updatedAt: new Date(),
        });
      } else if (feedback.recommendation === 'Hold') {
        candidate.stage = 'On Hold';
        candidate.status = 'On Hold';
        candidate.history.push({
          fromStage: prev,
          toStage: 'On Hold',
          stage: 'On Hold',
          changedBy: req.user.userId,
          changedByName: actorName(req.user),
          reason: 'Interview Recommendation: On Hold',
          notes: feedback.comments || 'Candidate placed on hold pending further review',
          updatedAt: new Date(),
        });
      }
    }

    await candidate.save();
    res.json(successResponse(candidate, 'Interview record updated and synchronized'));
  }),

  // ─── 5. OFFER MANAGEMENT & EMPLOYEE CONVERSION ────────────────────────────
  createOffer: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { offeredDesignation, department, salary, joiningDate, status, notes } = req.body;
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    candidate.offer = {
      offeredDesignation: offeredDesignation || candidate.appliedPosition,
      department: department || candidate.department,
      salary: salary || 'Competitive',
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      offerDate: new Date(),
      status: status || 'Sent',
      notes: notes || '',
    };

    candidate.status = 'Offered';
    candidate.stage = 'Selected';
    candidate.history.push({ stage: 'Selected', updatedAt: new Date(), notes: `Job Offer created: ${offeredDesignation || candidate.appliedPosition}` });

    await candidate.save();
    res.json(successResponse(candidate, 'Offer saved successfully'));
  }),

  convertEmployee: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    if (candidate.convertedEmployeeId) {
      throw createValidationError('Candidate has already been converted to an employee');
    }

    // Check if user with this email already exists
    let existingUser = await User.findOne({ email: candidate.email });
    if (existingUser) {
      candidate.convertedEmployeeId = existingUser._id;
      candidate.status = 'Hired';
      candidate.stage = 'Hired';
      await candidate.save();
      return res.json(successResponse(existingUser, 'Candidate linked to existing employee record'));
    }

    // Generate names
    const parts = candidate.name.split(' ');
    const firstName = parts[0] || 'Employee';
    const lastName = parts.slice(1).join(' ') || 'Staff';
    const department = candidate.offer?.department || candidate.department || 'Tech';
    const designation = candidate.offer?.offeredDesignation || candidate.appliedPosition || 'Associate';
    const joiningDate = candidate.offer?.joiningDate ? candidate.offer.joiningDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const employeeId = `EMP-${Math.floor(10000 + Math.random() * 90000)}`;

    const newUser = await User.create({
      firstName,
      lastName,
      email: candidate.email,
      password: `Pass@${Math.floor(1000 + Math.random() * 9000)}`,
      phone: candidate.phone,
      department,
      designation,
      location: candidate.location || '',
      role: 'employee',
      isActive: true,
      personalInfo: {
        fullName: candidate.name,
        email: candidate.email,
        phoneNumber: candidate.phone,
        address: candidate.location || '',
      },
      jobDetails: {
        employeeId,
        department,
        designation,
        joiningDate,
        employmentType: 'Full Time',
      },
      bankDetails: {
        accountHolderName: candidate.name,
        bankName: 'HDFC Bank',
        accountNumber: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        ifscCode: 'HDFC0001234',
        branchName: 'Main Branch',
      },
    });

    candidate.convertedEmployeeId = newUser._id;
    candidate.status = 'Hired';
    candidate.stage = 'Hired';
    candidate.history.push({
      stage: 'Hired',
      updatedAt: new Date(),
      notes: `Converted to Employee: ${employeeId} (${designation})`,
    });
    await candidate.save();

    res.status(201).json(
      createdResponse(
        { candidate, user: newUser },
        `Candidate successfully onboarded as employee (${employeeId})`
      )
    );
  }),

  deleteCandidate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    res.json(successResponse({ id: req.params.id }, 'Candidate deleted'));
  }),
};
