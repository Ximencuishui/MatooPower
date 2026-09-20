import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BindDeviceDto } from './dto/bind-device.dto';
import { DeviceService } from './device.service';

@Controller('device')
@ApiTags('device')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
export class DeviceController {
  constructor(private readonly svc: DeviceService) {}

  /** 绑定设备 */
  @Post('bind')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bind a device (one SKU per user)' })
  async bind(@CurrentUser() user: AuthUser, @Body() body: BindDeviceDto) {
    const dev = await this.svc.bind(user.sub, body);
    return { ok: true, device: dev };
  }

  /** 我的设备列表 */
  @Get('mine')
  @ApiOperation({ summary: 'List my devices' })
  async listMine(@CurrentUser() user: AuthUser) {
    const items = await this.svc.listMine(user.sub);
    return { ok: true, items };
  }

  /** 健康板（mock + 趋势） */
  @Get(':id/health')
  @ApiOperation({ summary: 'Get device health snapshot (mock + 72-point trend)' })
  async health(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const snap = await this.svc.getHealth(id, user.sub);
    return { ok: true, ...snap };
  }

  /** 远程诊断（mock） */
  @Post(':id/diagnostics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger remote diagnostics (analyzes SOH / cycles / temp / alarms)' })
  async diagnostics(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const result = this.svc.triggerDiagnostics(id, user.sub);
    return { ok: true, ...result };
  }
}