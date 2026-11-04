import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities';
import { AuthUser, CurrentUser, Public } from './auth.decorators';
import { AuthService } from './auth.service';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const u = await this.users.findOneByOrFail({ id: user.id });
    return { id: u.id, name: u.name, email: u.email, role: u.role, managerId: u.managerId };
  }
}
