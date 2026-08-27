import { apiError } from "../../../lib/supabase-server";
import { POST as createJob } from "./jobs/route";

export async function POST(request:Request){const body=await request.json().catch(()=>({})) as {garmentIds?:string[];referencePhotoId?:string;personImageUrl?:string;mirrorImageUrl?:string};if(body.personImageUrl||body.mirrorImageUrl)return apiError("CLIENT_URL_REJECTED","Private previews accept owned garment and reference-photo IDs only.",400);const forwarded=new Request(new URL("/api/try-on/jobs",request.url),{method:"POST",headers:request.headers,body:JSON.stringify({garmentIds:body.garmentIds,referencePhotoId:body.referencePhotoId,mode:"mirror"})});return createJob(forwarded);}
