// v1.5 #P1-1:StorageService 公开 POST /storage/upload 端点
// - H5 activate 表单拍照后先调本端点拿到 invoicePhotoUrl,再带 URL 进 ActivateWarrantyDto
// - 单文件 ≤5MB,支持 image/jpeg | image/png | image/webp | image/heic
// - 仅登录后任意角色可调用(发票照片属于售后凭证)
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomBytes } from 'node:crypto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { StorageService } from '../storage.service';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_BYTES = 5 * 1024 * 1024;

@Controller('storage')
@ApiTags('storage')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('customer', 'dealer', 'admin', 'support')
export class StorageUploadController {
  constructor(private readonly storage: StorageService) {}

  /**
   * multipart/form-data: file=<binary>, purpose='invoice' | 'general'
   * 返回 { ok, url, mimeType, sizeBytes }
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload arbitrary image (5MB max) and get a public URL' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: { type: 'string', enum: ['invoice', 'general', 'avatar'] },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES },
    }),
  )
  async upload(
    @CurrentUser() _user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { purpose?: 'invoice' | 'general' | 'avatar' },
  ) {
    if (!file) throw new BadRequestException('缺少 file 字段');
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException(`不支持的 MIME ${file.mimetype}(仅 ${[...ALLOWED_MIMES].join(',')})`);
    }
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const key = `uploads/${body.purpose ?? 'general'}/${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
    await this.storage.put(key, file.buffer, { mimeType: file.mimetype });
    return {
      ok: true,
      url: this.storage.getPublicUrl(key),
      storageKey: key,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }
}
