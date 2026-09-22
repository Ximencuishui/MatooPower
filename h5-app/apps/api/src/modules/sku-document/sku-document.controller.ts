import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, Public } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkuDocumentService } from './sku-document.service';
import { DOC_LANGS, DOC_TYPES, DocLang, DocType } from '../storage/dto/upload.dto';
import { toCsv, CSV_BOM } from '../../common/util/csv';

@Controller('admin/sku-document')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SkuDocumentController {
  constructor(private readonly svc: SkuDocumentService) {}

  @Get()
  @ApiOperation({ summary: 'List SKU documents (filter + paginated)' })
  async list(
    @Query('skuId') skuId?: string,
    @Query('type') type?: string,
    @Query('lang') lang?: string,
    @Query('includeDeprecated') includeDeprecated?: string,
    @Query('q') _q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return {
      ok: true,
      ...await this.svc.list({
        skuId,
        type: type as DocType | undefined,
        lang: lang as DocLang | undefined,
        includeDeprecated: includeDeprecated === 'true',
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one document metadata' })
  async get(@Param('id') id: string) {
    return { ok: true, document: await this.svc.get(id) };
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document (multipart/form-data: file + type + lang + version + title)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB 上限(视频)
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { type: DocType; lang: DocLang; version: string; title: string; skuId: string; batchId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('缺少 file 字段');
    if (!body.skuId) throw new BadRequestException('缺少 skuId');
    if (!DOC_TYPES.includes(body.type)) throw new BadRequestException(`type 必须为 ${DOC_TYPES.join('/')}`);
    if (!DOC_LANGS.includes(body.lang)) throw new BadRequestException(`lang 必须为 ${DOC_LANGS.join('/')}`);
    if (!body.version || !/^v\d+(\.\d+)?$/.test(body.version)) {
      throw new BadRequestException('version 格式: v1 / v1.0 / v2.3');
    }
    if (!body.title) throw new BadRequestException('缺少 title');

    const doc = await this.svc.upload({
      skuId: body.skuId,
      type: body.type,
      lang: body.lang,
      version: body.version,
      title: body.title,
      batchId: body.batchId || null,
      fileBuffer: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
    }, user.sub);
    return { ok: true, document: doc };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (deprecate) a document' })
  async deprecate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { ok: true, document: await this.svc.deprecate(id, user.sub) };
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download original file (admin, audited)' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { doc, buffer } = await this.svc.readFile(id);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader('Content-Length', doc.sizeBytes.toString());
    res.send(buffer);
  }
}

/**
 * 公开端点：扫码页拿文档（无 JWT）
 * GET /public/sku-document/:skuId/:type/:lang
 */
@Controller('public/sku-document')
@ApiTags('public')
export class PublicSkuDocumentController {
  constructor(private readonly svc: SkuDocumentService) {}

  @Public()
  @Get(':skuId/:type/:lang')
  @ApiOperation({ summary: 'Get current document for SKU+type+lang (public, no JWT)' })
  async get(
    @Param('skuId') skuId: string,
    @Param('type') type: string,
    @Param('lang') lang: string,
    @Res() res: Response,
  ) {
    if (!DOC_TYPES.includes(type as DocType)) throw new BadRequestException(`type ${type} 不支持`);
    if (!DOC_LANGS.includes(lang as DocLang)) throw new BadRequestException(`lang ${lang} 不支持`);

    const { doc, stream } = await this.svc.readPublic(skuId, type as DocType, lang as DocLang);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader('Content-Length', doc.sizeBytes.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600');
    (stream as any).pipe(res);
  }
}

/** admin CSV 导出（与其他 admin 端点保持一致风格） */
@Controller('admin/sku-document.csv')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SkuDocumentCsvController {
  constructor(private readonly svc: SkuDocumentService) {}

  @Get()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export documents as CSV' })
  async export(@Res() res: Response) {
    const result = await this.svc.list({ pageSize: 100 });
    const rows = result.items.map((d) => ({
      id: d.id, skuId: d.skuId, type: d.type, lang: d.lang, version: d.version,
      title: d.title, fileName: d.fileName, mimeType: d.mimeType, sizeBytes: d.sizeBytes,
      sha256: d.sha256.slice(0, 16), uploadedAt: d.uploadedAt, deprecatedAt: d.deprecatedAt ?? '',
    }));
    res.send(CSV_BOM + toCsv(rows, ['id', 'skuId', 'type', 'lang', 'version', 'title', 'fileName', 'mimeType', 'sizeBytes', 'sha256', 'uploadedAt', 'deprecatedAt']));
  }
}