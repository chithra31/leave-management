import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../core/api';
import { Auth } from '../core/auth';

@Component({
  imports: [FormsModule],
  template: `
    <section class="card login">
      <h1>Sign in</h1>
      <form (ngSubmit)="submit()">
        <label>Email <input name="email" type="email" [(ngModel)]="email" required autocomplete="username" /></label>
        <label>Password <input name="password" type="password" [(ngModel)]="password" required autocomplete="current-password" /></label>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button class="primary" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
      </form>
      <details>
        <summary>Demo accounts (password <code>Password123!</code>)</summary>
        <ul>
          <li><button type="button" class="link" (click)="fill('liam@company.test')">liam@company.test</button> employee</li>
          <li><button type="button" class="link" (click)="fill('maria@company.test')">maria@company.test</button> manager</li>
          <li><button type="button" class="link" (click)="fill('admin@company.test')">admin@company.test</button> admin</li>
        </ul>
      </details>
    </section>
  `,
})
export class Login {
  private auth = inject(Auth);
  private router = inject(Router);

  email = '';
  password = '';
  readonly error = signal('');
  readonly busy = signal(false);

  fill(email: string) {
    this.email = email;
    this.password = 'Password123!';
  }

  async submit() {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigateByUrl(this.auth.homeFor(this.auth.user()!.role));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
