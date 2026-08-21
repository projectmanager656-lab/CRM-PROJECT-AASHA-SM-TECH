import mongoose from 'mongoose';
const schema=new mongoose.Schema({owner:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},name:{type:String,required:true,trim:true},storedName:{type:String,required:true},mimeType:{type:String,required:true},size:{type:Number,required:true},description:{type:String,trim:true,default:''}},{timestamps:true});
export default mongoose.models.Document||mongoose.model('Document',schema,'documents');
