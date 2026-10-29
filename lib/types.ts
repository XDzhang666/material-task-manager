export type Variant={id:string;label:string;key:string;thumbKey?:string};
export type Material={id:string;name:string;notes:string;variants:Variant[];version:number;archived:number;updatedAt:string;taskCount?:number};
export type Task={id:string;name:string;scenes:string[];materialIds:string[];materialNames?:string[];notes:string;status:string;sourceEn:string;sourceRow:number|null;version:number;archived:number;updatedAt:string};
export const SCENES=['居家 / 卧室','居家 / 厨房与用餐','居家 / 卫生间','居家 / 书房','居家 / 梳妆区','物流 / 传送带','物流 / 仓储货架','餐饮 / 奶茶制作区','餐饮 / 咖啡制作区','购物 / 包装食品','购物 / 果蔬','购物 / 收银与打包','实验室','图书馆'];
export const STATUSES=['待整理','待采集','采集中','已完成'];
