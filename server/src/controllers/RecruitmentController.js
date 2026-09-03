import mongoose from 'mongoose';
import JobRequisition from '../models/JobRequisition.js';
import Candidate from '../models/Candidate.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const generateJobId = () => `JOB-${Math.floor(10000 + Math.random() * 90000)}`;
const generateCandidateId = () => `CAN-${Math.floor(10000 + Math.random() * 90000)}`;

export const RecruitmentController = {
  // 1. Summary KPIs & Pipeline Metrics
  summary: asyncHandler(async (_req, res) => {
    const [jobs, candidates] = await Promise.all([
      JobRequisition.find().lean(),
      Candidate.find().populate('appliedJob', 'title department').lean(),
    ]);

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
      'Interview',
      'Technical Round',
      'HR Round',
      'Selected',
      'Rejected',
      'Hired',
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

    const { stage, notes } = req.body;
    if (!stage) throw createValidationError('Stage is required');

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    candidate.stage = stage;
    if (stage === 'Selected') candidate.status = 'In Review';
    if (stage === 'Rejected') candidate.status = 'Rejected';
    if (stage === 'Shortlisted') candidate.status = 'Shortlisted';
    if (['Interview', 'Technical Round', 'HR Round'].includes(stage)) candidate.status = 'Interviewing';

    candidate.history.push({ stage, updatedAt: new Date(), notes: notes || `Moved to ${stage}` });
    await candidate.save();

    res.json(successResponse(candidate, `Candidate stage updated to ${stage}`));
  }),

  shortlistCandidate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    candidate.stage = 'Shortlisted';
    candidate.status = 'Shortlisted';
    candidate.history.push({ stage: 'Shortlisted', updatedAt: new Date(), notes: 'Shortlisted for interview rounds' });
    await candidate.save();

    res.json(successResponse(candidate, 'Candidate shortlisted successfully'));
  }),

  rejectCandidate: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    candidate.stage = 'Rejected';
    candidate.status = 'Rejected';
    candidate.history.push({ stage: 'Rejected', updatedAt: new Date(), notes: req.body.reason || 'Candidate rejected' });
    await candidate.save();

    res.json(successResponse(candidate, 'Candidate rejected'));
  }),

  // ─── 4. INTERVIEW MANAGEMENT CONTROLLERS ─────────────────────────────────
  scheduleInterview: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { round, interviewer, interviewerId, date, time, type, meetingLink, notes } = req.body;
    if (!date) throw createValidationError('Interview date is required');

    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) throw createNotFoundError('Candidate not found');

    candidate.interviews.push({
      round: round || 'Technical Round 1',
      interviewer: interviewer || 'HR / Tech Lead',
      interviewerId: interviewerId || null,
      date: new Date(date),
      time: time || '11:00 AM',
      type: type || 'Online Video',
      meetingLink: meetingLink || '',
      notes: notes || '',
      status: 'Scheduled',
    });

    candidate.stage = 'Interview';
    candidate.status = 'Interviewing';
    candidate.history.push({
      stage: 'Interview',
      updatedAt: new Date(),
      notes: `Scheduled ${round || 'Interview'} for ${new Date(date).toLocaleDateString()}`,
    });

    await candidate.save();
    res.status(201).json(createdResponse(candidate, 'Interview scheduled successfully'));
  }),

  updateInterview: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { candidateId, interviewId } = req.params;
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) throw createNotFoundError('Candidate not found');

    const interview = candidate.interviews.id(interviewId);
    if (!interview) throw createNotFoundError('Interview not found');

    const { status, round, date, time, type, meetingLink, notes, feedback } = req.body;

    if (status !== undefined) interview.status = status;
    if (round !== undefined) interview.round = round;
    if (date !== undefined) interview.date = new Date(date);
    if (time !== undefined) interview.time = time;
    if (type !== undefined) interview.type = type;
    if (meetingLink !== undefined) interview.meetingLink = meetingLink;
    if (notes !== undefined) interview.notes = notes;

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

      // Auto update candidate rating
      candidate.rating = Number(feedback.overallRating) || candidate.rating;
      if (feedback.recommendation === 'Strong Hire' || feedback.recommendation === 'Hire') {
        candidate.stage = 'Selected';
        candidate.status = 'In Review';
      }
    }

    await candidate.save();
    res.json(successResponse(candidate, 'Interview record updated'));
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
