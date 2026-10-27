import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormError } from '@/components/form/field'
import { ErrorState } from '@/components/feedback/error-state'
import { walletInputSchema, type Wallet, type WalletInput, type WalletSlot } from '@/contracts/account'
import { NETWORK_LABEL, NETWORKS, WALLET_PROVIDER_LABEL, WALLET_PROVIDERS, type Network, type WalletProvider } from '@/contracts/common'
import { useZodForm } from '@/lib/use-zod-form'
import { useProfile, useRemoveWallet, useSaveWallet, useWallets } from './use-account'

const empty = (email: string, displayName: string): WalletInput => ({
  displayName,
  nickname: '',
  network: 'ethereum',
  profileName: '',
  address: '',
  secondaryAddress: '',
  provider: 'metamask',
  referralCode: '',
  email,
  ensName: '',
})

const toInput = ({ id: _i, slot: _s, updatedAt: _u, ...rest }: Wallet): WalletInput => rest

export function WalletsPage({ redirect }: { redirect?: string }) {
  const wallets = useWallets()
  const profile = useProfile()
  const [secondaryOpen, setSecondaryOpen] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (wallets.isError) return <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} />
  if (!wallets.data || !profile.data) {
    return <div className="skeleton h-[520px] w-full rounded-sm" aria-busy="true" aria-label="Carregando carteiras" />
  }
  const { primary, secondary } = wallets.data
  const base = empty(profile.data.email, profile.data.displayName)

  return (
    <div className="space-y-12">
      <section aria-labelledby="primary-title">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="font-bold">Carteira principal</h1>
            <p className="mt-1 text-xs text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
        </header>
        <WalletForm key={primary?.updatedAt ?? 'new-primary'} slot="primary" initial={primary ? toInput(primary) : base} exists={Boolean(primary)} canRemove={!secondary} redirect={redirect} />
      </section>

      <section aria-labelledby="secondary-title">
        <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
          <h2 id="secondary-title" className="font-bold">Carteira secundária</h2>
          {!secondary && primary && !secondaryOpen && (
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={sameAsPrimary} onChange={(e) => setSameAsPrimary(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                Igual à carteira principal
              </label>
              <Button variant="link" className="h-auto px-0 text-base font-bold" onClick={() => setSecondaryOpen(true)}>
                Adicionar
              </Button>
            </div>
          )}
        </header>
        {secondary || secondaryOpen ? (
          <WalletForm
            key={secondary?.updatedAt ?? `new-secondary-${sameAsPrimary}`}
            slot="secondary"
            initial={secondary ? toInput(secondary) : sameAsPrimary && primary ? { ...toInput(primary), nickname: `${primary.nickname} (secundária)`, address: '' } : base}
            exists={Boolean(secondary)}
            canRemove
            onCancel={secondary ? undefined : () => setSecondaryOpen(false)}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {primary ? 'Você ainda não adicionou uma carteira secundária.' : 'Cadastre a carteira principal para adicionar uma secundária.'}
          </p>
        )}
      </section>
    </div>
  )
}

function WalletForm({
  slot,
  initial,
  exists,
  canRemove,
  onCancel,
  redirect,
}: {
  slot: WalletSlot
  initial: WalletInput
  exists: boolean
  canRemove: boolean
  onCancel?: () => void
  redirect?: string
}) {
  const save = useSaveWallet()
  const remove = useRemoveWallet()
  const navigate = useNavigate()
  const form = useZodForm<WalletInput>(walletInputSchema, initial)
  const p = (k: keyof WalletInput & string) => ({ ...form.fieldProps(k), id: `${slot}-${k}`, 'aria-describedby': form.errors[k] ? `${slot}-${k}-error` : undefined })

  return (
    <form
      {...form.formProps}
      noValidate
      aria-label={slot === 'primary' ? 'Carteira principal' : 'Carteira secundária'}
      onSubmit={form.handleSubmit((data) =>
        save.mutate(
          { slot, body: data },
          {
            onError: form.applyServerError,
            onSuccess: () => {
              if (redirect) void navigate({ to: redirect })
            },
          },
        ),
      )}
      className="space-y-6"
    >
      <FormError message={form.errors.form} />
      <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
        <Field id={`${slot}-displayName`} label="Nome de exibição" required error={form.errors.displayName}>
          <Input {...p('displayName')} />
        </Field>
        <Field id={`${slot}-nickname`} label="Apelido da carteira" required error={form.errors.nickname}>
          <Input {...p('nickname')} />
        </Field>
        <Field id={`${slot}-network`} label="Rede" required error={form.errors.network}>
          <Select value={form.values.network} onValueChange={(v) => form.setField('network', v as Network)}>
            <SelectTrigger id={`${slot}-network`} className="h-10 w-full rounded-sm border-input bg-background">
              <SelectValue placeholder="Selecione uma rede" />
            </SelectTrigger>
            <SelectContent>
              {NETWORKS.map((n) => (
                <SelectItem key={n} value={n}>{NETWORK_LABEL[n]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${slot}-profileName`} label="Nome do perfil" required error={form.errors.profileName}>
          <Input {...p('profileName')} />
        </Field>
        <Field id={`${slot}-address`} label="Endereço da carteira" required error={form.errors.address}>
          <Input {...p('address')} placeholder="Endereço 0x da carteira" spellCheck={false} autoComplete="off" />
        </Field>
        <Field id={`${slot}-secondaryAddress`} label="ENS ou carteira secundária (opcional)" error={form.errors.secondaryAddress}>
          <Input {...p('secondaryAddress')} placeholder="0x… (opcional)" spellCheck={false} autoComplete="off" />
        </Field>
        <Field id={`${slot}-provider`} label="Tipo de carteira" required error={form.errors.provider}>
          <Select value={form.values.provider} onValueChange={(v) => form.setField('provider', v as WalletProvider)}>
            <SelectTrigger id={`${slot}-provider`} className="h-10 w-full rounded-sm border-input bg-background">
              <SelectValue placeholder="Selecione uma carteira" />
            </SelectTrigger>
            <SelectContent>
              {WALLET_PROVIDERS.map((w) => (
                <SelectItem key={w} value={w}>{WALLET_PROVIDER_LABEL[w]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${slot}-referralCode`} label="Código de indicação" required error={form.errors.referralCode}>
          <Input {...p('referralCode')} />
        </Field>
        <Field id={`${slot}-email`} label="E-mail" required error={form.errors.email}>
          <Input {...p('email')} type="email" />
        </Field>
        <Field id={`${slot}-ensName`} label="Nome ENS" required error={form.errors.ensName}>
          <div className="flex gap-2">
            <span className="grid h-10 place-items-center rounded-sm border border-input px-3 text-sm" aria-hidden>.eth</span>
            <Input {...p('ensName')} />
          </div>
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Salvar carteira
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        )}
        {exists && canRemove && (
          <Button type="button" variant="ghost" onClick={() => remove.mutate(slot, { onError: form.applyServerError })} disabled={remove.isPending}>
            <Trash2 className="size-4" aria-hidden /> Remover carteira
          </Button>
        )}
      </div>
    </form>
  )
}
