import { ImageResponse } from "next/og";

export const size={width:48,height:48};
export const contentType="image/png";
export const dynamic="force-static";

export default function Icon() {
  return new ImageResponse(<div style={{height:"100%",width:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"#111116",borderRadius:12}}>
    {[13,22,13].map((width,index)=><span key={index} style={{display:"block",height:4,width,borderRadius:4,background:"white",transform:`translateX(${index===0?3:index===2?-3:0}px) rotate(-30deg)`}}/>)}
  </div>,size);
}
