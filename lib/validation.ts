import {z} from 'zod';
import {SCENES,STATUSES} from './types';
const clean=z.string().trim();
const imageKey=z.string().regex(/^uploads\/[a-f0-9-]+\.(?:png|jpg|webp)$/);
export const materialInput=z.object({name:clean.min(1).max(100),notes:clean.max(3000).default(''),variants:z.array(z.object({id:z.string().min(1).max(80),label:clean.max(100),key:imageKey,thumbKey:imageKey.optional()})).max(100).default([]),version:z.number().int().positive().optional()});
export const taskInput=z.object({name:clean.min(1).max(200),scenes:z.array(z.string().refine(v=>SCENES.includes(v),'请选择现有场景')).max(14).default([]),materialIds:z.array(z.string().min(1).max(80)).max(80).default([]),notes:clean.max(5000).default(''),status:z.string().refine(v=>STATUSES.includes(v)).default('待整理'),version:z.number().int().positive().optional()});
export function permission(email:string|undefined,owner:string|undefined,editors:string|undefined){if(!email)return false;return [owner||'',...(editors||'').split(',')].map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());}
export function csvEscape(v:unknown){const s=String(v??'');return '"'+(/^[=+@\-\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}
