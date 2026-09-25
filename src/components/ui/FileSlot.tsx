import { FileText, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { errorKeyOf } from '@/lib/errors'
import { isImagePath, rejectionOf, uploadFile, type FileRejection } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { useSignedFileUrl } from '@/lib/useSignedFileUrl'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { Skeleton } from './Skeleton'

export type FileSlotFailure = FileRejection | 'network' | 'generic'

interface FileSlotProps {
  /** The stored object's path, or `null` when nothing is attached. */
  path: string | null
  accept: readonly string[]
  /** Builds this file's storage path — the caller knows whether it is a submission's or a player's. */
  buildPath: (file: File) => string
  /** Called after a successful upload (with the new path) or a removal (`null`). May itself throw. */
  onChange: (path: string | null) => void | Promise<void>
  chooseLabel: string
  replaceLabel: string
  removeLabel: string
  imageAlt: string
  pdfLabel?: string
  failureMessage: (failure: FileSlotFailure) => string
  /** `circle` for a profile photo, `rect` (default) for a document. */
  shape?: 'rect' | 'circle'
  className?: string
  disabled?: boolean
}

/**
 * A single file slot: empty (a "choose" button) or filled (a thumbnail — or a plain chip for a PDF — with
 * Replace/Remove). Uploads immediately on pick; the storage path is the source of truth, so a page that
 * shows an existing file resolves a signed URL for it once (cached a few minutes) instead of holding one.
 */
export function FileSlot({
  path,
  accept,
  buildPath,
  onChange,
  chooseLabel,
  replaceLabel,
  removeLabel,
  imageAlt,
  pdfLabel,
  failureMessage,
  shape = 'rect',
  className,
  disabled,
}: FileSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // A file this component just uploaded is previewed from the browser's own copy — no round trip needed.
  const [local, setLocal] = useState<{ path: string; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<FileSlotFailure | null>(null)

  const isLocal = local !== null && local.path === path
  const preview = useSignedFileUrl(isLocal ? null : path)
  const url = isLocal ? local.url : preview.data
  const image = path !== null && isImagePath(path)

  async function pick(file: File) {
    setFailure(null)
    const rejection = rejectionOf(file, accept)
    if (rejection) {
      setFailure(rejection)
      return
    }
    setBusy(true)
    try {
      const newPath = buildPath(file)
      await uploadFile(newPath, file)
      await onChange(newPath)
      setLocal({ path: newPath, url: URL.createObjectURL(file) })
    } catch (error) {
      setFailure(errorKeyOf(error) === 'network' ? 'network' : 'generic')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setFailure(null)
    setBusy(true)
    try {
      await onChange(null)
      setLocal(null)
    } catch (error) {
      setFailure(errorKeyOf(error) === 'network' ? 'network' : 'generic')
    } finally {
      setBusy(false)
    }
  }

  const box = (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden border border-line bg-page',
        shape === 'circle' ? 'size-24 rounded-full' : 'h-28 w-40 rounded-card',
      )}
    >
      {image ? (
        url ? (
          <img src={url} alt={imageAlt} className="size-full object-cover" />
        ) : (
          <Skeleton className="size-full rounded-none" />
        )
      ) : (
        <FileText className="size-8 text-ink-muted" aria-hidden />
      )}
    </span>
  )

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        aria-label={path ? replaceLabel : chooseLabel}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void pick(file)
        }}
        disabled={disabled || busy}
      />
      {path ? (
        <div className={cn('flex items-center gap-3', shape === 'circle' && 'flex-col text-center')}>
          {box}
          <div className={cn('flex flex-wrap items-center gap-2', shape === 'circle' && 'justify-center')}>
            {!image && <span className="text-[13px] text-ink-muted">{pdfLabel}</span>}
            <Button
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              loading={busy}
              disabled={disabled}
            >
              <Upload className="size-4" aria-hidden />
              {replaceLabel}
            </Button>
            <IconButton
              label={removeLabel}
              icon={<Trash2 className="size-4" aria-hidden />}
              onClick={() => void remove()}
              disabled={disabled || busy}
            />
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => inputRef.current?.click()} loading={busy} disabled={disabled}>
          <Upload className="size-4" aria-hidden />
          {chooseLabel}
        </Button>
      )}
      {failure && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {failureMessage(failure)}
        </p>
      )}
    </div>
  )
}
