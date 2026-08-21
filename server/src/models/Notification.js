import mongoose from 'mongoose';
const schema=new mongoose.Schema({recipient:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},title:{type:String,required:true,trim:true},message:{type:String,required:true,trim:true},type:{type:String,enum:['Info','Success','Warning','Error'],default:'Info'},isRead:{type:Boolean,default:false}},{timestamps:true});
export default mongoose.models.Notification||mongoose.model('Notification',schema,'notifications');
