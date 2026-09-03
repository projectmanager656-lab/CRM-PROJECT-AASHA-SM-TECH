import mongoose from 'mongoose';
import PerformanceReview from '../models/PerformanceReview.js';
import User from '../models/User.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

export const PerformanceController = {
  // 1. List reviews with filtering
  list: asyncHandler(async (req, res) => {
    const filter = {};
    if (!isHrOrAdmin(req.user)) {
      filter.user = req.user.userId;
    } else if (req.query.user) {
      filter.user = req.query.user;
    }

    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }

    if (req.query.reviewCycle && req.query.reviewCycle !== 'All') {
      filter.reviewCycle = req.query.reviewCycle;
    }

    const reviews = await PerformanceReview.find(filter)
      .populate('user', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('reviewer', 'firstName lastName email department')
      .sort({ reviewDate: -1, createdAt: -1 })
      .lean();

    res.json(successResponse(reviews, 'Performance reviews retrieved'));
  }),

  // 2. Summary & Analytics
  summary: asyncHandler(async (req, res) => {
    const [employees, allReviews] = await Promise.all([
      User.find({
        role: 'employee',
        isActive: true,
        employmentStatus: { $nin: ['Exited', 'Terminated'] },
      })
        .select('firstName lastName email department designation personalInfo jobDetails createdAt')
        .lean(),
      PerformanceReview.find()
        .populate('user', 'department')
        .lean(),
    ]);

    const totalEmployees = employees.length;
    const completedReviews = allReviews.filter((r) => r.status === 'Completed');
    const pendingReviews = allReviews.filter((r) => r.status === 'Pending' || r.status === 'In Review');

    const totalRatingSum = completedReviews.reduce((sum, r) => sum + (Number(r.overallRating) || 0), 0);
    const averageRating = completedReviews.length > 0 ? Number((totalRatingSum / completedReviews.length).toFixed(2)) : 0;

    // Category averages
    const categorySums = { productivity: 0, qualityOfWork: 0, communication: 0, teamwork: 0, problemSolving: 0, punctuality: 0 };
    completedReviews.forEach((r) => {
      if (r.ratings) {
        categorySums.productivity += Number(r.ratings.productivity) || 0;
        categorySums.qualityOfWork += Number(r.ratings.qualityOfWork) || 0;
        categorySums.communication += Number(r.ratings.communication) || 0;
        categorySums.teamwork += Number(r.ratings.teamwork) || 0;
        categorySums.problemSolving += Number(r.ratings.problemSolving) || 0;
        categorySums.punctuality += Number(r.ratings.punctuality) || 0;
      }
    });

    const categoryAverages = {};
    const count = completedReviews.length || 1;
    Object.keys(categorySums).forEach((k) => {
      categoryAverages[k] = completedReviews.length > 0 ? Number((categorySums[k] / count).toFixed(2)) : 0;
    });

    // Department breakdown
    const deptMap = {};
    const OFFICIAL_DEPTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
    OFFICIAL_DEPTS.forEach((d) => {
      deptMap[d] = { count: 0, completed: 0, ratingSum: 0, avgRating: 0 };
    });

    employees.forEach((emp) => {
      const dept = emp.jobDetails?.department || emp.department;
      if (dept && deptMap[dept]) {
        deptMap[dept].count += 1;
      }
    });

    completedReviews.forEach((r) => {
      const dept = r.user?.department || r.user?.jobDetails?.department;
      if (dept && deptMap[dept]) {
        deptMap[dept].completed += 1;
        deptMap[dept].ratingSum += Number(r.overallRating) || 0;
      }
    });

    Object.keys(deptMap).forEach((d) => {
      const info = deptMap[d];
      info.avgRating = info.completed > 0 ? Number((info.ratingSum / info.completed).toFixed(2)) : 0;
    });

    res.json(
      successResponse(
        {
          totalEmployees,
          reviewsCompleted: completedReviews.length,
          reviewsPending: pendingReviews.length,
          averageRating,
          categoryAverages,
          departmentPerformance: deptMap,
        },
        'Performance summary calculated'
      )
    );
  }),

  // 3. Create a performance review
  create: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Only HR and Administrators can create performance evaluations');
    }

    const {
      user: userId,
      reviewCycle,
      reviewPeriod,
      ratings,
      overallRating,
      strengths,
      areasForImprovement,
      hrComments,
      managerFeedback,
      status,
      goals,
    } = req.body;

    if (!userId) {
      throw createValidationError('Employee selection is required');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      throw createNotFoundError('Selected employee not found');
    }

    const safeRatings = {
      productivity: Math.min(5, Math.max(1, Number(ratings?.productivity) || 4)),
      qualityOfWork: Math.min(5, Math.max(1, Number(ratings?.qualityOfWork) || 4)),
      communication: Math.min(5, Math.max(1, Number(ratings?.communication) || 4)),
      teamwork: Math.min(5, Math.max(1, Number(ratings?.teamwork) || 4)),
      problemSolving: Math.min(5, Math.max(1, Number(ratings?.problemSolving) || 4)),
      punctuality: Math.min(5, Math.max(1, Number(ratings?.punctuality) || 4)),
    };

    const calculatedOverall =
      overallRating !== undefined
        ? Math.min(5, Math.max(1, Number(overallRating)))
        : Number(
            (
              (safeRatings.productivity +
                safeRatings.qualityOfWork +
                safeRatings.communication +
                safeRatings.teamwork +
                safeRatings.problemSolving +
                safeRatings.punctuality) /
              6
            ).toFixed(2)
          );

    const reviewerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || 'HR Manager';

    const review = await PerformanceReview.create({
      user: userId,
      reviewer: req.user.userId,
      reviewerName,
      reviewCycle: reviewCycle || 'Q1 2026',
      reviewPeriod: reviewPeriod || 'Jan 2026 - Mar 2026',
      ratings: safeRatings,
      overallRating: calculatedOverall,
      strengths: strengths || '',
      areasForImprovement: areasForImprovement || '',
      hrComments: hrComments || '',
      managerFeedback: managerFeedback || '',
      status: status || 'Completed',
      reviewDate: new Date(),
      goals: Array.isArray(goals) ? goals : [],
    });

    const populated = await PerformanceReview.findById(review._id)
      .populate('user', 'firstName lastName email department designation')
      .populate('reviewer', 'firstName lastName email');

    res.status(201).json(createdResponse(populated, 'Performance review created successfully'));
  }),

  // 4. Get a single review
  get: asyncHandler(async (req, res) => {
    const review = await PerformanceReview.findById(req.params.id)
      .populate('user', 'firstName lastName email department designation personalInfo jobDetails')
      .populate('reviewer', 'firstName lastName email');

    if (!review) {
      throw createNotFoundError('Performance review not found');
    }

    if (!isHrOrAdmin(req.user) && String(review.user._id) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }

    res.json(successResponse(review, 'Performance review retrieved'));
  }),

  // 5. Update a review
  update: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied');
    }

    const existing = await PerformanceReview.findById(req.params.id);
    if (!existing) {
      throw createNotFoundError('Performance review not found');
    }

    const {
      reviewCycle,
      reviewPeriod,
      ratings,
      overallRating,
      strengths,
      areasForImprovement,
      hrComments,
      managerFeedback,
      status,
      goals,
    } = req.body;

    if (reviewCycle !== undefined) existing.reviewCycle = reviewCycle;
    if (reviewPeriod !== undefined) existing.reviewPeriod = reviewPeriod;
    if (strengths !== undefined) existing.strengths = strengths;
    if (areasForImprovement !== undefined) existing.areasForImprovement = areasForImprovement;
    if (hrComments !== undefined) existing.hrComments = hrComments;
    if (managerFeedback !== undefined) existing.managerFeedback = managerFeedback;
    if (status !== undefined) existing.status = status;
    if (Array.isArray(goals)) existing.goals = goals;

    if (ratings) {
      existing.ratings = {
        productivity: Math.min(5, Math.max(1, Number(ratings.productivity) || existing.ratings.productivity)),
        qualityOfWork: Math.min(5, Math.max(1, Number(ratings.qualityOfWork) || existing.ratings.qualityOfWork)),
        communication: Math.min(5, Math.max(1, Number(ratings.communication) || existing.ratings.communication)),
        teamwork: Math.min(5, Math.max(1, Number(ratings.teamwork) || existing.ratings.teamwork)),
        problemSolving: Math.min(5, Math.max(1, Number(ratings.problemSolving) || existing.ratings.problemSolving)),
        punctuality: Math.min(5, Math.max(1, Number(ratings.punctuality) || existing.ratings.punctuality)),
      };
    }

    if (overallRating !== undefined) {
      existing.overallRating = Math.min(5, Math.max(1, Number(overallRating)));
    } else if (ratings) {
      existing.overallRating = Number(
        (
          (existing.ratings.productivity +
            existing.ratings.qualityOfWork +
            existing.ratings.communication +
            existing.ratings.teamwork +
            existing.ratings.problemSolving +
            existing.ratings.punctuality) /
          6
        ).toFixed(2)
      );
    }

    await existing.save();

    const updated = await PerformanceReview.findById(existing._id)
      .populate('user', 'firstName lastName email department designation')
      .populate('reviewer', 'firstName lastName email');

    res.json(successResponse(updated, 'Performance review updated'));
  }),

  // 6. Delete a review
  delete: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied');
    }

    const review = await PerformanceReview.findByIdAndDelete(req.params.id);
    if (!review) {
      throw createNotFoundError('Performance review not found');
    }

    res.json(successResponse({ id: req.params.id }, 'Performance review deleted'));
  }),

  // 7. Add a goal to an employee's review or record
  addGoal: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) {
      throw createForbiddenError('Access denied');
    }

    const { reviewId, userId, title, description, target, deadline, priority } = req.body;
    if (!title) throw createValidationError('Goal title is required');

    let review = null;
    if (reviewId) {
      review = await PerformanceReview.findById(reviewId);
    } else if (userId) {
      review = await PerformanceReview.findOne({ user: userId }).sort({ createdAt: -1 });
      if (!review) {
        review = await PerformanceReview.create({
          user: userId,
          reviewer: req.user.userId,
          reviewerName: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'HR Manager',
          reviewCycle: 'Q1 2026',
          status: 'In Review',
        });
      }
    }

    if (!review) throw createNotFoundError('Review record not found');

    review.goals.push({
      title,
      description: description || '',
      target: target || '',
      progress: 0,
      deadline: deadline ? new Date(deadline) : null,
      priority: priority || 'Medium',
      status: 'In Progress',
    });

    await review.save();
    res.status(201).json(createdResponse(review, 'Goal added successfully'));
  }),

  // 8. Update goal progress/status
  updateGoal: asyncHandler(async (req, res) => {
    const { reviewId, goalId } = req.params;
    const { progress, status, title, description, deadline, priority } = req.body;

    const review = await PerformanceReview.findById(reviewId);
    if (!review) throw createNotFoundError('Performance review not found');

    if (!isHrOrAdmin(req.user) && String(review.user) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }

    const goal = review.goals.id(goalId);
    if (!goal) throw createNotFoundError('Goal not found');

    if (progress !== undefined) {
      goal.progress = Math.min(100, Math.max(0, Number(progress)));
      if (goal.progress === 100) goal.status = 'Completed';
    }
    if (status !== undefined) {
      goal.status = status;
      if (status === 'Completed' && goal.progress < 100) goal.progress = 100;
    }
    if (title !== undefined) goal.title = title;
    if (description !== undefined) goal.description = description;
    if (deadline !== undefined) goal.deadline = deadline ? new Date(deadline) : null;
    if (priority !== undefined) goal.priority = priority;

    await review.save();
    res.json(successResponse(review, 'Goal updated successfully'));
  }),
};
