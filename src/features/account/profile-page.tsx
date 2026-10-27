import { useRef, useState } from 'react'
import { ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FormError } from '@/components/form/field'
import { PasswordInput } from '@/components/form/password-input'
import { ErrorState, errorMessage } from '@/components/feedback/error-state'
import { changePasswordSchema, profileUpdateSchema, type ChangePasswordRequest, type ProfileUpdate, type User } from '@/contracts/account'
import { useZodForm } from '@/lib/use-zod-form'
import { useChangePassword, useProfile, useUpdateAvatar, useUpdateProfile } from './use-account'

const MAX_AVATAR_BYTES = 512 * 1024

/** Reduz a imagem para 256px (JPEG) antes do envio, mantendo o payload pequeno. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function ProfilePage() {
  const profile = useProfile()
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
  if (!profile.data) {
    return (
      <div className="grid gap-6 sm:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-16 rounded-sm" />
        ))}
      </div>
    )
  }
  return <ProfileForms user={profile.data} />
}

function ProfileForms({ user }: { user: User }) {
  const update = useUpdateProfile()
  const avatar = useUpdateAvatar()
  const password = useChangePassword()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const profileForm = useZodForm<ProfileUpdate>(profileUpdateSchema, {
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName ?? '',
    walletNickname: user.walletNickname ?? '',
  })
  const passwordForm = useZodForm<ChangePasswordRequest>(
    changePasswordSchema,
    { currentPassword: '', newPassword: '', confirmPassword: '' },
    { formId: profileForm.formProps.id },
  )
  const wantsPasswordChange = Object.values(passwordForm.values).some(Boolean)

  const onSave = profileForm.handleSubmit((data) => {
    update.mutate(data, { onError: profileForm.applyServerError })
    if (wantsPasswordChange) {
      passwordForm.handleSubmit((pw) =>
        password.mutate(pw, {
          onSuccess: () => passwordForm.reset(),
          onError: passwordForm.applyServerError,
        }),
      )({ preventDefault() {} } as React.FormEvent)
    }
  })

  const onAvatar = async (file: File | undefined) => {
    setAvatarError(null)
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setAvatarError('Use uma imagem PNG, JPEG ou WebP.')
    if (file.size > MAX_AVATAR_BYTES * 8) return setAvatarError('A imagem deve ter no máximo 4 MB.')
    try {
      const dataUrl = await toAvatarDataUrl(file)
      avatar.mutate({ dataUrl }, { onError: (e) => setAvatarError(errorMessage(e)) })
    } catch {
      setAvatarError('Não foi possível ler a imagem.')
    }
  }

  return (
    <form
      {...profileForm.formProps}
      noValidate onSubmit={onSave} aria-labelledby="profile-title" className="space-y-8">
      <h1 id="profile-title" className="font-bold">Perfil do colecionador</h1>
      <FormError message={profileForm.errors.form} />
      <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
        <Field id="displayName" label="Nome de exibição" required error={profileForm.errors.displayName}>
          <Input {...profileForm.fieldProps('displayName')} autoComplete="name" />
        </Field>
        <Field id="username" label="Nome de usuário" required error={profileForm.errors.username}>
          <Input {...profileForm.fieldProps('username')} autoComplete="username" />
        </Field>
        <Field id="email" label="E-mail" required error={profileForm.errors.email}>
          <Input {...profileForm.fieldProps('email')} type="email" autoComplete="email" />
        </Field>
        <Field id="ensName" label="Nome ENS" required error={profileForm.errors.ensName}>
          <div className="flex gap-2">
            <span className="grid h-10 place-items-center rounded-sm border border-input px-3 text-sm" aria-hidden>.eth</span>
            <Input {...profileForm.fieldProps('ensName')} />
          </div>
        </Field>
        <Field id="walletNickname" label="Apelido da carteira" required error={profileForm.errors.walletNickname}>
          <Input {...profileForm.fieldProps('walletNickname')} />
        </Field>
        <div className="flex flex-col gap-2">
          <span id="avatar-label" className="text-sm">Avatar</span>
          <div className="flex items-center gap-6">
            <span className="grid size-[50px] place-items-center overflow-hidden rounded-full border border-border bg-surface-2">
              {user.avatarUrl ? <img src={user.avatarUrl} alt="Seu avatar" className="size-full object-cover" /> : <ImageIcon className="size-6 text-primary" aria-label="Sem avatar" />}
            </span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-labelledby="avatar-label" onChange={(e) => (onAvatar(e.target.files?.[0]), (e.target.value = ''))} tabIndex={-1} />
            <Button type="button" className="w-[98px]" onClick={() => fileRef.current?.click()} disabled={avatar.isPending} aria-describedby={avatarError ? 'avatar-error' : undefined}>
              {avatar.isPending ? <Loader2 className="size-4 animate-spin" aria-label="Enviando" /> : 'Alterar'}
            </Button>
            <Button type="button" variant="ghost" disabled={!user.avatarUrl || avatar.isPending} onClick={() => avatar.mutate({ dataUrl: null })}>
              Remover
            </Button>
          </div>
          {avatarError && <p id="avatar-error" role="alert" className="text-xs text-destructive">{avatarError}</p>}
        </div>
      </div>

      <fieldset className="space-y-5 sm:max-w-[417px]">
        <legend className="mb-4 font-bold">Alterar senha</legend>
        <FormError message={passwordForm.errors.form} />
        <Field id="currentPassword" label="Senha atual" error={passwordForm.errors.currentPassword}>
          <PasswordInput {...passwordForm.fieldProps('currentPassword')} autoComplete="current-password" />
        </Field>
        <Field id="newPassword" label="Nova senha" error={passwordForm.errors.newPassword} hint="Mínimo de 8 caracteres, com letras e números.">
          <PasswordInput {...passwordForm.fieldProps('newPassword')} autoComplete="new-password" />
        </Field>
        <Field id="confirmPassword" label="Confirmar nova senha" error={passwordForm.errors.confirmPassword}>
          <PasswordInput {...passwordForm.fieldProps('confirmPassword')} autoComplete="new-password" />
        </Field>
      </fieldset>

      <Button type="submit" className="h-10 w-[131px]" disabled={update.isPending || password.isPending}>
        {update.isPending || password.isPending ? <Loader2 className="size-4 animate-spin" aria-label="Salvando" /> : 'Salvar'}
      </Button>
    </form>
  )
}

