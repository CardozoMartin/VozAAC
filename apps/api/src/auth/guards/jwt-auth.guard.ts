import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Exige un Bearer token válido. Deja al cuidador en `request.user`. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
