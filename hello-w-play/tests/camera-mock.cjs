// Browser addInitScript fixture. Never requests a real camera.
module.exports=function cameraMock(){
  HTMLMediaElement.prototype.play=async function(){};
  window.cameraTest={calls:0,pending:[],tracks:[],mode:'defer'};
  const getUserMedia=()=>{const t=window.cameraTest;t.calls++;return new Promise((resolve,reject)=>{const request={resolve:()=>{const stream=new MediaStream();const track={stopped:0,stop(){this.stopped++}};t.tracks.push(track);stream.getTracks=()=>[track];resolve(stream)},reject:()=>reject(new DOMException('Permission denied','NotAllowedError'))};if(t.mode==='deny')request.reject();else t.pending.push(request)})};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
};
