// v1.4 P2-3:SKU 详情图片集 controller(仅 admin)
// - GET    /admin/sku-image?skuId=...&lang=...
// - POST   /admin/sku-image        (multipart/form-data)
// - PATCH  /admin/sku-image/:id    (元数据更新:alt/caption/sortOrder/isCover)
// - DELETE /admin/sku-image/:id    (软删除)
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { SkuImageService } from './sku-image.service';
import { DOC_LANGS, DocLang } from '../../storage/dto/upload.dto';

@Controller('admin/sku-image')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SkuImageController {
  constructor(private readonly svc: SkuImageService) {}

  @Get()
  @ApiOperation({ summary: 'List SKU images (filter by skuId + lang)' })
  async list(
    @Query('skuId') skuId?: string,
    @Query('lang') lang?: string,
    @Query('includeDeprecated') includeDeprecated?: string,
  ) {
    if (!skuId) throw new BadRequestException('skuId 必填');
    if (lang && !DOC_LANGS.includes(lang as DocLang)) {
      throw new BadRequestException(`lang 必须为 ${DOC_LANGS.join('/')}`);
    }
    return {
      ok: true,
      items: this.svc.list({
        skuId,
        lang: lang as DocLang | undefined,
        includeDeprecated: includeDeprecated === 'true',
      }),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a SKU image (multipart/form-data)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { skuId: string; lang: DocLang; alt?: string; caption?: string; isCover?: string },
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('缺少 file 字段');
    if (!body.skuId) throw new BadRequestException('缺少 skuId');
    if (!DOC_LANGS.includes(body.lang)) {
      throw new BadRequestException(`lang 必须为 ${DOC_LANGS.join('/')}`);
    }
    const image = await this.svc.upload({
      skuId: body.skuId,
      lang: body.lang,
      fileBuffer: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      alt: body.alt,
      caption: body.caption,
      isCover: body.isCover === 'true' || body.isCover === '1',
    }, user.sub);
    return { ok: true, image };
  }

  @Post('bulk')
  @HttpCode(207) // 207 Multi-Status: items + failures 混合返回
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk upload SKU images (≤5 per request, multipart/form-data)' })
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,  // 8MB / 文件
        files: 5,                    // 文件数上限(双层防御)
      },
    }),
  )
  async bulkUpload(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() body: { skuId: string; lang: DocLang },
    @CurrentUser() user: AuthUser,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('缺少 files 字段');
    // files.length > 5 在此处被 multer limits 限制为不会发生,但保留文案错误以防未来调整 limits
    if (!body.skuId) throw new BadRequestException('缺少 skuId');
    if (!DOC_LANGS.includes(body.lang)) {
      throw new BadRequestException(`lang 必须为 ${DOC_LANGS.join('/')}`);
    }
    const result = await this.svc.bulkUpload(
      files.map((f) => ({
        skuId: body.skuId,
        lang: body.lang,
        fileBuffer: f.buffer,
        fileName: f.originalname,
        mimeType: f.mimetype,
      })),
      user.sub,
    );
    return { ok: true, ...result };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update image metadata (alt / caption / sortOrder / isCover)' })
  async update(@Param('id') id: string, @Body() body: { alt?: string; caption?: string; sortOrder?: number; isCover?: boolean }) {
    return { ok: true, image: await this.svc.update(id, body) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-deprecate a SKU image' })
  async deprecate(@Param('id') id: string) {
    return { ok: true, image: await this.svc.deprecate(id) };
  }
}