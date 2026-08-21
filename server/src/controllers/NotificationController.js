import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import {createForbiddenError,createNotFoundError,createValidationError} from '../utils/apiError.js';
import {createdResponse,successResponse} from '../utils/apiResponse.js';
import {asyncHandler} from '../utils/asyncHandler.js';
const getOwned=async(id,user)=>{if(!mongoose.Types.ObjectId.isValid(id))throw createValidationError('Invalid notification id');const item=await Notification.findById(id);if(!item)throw createNotFoundError('Notification not found');if(user.role==='employee'&&String(item.recipient)!==String(user.userId))throw createForbiddenError('Access denied');return item;};
export const NotificationController={
 create:asyncHandler(async(req,res)=>{if(req.user.role==='employee')throw createForbiddenError('Only administrators can create notifications');const{recipient,title,message,type}=req.body;if(!recipient||!title||!message)throw createValidationError('Recipient, title, and message are required');res.status(201).json(createdResponse(await Notification.create({recipient,title,message,type}),'Notification created'));}),
 list:asyncHandler(async(req,res)=>res.json(successResponse(await Notification.find(req.user.role==='employee'?{recipient:req.user.userId}:{}).populate('recipient','firstName lastName email').sort({createdAt:-1}),'Notifications retrieved'))),
 get:asyncHandler(async(req,res)=>res.json(successResponse(await getOwned(req.params.id,req.user),'Notification retrieved'))),
 read:asyncHandler(async(req,res)=>{const item=await getOwned(req.params.id,req.user);item.isRead=req.body.isRead!==false;await item.save();res.json(successResponse(item,'Notification state updated'));}),
 readAll:asyncHandler(async(req,res)=>{await Notification.updateMany(req.user.role==='employee'?{recipient:req.user.userId}:{},{isRead:true});res.json(successResponse(null,'Notifications marked read'));}),
 remove:asyncHandler(async(req,res)=>{const item=await getOwned(req.params.id,req.user);await item.deleteOne();res.json(successResponse({id:req.params.id},'Notification deleted'));}),
};
