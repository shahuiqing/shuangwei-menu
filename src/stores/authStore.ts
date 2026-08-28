import { create } from 'zustand';
import { safeGetItem, safeSetItem } from '../utils/storage';

interface AuthState {
  isAdminAuthed: boolean;
  isDeviceAuthed: boolean;
  deviceName: string | null;
  loginAdmin: (input:string, realPassword:string)=>boolean;
  loginDevice: (input:string, devicePasswords:{name:string;password:string}[])=> {ok:boolean; name?:string};
  logout: ()=>void;
}

export const useAuthStore = create<AuthState>((set)=>({
  isAdminAuthed: false,
  isDeviceAuthed: (()=>{ const tok=safeGetItem('deviceAuthToken'); const exp=safeGetItem('deviceAuthTokenExpiry'); return !!(tok && exp && Date.now()<parseInt(exp,10)); })(),
  deviceName: null,
  loginAdmin: (input, real)=>{
    if(input===real){ set({isAdminAuthed:true}); return true; }
    return false;
  },
  loginDevice: (input, list)=>{
    const matched=list.find(d=>d.password===input);
    if(matched){
      safeSetItem('deviceAuthToken', matched.password);
      safeSetItem('deviceAuthTokenExpiry', String(Date.now()+432000000));
      set({ isDeviceAuthed:true, deviceName: matched.name });
      return { ok:true, name: matched.name };
    }
    return { ok:false };
  },
  logout: ()=> set({ isAdminAuthed:false })
}));
