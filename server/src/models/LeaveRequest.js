import mongoose from 'mongoose';
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},type:{type:String,enum:['Casual','Sick','Annual','Unpaid','Other'],required:true},startDate:{type:Date,required:true},endDate:{type:Date,required:true},reason:{type:String,required:true,trim:true},status:{type:String,enum:['Pending','Approved','Rejected'],default:'Pending'},reviewNote:{type:String,trim:true,default:''}},{timestamps:true});
export default mongoose.models.LeaveRequest||mongoose.model('LeaveRequest',schema,'leaverequests');
