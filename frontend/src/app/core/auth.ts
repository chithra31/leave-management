import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Api, Role, User } from './api';

const TOKEN_KEY = 'lm_token';
const USER_KEY = 'lm_user';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);

  readonly user = signal<User | null>(read<User>(USER_KEY));
  readonly isLoggedIn = computed(() => this.user() !== null);

  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  login(email: string, password: string) {
    return new Promise<void>((resolve, reject) => {
      this.api.login(email, password).subscribe({
        next: (res) => {
          localStorage.setItem(TOKEN_KEY, res.accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          this.user.set(res.user);
          resolve();
        },
        error: reject,
      });
    });
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.router.navigateByUrl('/login');
  }

  homeFor(role: Role): string {
    return role === 'manager' ? '/approvals' : role === 'admin' ? '/admin' : '/my-leave';
  }
}

/** Adds the JWT to every API request; a 401 means the session expired, so sign out. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const token = auth.token;
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      // A 401 on any call except login itself means the token expired.
      if (err.status === 401 && !req.url.endsWith('/auth/login')) auth.logout();
      return throwError(() => err);
    }),
  );
};

/** Route guard: must be logged in, and the user's role must be listed in route data `roles`. */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const user = auth.user();
  if (!user) return router.parseUrl('/login');
  const roles = route.data['roles'] as Role[] | undefined;
  if (roles && !roles.includes(user.role)) return router.parseUrl(auth.homeFor(user.role));
  return true;
};
