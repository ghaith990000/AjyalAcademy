import { ArrowLeft, Bell, CalendarDays, CreditCard, Search, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { CheckboxField } from '@/components/ui/Checkbox'
import { DataList, type Column } from '@/components/ui/DataList'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatCard } from '@/components/ui/StatCard'
import { SwitchField } from '@/components/ui/Switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/toast-context'
import { formatBHD } from '@/lib/money'
import { useLanguage } from '@/lib/useLanguage'

interface SampleRow {
  id: string
  name: string
  school: string
  coach: string
  status: 'active' | 'expiring' | 'expired'
}

/** Dev-only (`/dev/ui`): every UI component in the current language, for visual review. */
export default function GalleryPage() {
  const { t } = useTranslation(['dev', 'common'])
  const { language } = useLanguage()
  const toast = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [condition, setCondition] = useState(true)

  const rows: SampleRow[] = [
    {
      id: '1',
      name: t('sample.player1'),
      school: t('sample.school1'),
      coach: t('sample.coach1'),
      status: 'active',
    },
    {
      id: '2',
      name: t('sample.player2'),
      school: t('sample.school2'),
      coach: t('sample.coach2'),
      status: 'expiring',
    },
    {
      id: '3',
      name: t('sample.player3'),
      school: t('sample.school1'),
      coach: t('sample.coach1'),
      status: 'expired',
    },
  ]

  const statusBadge = {
    active: <Badge tone="success">{t('gallery.statusActive')}</Badge>,
    expiring: <Badge tone="warning">{t('gallery.statusExpiring')}</Badge>,
    expired: <Badge tone="danger">{t('gallery.statusExpired')}</Badge>,
  } as const

  const columns: Column<SampleRow>[] = [
    {
      key: 'name',
      header: t('gallery.colName'),
      primary: true,
      cell: (row) => (
        <span className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <span className="font-semibold">{row.name}</span>
        </span>
      ),
    },
    { key: 'school', header: t('gallery.colSchool'), cell: (row) => row.school },
    { key: 'coach', header: t('gallery.colCoach'), cell: (row) => row.coach },
    { key: 'status', header: t('gallery.colStatus'), cell: (row) => statusBadge[row.status] },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 md:px-8">
      <PageHeader
        title={t('gallery.title')}
        description={t('gallery.intro')}
        actions={
          <>
            <LanguageToggle />
            <Button asChild variant="secondary">
              <Link to="/login">
                <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
                {t('common:actions.back')}
              </Link>
            </Button>
          </>
        }
      />

      <Section title={t('gallery.buttons')}>
        <div className="flex flex-wrap gap-3">
          <Button>{t('gallery.primary')}</Button>
          <Button variant="accent">{t('gallery.accent')}</Button>
          <Button variant="secondary">{t('gallery.secondary')}</Button>
          <Button variant="ghost">{t('gallery.ghost')}</Button>
          <Button variant="danger">{t('gallery.danger')}</Button>
          <Button loading>{t('gallery.loadingButton')}</Button>
          <Button disabled>{t('gallery.primary')}</Button>
          <IconButton
            label={t('common:actions.search')}
            icon={<Search className="size-5" />}
            variant="secondary"
          />
        </div>
      </Section>

      <Section title={t('gallery.forms')}>
        <Card className="grid gap-4 md:grid-cols-2">
          <Field label={t('gallery.nameLabel')} hint={t('gallery.nameHint')} required>
            {(control) => <Input {...control} dir="auto" defaultValue={t('sample.player1')} />}
          </Field>
          <Field label={t('gallery.cprLabel')} error={t('gallery.cprError')} required>
            {(control) => <Input {...control} ltr inputMode="numeric" defaultValue="12345" />}
          </Field>
          <Field label={t('gallery.schoolLabel')}>
            {(control) => (
              <Select {...control} defaultValue="1">
                <option value="1">{t('sample.school1')}</option>
                <option value="2">{t('sample.school2')}</option>
              </Select>
            )}
          </Field>
          <Field label={t('gallery.notesLabel')}>{(control) => <Textarea {...control} />}</Field>
          <SwitchField
            label={t('gallery.conditionLabel')}
            checked={condition}
            onCheckedChange={setCondition}
          />
          <CheckboxField label={t('gallery.conditionLabel')} defaultChecked />
        </Card>
      </Section>

      <Section title={t('gallery.badges')}>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="success">{t('gallery.statusActive')}</Badge>
          <Badge tone="warning">{t('gallery.statusExpiring')}</Badge>
          <Badge tone="danger">{t('gallery.statusExpired')}</Badge>
          <Badge tone="accent">{t('gallery.statusUnpaid')}</Badge>
          <Badge tone="info">{t('gallery.statusInfo')}</Badge>
          <Badge>{t('gallery.statusNeutral')}</Badge>
          <Avatar name={t('sample.player1')} size="sm" />
          <Avatar name={t('sample.player2')} />
          <Avatar name={t('sample.player3')} size="lg" />
        </div>
      </Section>

      <Section title={t('gallery.cards')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t('gallery.colName')} value="128" icon={Users} />
          <StatCard label={t('gallery.colStatus')} value="42" icon={CreditCard} tone="pink" />
          <StatCard
            label={t('gallery.colCoach')}
            value={<bdi>{formatBHD(540000, language)}</bdi>}
            icon={CalendarDays}
            tone="success"
          />
          <StatCard label={t('gallery.schoolLabel')} value="61.1%" icon={Bell} tone="warning" />
        </div>
      </Section>

      <Section title={t('gallery.data')}>
        <DataList
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          onRowClick={() => undefined}
          caption={t('gallery.data')}
        />
      </Section>

      <Section title={t('gallery.tabs')}>
        <Card>
          <Tabs defaultValue="one">
            <TabsList>
              <TabsTrigger value="one">{t('gallery.tabOne')}</TabsTrigger>
              <TabsTrigger value="two">{t('gallery.tabTwo')}</TabsTrigger>
            </TabsList>
            <TabsContent value="one">{t('gallery.tabContent')}</TabsContent>
            <TabsContent value="two">{t('gallery.tabContent')}</TabsContent>
          </Tabs>
        </Card>
      </Section>

      <Section title={t('gallery.overlays')}>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            {t('gallery.openDialog')}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: t('gallery.toastTitle'),
                description: t('gallery.toastDescription'),
                tone: 'success',
              })
            }
          >
            {t('gallery.showToast')}
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={t('gallery.dialogTitle')}
          description={t('gallery.dialogDescription')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                {t('gallery.secondary')}
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>
                {t('gallery.danger')}
              </Button>
            </>
          }
        />
      </Section>

      <Section title={t('gallery.empty')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <EmptyState
              icon={Users}
              title={t('gallery.dialogTitle')}
              description={t('gallery.dialogDescription')}
            />
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </Card>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <CardTitle>{title}</CardTitle>
      {children}
    </section>
  )
}
