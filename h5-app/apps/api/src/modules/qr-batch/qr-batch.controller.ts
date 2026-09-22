import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { QrBatchService } from './qr-batch.service';

@Controller('admin')
@ApiTags('admin')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class QrBatchController {
  constructor(private readonly svc: QrBatchService) {}

  @Post('qr-batch')
  @ApiOperation({ summary: 'Trigger a batch QR generation task' })
  async trigger(
    @Body() body: { batchId: string; quantity?: number },
    @CurrentUser() user: AuthUser,
  ) {
    const task = await this.svc.trigger(body, user.sub);
    return { ok: true, task };
  }

  @Get('qr-batch')
  @ApiOperation({ summary: 'List QR batch generation tasks' })
  async list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return {
      ok: true,
      ...await this.svc.list({
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    };
  }

  @Get('qr-batch/:id')
  @ApiOperation({ summary: 'Get QR batch task detail' })
  async get(@Param('id') id: string) {
    return { ok: true, task: await this.svc.get(id) };
  }

  @Get('qr-batch/:id/download')
  @ApiOperation({ summary: 'Download ZIP of generated PNGs' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { stream, filename, batch } = await this.svc.getZipStream(id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('X-Qr-Batch-Id', batch.id);
    res.setHeader('X-Qr-Batch-Status', batch.status);
    (stream as any).pipe(res);
  }

  @Post('qr/:qrId/revoke')
  @ApiOperation({ summary: 'Revoke a single QR (set revoked=1)' })
  async revoke(@Param('qrId') qrId: string, @CurrentUser() user: AuthUser) {
    return await this.svc.revokeQr(qrId, user.sub);
  }

  @Get('qr/revoked')
  @ApiOperation({ summary: 'List revoked QRs' })
  async listRevoked(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return {
      ok: true,
      ...await this.svc.listRevoked({
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      }),
    };
  }
}