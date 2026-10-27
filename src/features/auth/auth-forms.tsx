import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FormError } from '@/components/form/field'
import { PasswordInput } from '@/components/form/password-input'
import { FacebookColorIcon, GoogleIcon } from '@/components/icons/social'
import { loginRequestSchema, registerRequestSchema, type LoginRequest, type RegisterRequest } from '@/contracts/account'
import { useZodForm } from '@/lib/use-zod-form'
import { useLogin, useRegister } from './use-auth'

const inputClass = 'h-11 bg-surface-2/40 md:h-9 md:text-xs'

export function LoginForm({ onSuccess, defaultEmail = '' }: { onSuccess: () => void; defaultEmail?: string }) {
  const login = useLogin()
  const form = useZodForm<LoginRequest>(loginRequestSchema, { email: defaultEmail, password: '' })
  return (
    <form
      {...form.formProps}
      noValidate
      aria-label="Entrar"
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((data) => login.mutate(data, { onSuccess, onError: form.applyServerError }))}
    >
      <FormError message={form.errors.form} />
      <Field id="email" label="E-mail" error={form.errors.email} labelClassName="sr-only">
        <Input {...form.fieldProps('email')} type="email" autoComplete="email" placeholder="contato@email.com" className={inputClass} />
      </Field>
      <Field id="password" label="Senha" error={form.errors.password} labelClassName="sr-only">
        <PasswordInput {...form.fieldProps('password')} autoComplete="current-password" placeholder="Senha" className={inputClass} />
      </Field>
      <p className="-mt-1 text-right text-xs text-primary" title="Recuperação de senha não faz parte desta demonstração">
        <span aria-disabled="true" className="cursor-not-allowed opacity-80">
          Esqueceu a senha? <span className="sr-only">(indisponível nesta versão)</span>
        </span>
      </p>
      <Button type="submit" disabled={login.isPending} className="h-12 md:h-10">
        {login.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
      <SocialLogin />
    </form>
  )
}

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const register = useRegister()
  const form = useZodForm<RegisterRequest>(registerRequestSchema, { username: '', email: '', password: '', confirmPassword: '' })
  return (
    <form
      {...form.formProps}
      noValidate
      aria-label="Criar conta"
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((data) => register.mutate(data, { onSuccess, onError: form.applyServerError }))}
    >
      <FormError message={form.errors.form} />
      <Field id="username" label="Nome de usuário" error={form.errors.username} labelClassName="sr-only">
        <Input {...form.fieldProps('username')} autoComplete="username" placeholder="Nome de usuário" className={inputClass} />
      </Field>
      <Field id="email" label="E-mail" error={form.errors.email} labelClassName="sr-only">
        <Input {...form.fieldProps('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={inputClass} />
      </Field>
      <Field id="password" label="Senha" error={form.errors.password} hint="Mínimo de 8 caracteres, com letras e números." labelClassName="sr-only">
        <PasswordInput {...form.fieldProps('password')} autoComplete="new-password" placeholder="Senha" className={inputClass} />
      </Field>
      <Field id="confirmPassword" label="Confirmar senha" error={form.errors.confirmPassword} labelClassName="sr-only">
        <PasswordInput {...form.fieldProps('confirmPassword')} autoComplete="new-password" placeholder="Confirmar senha" className={inputClass} />
      </Field>
      <Button type="submit" disabled={register.isPending} className="h-12 md:h-10">
        {register.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {register.isPending ? 'Criando…' : 'Criar conta'}
      </Button>
      <SocialLogin />
    </form>
  )
}

/** Login social aparece no layout, mas não faz parte do escopo: botões desabilitados e explicados. */
function SocialLogin() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        Ou continue com
      </div>
      <p id="social-unavailable" className="sr-only">
        Login social indisponível nesta demonstração.
      </p>
      {[
        { label: 'Continuar com Google', Icon: GoogleIcon },
        { label: 'Continuar com Facebook', Icon: FacebookColorIcon },
      ].map(({ label, Icon }) => (
        <button
          key={label}
          type="button"
          disabled
          aria-describedby="social-unavailable"
          title="Indisponível nesta demonstração"
          className="flex h-10 items-center justify-center gap-3 rounded-sm border border-border text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
