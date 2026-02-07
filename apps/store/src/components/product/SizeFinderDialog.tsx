import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { recommendShoeSize, type ToeBox } from "@/lib/sizing/recommendShoeSize"
import { AlertTriangle } from "lucide-react"

const FOOT_LENGTH_MIN = 20
const FOOT_LENGTH_MAX = 37.2

const formatEu = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(1)

type Gender = "men" | "women"

type SizeFinderDialogProps = {
  open: boolean
  onOpenChange: (value: boolean) => void
  availableEuSizes: number[]
  onSelectSize: (euSize: number, source: "recommended" | "nearest") => void
}

export default function SizeFinderDialog({
  open,
  onOpenChange,
  availableEuSizes,
  onSelectSize,
}: SizeFinderDialogProps) {
  const [step, setStep] = useState(1)
  const [gender, setGender] = useState<Gender | "">("")
  const [footLength, setFootLength] = useState("")
  const [toeBox, setToeBox] = useState<ToeBox | "">("")
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep(1)
      setGender("")
      setFootLength("")
      setToeBox("")
      setIsConfirmOpen(false)
    }
  }, [open])

  const footLengthValue = Number(footLength)
  const footLengthValid =
    Number.isFinite(footLengthValue) &&
    footLengthValue >= FOOT_LENGTH_MIN &&
    footLengthValue <= FOOT_LENGTH_MAX

  const recommendation = useMemo(() => {
    if (!toeBox || !footLengthValid) {
      return null
    }
    return recommendShoeSize({
      footLengthCm: footLengthValue,
      toeBox,
      inStockEU: availableEuSizes,
    })
  }, [toeBox, footLengthValid, footLengthValue, availableEuSizes])

  const suggestedEU = recommendation
    ? recommendation.inStock
      ? recommendation.recommendedEU
      : recommendation.nearestEU
    : null

  const deltaEU =
    recommendation && recommendation.nearestEU != null
      ? recommendation.nearestEU - recommendation.baseEU
      : null
  const deltaDirection =
    deltaEU == null ? "" : deltaEU > 0 ? "их" : deltaEU < 0 ? "бага" : "адил"
  const deltaText =
    deltaEU == null
      ? ""
      : deltaEU === 0
      ? "Таны хүссэн хэмжээтэй ижил байна."
      : `Таны хүссэн хэмжээнээс EU ${formatEu(Math.abs(deltaEU))}-аар ${deltaDirection}.`

  const handleSelect = () => {
    if (!recommendation || suggestedEU == null) {
      return
    }
    if (recommendation.inStock) {
      onSelectSize(suggestedEU, "recommended")
      onOpenChange(false)
      return
    }
    setIsConfirmOpen(true)
  }

  const handleConfirmNearest = () => {
    if (!recommendation || suggestedEU == null) {
      return
    }
    onSelectSize(suggestedEU, "nearest")
    setIsConfirmOpen(false)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Танд яг таарах хэмжээг олъё</DialogTitle>
            <DialogDescription className="sr-only">
              Хэмжээг тодорхойлох 3 алхамтай заавар.
            </DialogDescription>
          </DialogHeader>

        <div className="text-xs font-semibold text-muted-foreground">
          Алхам {step}/3
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Хүйс</Label>
              <RadioGroup
                value={gender}
                onValueChange={(value) => setGender(value as Gender)}
                className="grid gap-3"
              >
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
                  <RadioGroupItem value="men" id="gender-men" />
                  <Label htmlFor="gender-men">Эрэгтэй</Label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
                  <RadioGroupItem value="women" id="gender-women" />
                  <Label htmlFor="gender-women">Эмэгтэй</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!gender}>
                Үргэлжлүүлэх
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="foot-length">Хөлийн урт (см)</Label>
              <Input
                id="foot-length"
                type="number"
                min={FOOT_LENGTH_MIN}
                max={FOOT_LENGTH_MAX}
                step="0.1"
                placeholder="Жишээ: 27.0"
                value={footLength}
                onChange={(event) => setFootLength(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                20–37.2 см хооронд хэмжээг оруулна уу.
              </p>
              {!footLengthValid && footLength !== "" && (
                <p className="text-xs text-destructive">
                  Хөлийн урт 20–37.2 см хооронд байх шаардлагатай.
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm font-semibold">Хэрхэн зөв хэмжих вэ?</p>
              <img
                src="/sizeguide.gif"
                alt="Хэмжээ авах заавар"
                className="w-full rounded-md border border-border"
              />
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Буцах
              </Button>
              <Button onClick={() => setStep(3)} disabled={!footLengthValid}>
                Үргэлжлүүлэх
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Toe box / өргөн</Label>
              <RadioGroup
                value={toeBox}
                onValueChange={(value) => setToeBox(value as ToeBox)}
                className="grid gap-3"
              >
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
                  <RadioGroupItem value="narrow" id="toe-narrow" />
                  <Label htmlFor="toe-narrow">Нарийн</Label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
                  <RadioGroupItem value="standard" id="toe-standard" />
                  <Label htmlFor="toe-standard">Стандарт</Label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium">
                  <RadioGroupItem value="wide" id="toe-wide" />
                  <Label htmlFor="toe-wide">Өргөн</Label>
                </div>
              </RadioGroup>
            </div>

            {recommendation && recommendation.inStock && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Танд тохирох хэмжээ: EU {formatEu(recommendation.recommendedEU)} ✓
                </p>
                <p className="text-xs text-emerald-700/80">
                  Энэ хэмжээг шууд сонгож болно.
                </p>
              </div>
            )}
            {recommendation && !recommendation.inStock && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Манайд таны EU {formatEu(recommendation.baseEU)} хэмжээ байхгүй.
                </p>
                <p className="text-sm font-semibold text-amber-900">
                  Хамгийн ойр байгаа хэмжээ:{" "}
                  {recommendation.nearestEU != null
                    ? `EU ${formatEu(recommendation.nearestEU)}`
                    : "Одоогоор байхгүй"}
                </p>
                <p className="text-xs text-amber-800/70">
                  Та хүсвэл ойр хэмжээг сонгож болно.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Буцах
              </Button>
              <Button onClick={handleSelect} disabled={suggestedEU == null}>
                {recommendation?.inStock ? "Энэ хэмжээг сонгох" : "Ойр хэмжээг сонгох"}
              </Button>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md overflow-hidden">
          <div className="-mx-6 -mt-6 mb-4 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
          <DialogHeader>
            <DialogTitle>Ойр хэмжээг сонгох уу?</DialogTitle>
            <DialogDescription className="sr-only">
              Ойр хэмжээг сонгохдоо баталгаажуулна.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground/90">
              Та ойр хэмжээг сонгохдоо итгэлтэй байна уу?
            </p>

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Таны хүссэн
                </span>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  EU {recommendation ? formatEu(recommendation.baseEU) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ойр байгаа
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
                  {suggestedEU != null ? `EU ${formatEu(suggestedEU)}` : "-"}
                </span>
              </div>

              {deltaText && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200/40 bg-amber-500/10 px-3 py-2 text-amber-100/90">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-200" />
                  <span className="text-xs">{deltaText}</span>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Ойр хэмжээ нь мэдрэмжээрээ өөр байж болно. Хэрвээ эргэлзэж байвал
              буцаад хэмжээгээ өөрчилж болно.
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Болих
            </Button>
            <Button onClick={handleConfirmNearest} className="shadow-lg shadow-primary/20">
              Итгэлтэй байна
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
