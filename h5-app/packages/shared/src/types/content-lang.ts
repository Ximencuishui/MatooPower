// 内容多语言代码统一常量(商品资料 / 图片 / 文档共用)
// - 数据库列 lang 的合法值,前后端共享唯一来源
// - 新增语言时:仅需修改本文件 + 数据库迁移(更新 lang 约束)
export const CONTENT_LANGS = ['zh', 'en', 'bn', 'hi', 'ur'] as const;
export type ContentLang = (typeof CONTENT_LANGS)[number];

/** DOC_LANGS 别名(向后兼容,内部仍用 CONTENT_LANGS) */
export const DOC_LANGS = CONTENT_LANGS;
export type DocLang = ContentLang;

/** SKU 详情图片多语言代码(SKU_IMAGE_LANGS 别名) */
export const SKU_IMAGE_LANGS = CONTENT_LANGS;
export type SkuImageLang = ContentLang;