import {integer, sqliteTable, text, index, uniqueIndex} from 'drizzle-orm/sqlite-core';
export const materials=sqliteTable('materials',{
 id:text('id').primaryKey(),name:text('name').notNull(),notes:text('notes').notNull().default(''),variants:text('variants').notNull().default('[]'),version:integer('version').notNull().default(1),archived:integer('archived').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('materials_name_unique').on(t.name),index('materials_active').on(t.archived,t.name)]);
export const tasks=sqliteTable('tasks',{
 id:text('id').primaryKey(),name:text('name').notNull(),scenes:text('scenes').notNull().default('[]'),materialIds:text('material_ids').notNull().default('[]'),notes:text('notes').notNull().default(''),status:text('status').notNull().default('待整理'),sourceEn:text('source_en').notNull().default(''),sourceRow:integer('source_row'),version:integer('version').notNull().default(1),archived:integer('archived').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[index('tasks_active_status').on(t.archived,t.status),index('tasks_updated').on(t.updatedAt)]);
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const actions=sqliteTable('actions',{
 id:text('id').primaryKey(),name:text('name').notNull(),materialIds:text('material_ids').notNull().default('[]'),notes:text('notes').notNull().default(''),version:integer('version').notNull().default(1),archived:integer('archived').notNull().default(0),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
},t=>[uniqueIndex('actions_name_unique').on(t.name),index('actions_active').on(t.archived,t.name)]);
export const editorIdentities=sqliteTable('editor_identities',{email:text('email').primaryKey(),userId:text('user_id').notNull(),createdAt:text('created_at').notNull()});
