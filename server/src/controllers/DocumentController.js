import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import Document from '../models/Document.js';
import {createForbiddenError,createNotFoundError,createValidationError} from '../utils/apiError.js';
import {createdResponse,successResponse} from '../utils/apiResponse.js';
import {asyncHandler} from '../utils/asyncHandler.js';
const uploadRoot=path.resolve('uploads/documents');
const getOwned=async(id,user)=>{if(!mongoose.Types.ObjectId.isValid(id))throw createValidationError('Invalid document id');const doc=await Document.findById(id);if(!doc)throw createNotFoundError('Document not found');if(user.role==='employee'&&String(doc.owner)!==String(user.userId))throw createForbiddenError('Access denied');return doc;};
export const DocumentController={
 upload:asyncHandler(async(req,res)=>{if(!req.file)throw createValidationError('A document file is required');const owner=req.user.role==='employee'?req.user.userId:req.body.owner;if(!owner)throw createValidationError('Assigned employee is required');const doc=await Document.create({owner,name:req.file.originalname,storedName:req.file.filename,mimeType:req.file.mimetype,size:req.file.size,description:req.body.description||''});res.status(201).json(createdResponse(doc,'Document uploaded'));}),
 list:asyncHandler(async(req,res)=>res.json(successResponse(await Document.find(req.user.role==='employee'?{owner:req.user.userId}:{}).populate('owner','firstName lastName email').sort({createdAt:-1}),'Documents retrieved'))),
 get:asyncHandler(async(req,res)=>res.json(successResponse(await getOwned(req.params.id,req.user),'Document retrieved'))),
 download:asyncHandler(async(req,res)=>{const doc=await getOwned(req.params.id,req.user);res.type(doc.mimeType);res.setHeader('Content-Disposition',`${req.query.download==='1'?'attachment':'inline'}; filename="${doc.name.replace(/["\r\n]/g,'')}"`);res.sendFile(path.join(uploadRoot,doc.storedName));}),
 remove:asyncHandler(async(req,res)=>{const doc=await getOwned(req.params.id,req.user);await fs.unlink(path.join(uploadRoot,doc.storedName)).catch(error=>{if(error.code!=='ENOENT')throw error;});await doc.deleteOne();res.json(successResponse({id:req.params.id},'Document deleted'));}),
};
