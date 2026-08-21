import mongoose from 'mongoose';
const locationSchema = { latitude: Number, longitude: Number, status: { type: String, default: 'Not checked' }, timestamp: Date };
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},date:{type:String,required:true},checkIn:{type:Date,required:true},checkOut:{type:Date,default:null},status:{type:String,enum:['Present','Late','Half Day','Absent'],default:'Present'},notes:{type:String,trim:true,default:''},checkInIp:{type:String,default:''},checkOutIp:{type:String,default:''},checkInLocation:locationSchema,checkOutLocation:locationSchema,checkInPhoto:{type:String,default:''},checkOutPhoto:{type:String,default:''},totalWorkingMinutes:{type:Number,default:0},requiredWorkingMinutes:{type:Number,default:480}},{timestamps:true});
schema.index({user:1,date:1},{unique:true});
export default mongoose.models.Attendance||mongoose.model('Attendance',schema,'attendance');
