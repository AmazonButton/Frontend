import { Body, Controller, Delete, HttpCode, Inject, Post, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { UnregisterFcmTokenDto } from './dto/unregister-fcm-token.dto';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Post('fcm-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Dang ky hoac cap nhat FCM Token cho thiet bi nguoi dung' })
  @ApiResponse({ status: 200, description: 'Dang ky FCM token thanh cong' })
  async registerFcmToken(@Request() req: any, @Body(new ValidationPipe({ transform: true, whitelist: true, expectedType: RegisterFcmTokenDto })) dto: RegisterFcmTokenDto) {
    const userId = req.user?.id || req.user?.userId;
    return this.notificationsService.registerFcmToken(userId, dto);
  }

  @Delete('fcm-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Huy dang ky FCM Token (vo hieu hoa khi logout hoac tat thong bao)' })
  @ApiResponse({ status: 200, description: 'Huy FCM token thanh cong' })
  async unregisterFcmToken(@Request() req: any, @Body(new ValidationPipe({ transform: true, whitelist: true, expectedType: UnregisterFcmTokenDto })) dto: UnregisterFcmTokenDto) {
    const userId = req.user?.id || req.user?.userId;
    return this.notificationsService.unregisterFcmToken(userId, dto.token);
  }

  @Post('device-warning')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin gui canh bao van de / bao hanh toi tai khoan dang dung nut' })
  async sendDeviceWarrantyWarning(
    @Body() body: { deviceId: string; faultGroup?: string; faultCode?: string; title?: string; message?: string },
  ) {
    return this.notificationsService.sendDeviceWarrantyWarning(body);
  }
}
